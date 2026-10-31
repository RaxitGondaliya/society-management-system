import crypto from "crypto";
import { prisma, isPrismaConnectionClosedError } from "../../config/prisma";

interface OtpRecord {
  hash: string;
  destination: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

interface VerifiedSessionRecord {
  otpHash: string;
  verifiedAt: number;
  expiresAt: number;
}

export interface VerifyOtpResult {
  valid: boolean;
  reason?: string;
}

/**
 * Enterprise Cryptographic & Database-backed OTP Store
 * - Cryptographically random 6-digit generation (CSPRNG)
 * - HMAC-SHA256 salted hashing (Raw OTP is NEVER persisted in database or logs)
 * - 10-Minute TTL expiration for OTP entry + 60-Minute verified session retention for multi-step onboarding wizards
 * - Brute-force throttling (max 5 attempts before revocation)
 * - Timing-safe comparison to prevent side-channel timing attacks
 */
export class OtpService {
  private cache = new Map<string, OtpRecord>();
  private verifiedSessions = new Map<string, VerifiedSessionRecord>();
  private readonly TTL_MS = 15 * 60 * 1000; // 15 minutes for OTP entry
  private readonly VERIFIED_SESSION_TTL_MS = 60 * 60 * 1000; // 60 minutes once verified in onboarding wizard
  private readonly MAX_ATTEMPTS = 5;
  private readonly secretKey: string;

  constructor() {
    this.secretKey = process.env.JWT_SECRET || "aura_obsidian_otp_secure_salt_2026";
    // Periodic sweep for expired passcodes every 5 minutes
    setInterval(() => this.cleanupExpired(), 5 * 60 * 1000).unref();
  }

  /**
   * Normalize destination keys (lowercase emails, stripped phone digits)
   */
  private normalizeKey(destination: string): string {
    const trimmed = String(destination || "").trim().toLowerCase();
    if (trimmed.includes("@")) {
      return trimmed;
    }
    return trimmed.replace(/[^0-9+]/g, "");
  }

  /**
   * Extract clean 10-digit Indian mobile number if destination is a phone number
   */
  private extractTenDigitMobile(destination: string): string | null {
    const trimmed = String(destination || "").trim();
    if (trimmed.includes("@")) return null;
    let digits = trimmed
      .replace(/^\+91[\s-]*/, "")
      .replace(/[\s-]/g, "")
      .replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) {
      digits = digits.slice(2);
    }
    digits = digits.replace(/^0+/, "");
    const clean = digits.slice(-10);
    return /^\d{10}$/.test(clean) ? clean : null;
  }

  /**
   * Return all normalized lookup keys for a destination (both +91XXXXXXXXXX and XXXXXXXXXX for mobile)
   */
  private getCandidateKeys(destination: string): string[] {
    const primary = this.normalizeKey(destination);
    const clean10 = this.extractTenDigitMobile(destination);
    if (!clean10) {
      return primary ? [primary] : [];
    }
    const keys = new Set<string>([clean10, `+91${clean10}`, primary]);
    return Array.from(keys).filter(Boolean);
  }

  /**
   * Compute HMAC-SHA256 hash of OTP with secret key
   */
  private hashOtp(otp: string): string {
    return crypto
      .createHmac("sha256", this.secretKey)
      .update(otp.trim())
      .digest("hex");
  }

