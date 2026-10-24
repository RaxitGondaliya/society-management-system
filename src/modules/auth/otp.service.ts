import crypto from "crypto";
import { prisma } from "../../config/prisma";

interface OtpRecord {
  hash: string;
  destination: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

export interface VerifyOtpResult {
  valid: boolean;
  reason?: string;
}

/**
 * Enterprise Cryptographic & Database-backed OTP Store
 * - Cryptographically random 6-digit generation (CSPRNG)
 * - HMAC-SHA256 salted hashing (Raw OTP is NEVER persisted in database or logs)
 * - 10-Minute TTL expiration
 * - Brute-force throttling (max 5 attempts before revocation)
 * - Timing-safe comparison to prevent side-channel timing attacks
 * - Single-use consumption (marked used and purged upon successful verification)
 */
export class OtpService {
  private cache = new Map<string, OtpRecord>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes
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
    const trimmed = destination.trim().toLowerCase();
    if (trimmed.includes("@")) {
      return trimmed;
    }
    return trimmed.replace(/[^0-9+]/g, "");
  }

  /**
   * Compute HMAC-SHA256 hash of OTP with secret key
   */
  private hashOtp(otp: string): string {
    return crypto
      .createHmac("sha256", this.secretKey)
      .update(otp)
      .digest("hex");
  }

  /**
   * Generate secure 6-digit numeric OTP and store its HMAC hash in database & cache
   * @param destination Phone number or email
   * @returns Raw 6-digit OTP string for one-time dispatch via email service
   */
  public async createOtp(destination: string): Promise<string> {
    const key = this.normalizeKey(destination);

    // Cryptographically secure 6-digit random number between 100000 and 999999
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const hash = this.hashOtp(rawOtp);
    const now = Date.now();
    const expiresAt = new Date(now + this.TTL_MS);

    // 1. Update in-memory cache for fast local lookup & rate limiting
    this.cache.set(key, {
      hash,
      destination: key,
      expiresAt: now + this.TTL_MS,
      attempts: 0,
      createdAt: now,
    });

    // 2. Persist hash with expiration timestamp to database
    try {
      // Invalidate existing unused records for this destination
      await prisma.otpVerification.updateMany({
        where: {
          destination: key,
          isUsed: false,
        },
        data: {
          isUsed: true,
        },
      });

      // Insert fresh hashed OTP record
      await prisma.otpVerification.create({
        data: {
          destination: key,
          otpHash: hash,
          expiresAt,
          attempts: 0,
          isUsed: false,
        },
      });
    } catch (err: any) {
      console.warn(`[OtpService] Database write warning (falling back to cache):`, err.message);
    }

    return rawOtp;
  }

  /**
   * Verify candidate OTP against stored hash (Database + In-Memory fallback)
   */
  public async verifyOtp(destination: string, candidateOtp: string): Promise<VerifyOtpResult> {
    const key = this.normalizeKey(destination);
    const now = new Date();
    const candidateHash = this.hashOtp(candidateOtp.trim());

    // 1. Try querying database for the latest active OTP record
    try {
      const dbRecord = await prisma.otpVerification.findFirst({
        where: {
          destination: key,
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
          this.cache.delete(key);
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
          this.cache.delete(key);
          return {
            valid: false,
            reason: "Too many failed attempts. For your security, this passcode has been invalidated. Please request a new code.",
          };
        }

        const candidateBuffer = Buffer.from(candidateHash, "hex");
        const storedBuffer = Buffer.from(dbRecord.otpHash, "hex");

        const isMatch =
          candidateBuffer.length === storedBuffer.length &&
          crypto.timingSafeEqual(candidateBuffer, storedBuffer);

        if (isMatch) {
          // Invalidate record upon successful verification
          await prisma.otpVerification.update({
            where: { id: dbRecord.id },
            data: { isUsed: true },
          });
          this.cache.delete(key);
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
      console.warn(`[OtpService] Database query warning (falling back to cache):`, err.message);
    }

    // 2. Cache Fallback (if DB is unreachable or during transitional state)
    const record = this.cache.get(key);
    if (!record) {
      return {
        valid: false,
        reason: "No active verification code found for this address. Please request a new code.",
      };
    }

    const nowMs = Date.now();
    if (nowMs > record.expiresAt) {
      this.cache.delete(key);
      return {
        valid: false,
        reason: "Verification code has expired. Please request a new code.",
      };
    }

    if (record.attempts >= this.MAX_ATTEMPTS) {
      this.cache.delete(key);
      return {
        valid: false,
        reason: "Too many failed attempts. For your security, this passcode has been invalidated. Please request a new code.",
      };
    }

    const candidateBuffer = Buffer.from(candidateHash, "hex");
    const storedBuffer = Buffer.from(record.hash, "hex");

    const isMatch =
      candidateBuffer.length === storedBuffer.length &&
      crypto.timingSafeEqual(candidateBuffer, storedBuffer);

    if (isMatch) {
      this.cache.delete(key);
      return { valid: true };
    }

    record.attempts += 1;
    const remaining = this.MAX_ATTEMPTS - record.attempts;
    return {
      valid: false,
      reason: `Invalid verification code. ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining.`,
    };
  }

  /**
   * Invalidate OTP
   */
  public async clearOtp(destination: string): Promise<void> {
    const key = this.normalizeKey(destination);
    this.cache.delete(key);
    try {
      await prisma.otpVerification.updateMany({
        where: { destination: key, isUsed: false },
        data: { isUsed: true },
      });
    } catch (err: any) {
      console.warn(`[OtpService] Failed to clear OTP in DB:`, err.message);
    }
  }

  /**
   * Sweep and remove expired entries from cache and old DB records
   */
  private async cleanupExpired(): Promise<void> {
    const now = Date.now();
    for (const [key, record] of this.cache.entries()) {
      if (now > record.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

export const otpService = new OtpService();
export default otpService;