  /**
   * Generate a cryptographically secure 6-digit numeric OTP string
   */
  public generateOtp(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Mark a destination as verified for the duration of the onboarding wizard session
   */
  public markDestinationVerified(destination: string, rawOtp?: string): void {
    const now = Date.now();
    const otpHash = rawOtp ? this.hashOtp(rawOtp) : "VERIFIED";
    for (const k of this.getCandidateKeys(destination)) {
      this.verifiedSessions.set(k, {
        otpHash,
        verifiedAt: now,
        expiresAt: now + this.VERIFIED_SESSION_TTL_MS,
      });
    }
  }

  /**
   * Check whether a destination has already completed mobile OTP verification in the current onboarding session
   */
  public isDestinationVerified(destination: string, candidateOtp?: string): boolean {
    const now = Date.now();
    const candidateHash = candidateOtp ? this.hashOtp(candidateOtp) : null;

    for (const k of this.getCandidateKeys(destination)) {
      const session = this.verifiedSessions.get(k);
      if (session) {
        if (now <= session.expiresAt) {
          if (!candidateHash || session.otpHash === "VERIFIED" || session.otpHash === candidateHash) {
            return true;
          }
        } else {
          this.verifiedSessions.delete(k);
        }
      }
    }
    return false;
  }

  /**
   * Synchronously populate the in-memory OTP cache for all candidate keys (+91 and 10-digit)
   * before any asynchronous database or SMS operation runs.
   */
  public cacheOtpSync(destination: string, rawOtp: string): void {
    const keys = this.getCandidateKeys(destination);
    const hash = this.hashOtp(rawOtp);
    const now = Date.now();

    for (const k of keys) {
      this.cache.set(k, {
        hash,
        destination: k,
        expiresAt: now + this.TTL_MS,
        attempts: 0,
        createdAt: now,
      });
    }
  }

  /**
   * Store the HMAC-SHA256 hash of a generated 6-digit OTP in memory cache and database
   */
  public async saveOtp(destination: string, rawOtp: string): Promise<void> {
    this.cacheOtpSync(destination, rawOtp);
    const keys = this.getCandidateKeys(destination);
    const hash = this.hashOtp(rawOtp);
    const now = Date.now();
    const expiresAt = new Date(now + this.TTL_MS);

    // 2. Persist hash with expiration timestamp to database
    const primaryKey = this.normalizeKey(destination);
    try {
      await prisma.otpVerification.updateMany({
        where: {
          destination: { in: keys.length > 0 ? keys : [primaryKey] },
          isUsed: false,
        },
        data: {
          isUsed: true,
        },
      });

      await prisma.otpVerification.create({
        data: {
          destination: primaryKey,
          otpHash: hash,
          expiresAt,
          attempts: 0,
          isUsed: false,
        },
      });
    } catch (err: any) {
      if (isPrismaConnectionClosedError(err)) {
        console.error(
          "[Prisma Connection Warning]: Database connection was temporarily closed, handling gracefully."
        );
        await prisma.$connect().catch(() => {});
        return;
      }
      console.warn(
        `[OtpService] Database write warning (in-memory cache remains active):`,
        err?.message || err
      );
    }
  }

  /**
   * Generate secure 6-digit numeric OTP and store its HMAC hash in database & cache
   * @param destination Phone number or email
   * @returns Raw 6-digit OTP string for one-time dispatch via email/SMS service
   */
  public async createOtp(destination: string): Promise<string> {
    const rawOtp = this.generateOtp();
    await this.saveOtp(destination, rawOtp);
    return rawOtp;
  }

  /**
   * Verify candidate OTP against stored hash (Database + In-Memory + Verified Session fallback)
   */
  public async verifyOtp(
    destination: string,
    candidateOtp: string,
    options?: { consume?: boolean }
  ): Promise<VerifyOtpResult> {
    const consume = options?.consume !== false;
    const candidateKeys = this.getCandidateKeys(destination);
    const now = new Date();
    const cleanOtp = String(candidateOtp || "").trim();
    const candidateHash = this.hashOtp(cleanOtp);

    // 0. If this destination was already verified during step 1 of the onboarding wizard,
    // retain the verified state without failing on consumed/purged OTP cache!
    if (this.isDestinationVerified(destination, cleanOtp)) {
      return { valid: true };
    }

    // 1. Try querying database for the latest active OTP record across candidate keys
    try {
      const dbRecord = await prisma.otpVerification.findFirst({
        where: {
          destination: { in: candidateKeys },
          isUsed: false,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (dbRecord) {
        if (now > dbRecord.expiresAt) {
          await prisma.otpVerification.update({
            where: { id: dbRecord.id },
            data: { isUsed: true },
          });
          for (const k of candidateKeys) this.cache.delete(k);
          return {
            valid: false,
            reason: "Verification code has expired. Please request a new code.",
          };
        }

        if (dbRecord.attempts >= this.MAX_ATTEMPTS) {
          await prisma.otpVerification.update({
            where: { id: dbRecord.id },
            data: { isUsed: true },
          });
          for (const k of candidateKeys) this.cache.delete(k);
          return {
            valid: false,
            reason:
              "Too many failed attempts. For your security, this passcode has been invalidated. Please request a new code.",
          };
        }

        const candidateBuffer = Buffer.from(candidateHash, "hex");
        const storedBuffer = Buffer.from(dbRecord.otpHash, "hex");

        const isMatch =
          candidateBuffer.length === storedBuffer.length &&
          crypto.timingSafeEqual(candidateBuffer, storedBuffer);

        if (isMatch) {
          // Record verified session for multi-step onboarding retention
          this.markDestinationVerified(destination, cleanOtp);

          if (consume) {
            await prisma.otpVerification.updateMany({
              where: { destination: { in: candidateKeys }, isUsed: false },
              data: { isUsed: true },
            });
            for (const k of candidateKeys) this.cache.delete(k);
          }
          return { valid: true };
        }

        // Increment attempts on mismatch
        await prisma.otpVerification.update({
          where: { id: dbRecord.id },
          data: { attempts: { increment: 1 } },
        });

        const remaining = this.MAX_ATTEMPTS - (dbRecord.attempts + 1);
        return {
          valid: false,
          reason: `Invalid verification code. ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining.`,
        };
      }
    } catch (err: any) {
      if (isPrismaConnectionClosedError(err)) {
        console.error(
          "[Prisma Connection Warning]: Database connection was temporarily closed, handling gracefully."
        );
        await prisma.$connect().catch(() => {});
      } else {
        console.warn(`[OtpService] Database query warning (falling back to cache):`, err.message);
      }
    }

    // 2. Cache Fallback (check all candidate keys)
    let record: OtpRecord | undefined;
    let matchedKey: string | undefined;
    for (const k of candidateKeys) {
      const found = this.cache.get(k);
      if (found) {
        record = found;
        matchedKey = k;
        break;
      }
    }

    if (!record) {
      // Check if destination was verified earlier in the onboarding wizard
      if (this.isDestinationVerified(destination)) {
        return { valid: true };
      }
      return {
        valid: false,
        reason: "No active verification code found for this address. Please request a new code.",
      };
    }

    const nowMs = Date.now();
    if (nowMs > record.expiresAt) {
      for (const k of candidateKeys) this.cache.delete(k);
      return {
        valid: false,
        reason: "Verification code has expired. Please request a new code.",
      };
    }

    if (record.attempts >= this.MAX_ATTEMPTS) {
      for (const k of candidateKeys) this.cache.delete(k);
      return {
        valid: false,
        reason:
          "Too many failed attempts. For your security, this passcode has been invalidated. Please request a new code.",
      };
    }

    const candidateBuffer = Buffer.from(candidateHash, "hex");
    const storedBuffer = Buffer.from(record.hash, "hex");

    const isMatch =
      candidateBuffer.length === storedBuffer.length &&
      crypto.timingSafeEqual(candidateBuffer, storedBuffer);

    if (isMatch) {
      this.markDestinationVerified(destination, cleanOtp);
      if (consume) {
        for (const k of candidateKeys) this.cache.delete(k);
      }
      return { valid: true };
    }

    record.attempts += 1;
    if (matchedKey) {
      this.cache.set(matchedKey, record);
    }
    const remaining = this.MAX_ATTEMPTS - record.attempts;
    return {
      valid: false,
      reason: `Invalid verification code. ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining.`,
    };
  }

  /**
   * Invalidate OTP cache (retains verifiedSessions for active onboarding wizard)
   */
  public async clearOtp(destination: string): Promise<void> {
    const candidateKeys = this.getCandidateKeys(destination);
    for (const k of candidateKeys) {
      this.cache.delete(k);
    }
    try {
      await prisma.otpVerification.updateMany({
        where: { destination: { in: candidateKeys }, isUsed: false },
        data: { isUsed: true },
      });
    } catch (err: any) {
      console.warn(`[OtpService] Failed to clear OTP in DB:`, err.message);
    }
  }

  /**
   * Sweep and remove expired entries from cache and verifiedSessions
   */
  private async cleanupExpired(): Promise<void> {
    const now = Date.now();
    for (const [key, record] of this.cache.entries()) {
      if (now > record.expiresAt) {
        this.cache.delete(key);
      }
    }
    for (const [key, session] of this.verifiedSessions.entries()) {
      if (now > session.expiresAt) {
        this.verifiedSessions.delete(key);
      }
    }
  }
}

export const otpService = new OtpService();
export default otpService;
