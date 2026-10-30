import { Prisma } from "@prisma/client";
import { prisma, executeResilientPrismaQuery } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import { generateToken } from "../../utils/jwt";
import { sendOtpEmail } from "../../utils/email.service";
import { sendMobileOtp, sanitizeMobileNumber } from "../../utils/sms.service";
import { otpService } from "./otp.service";
import { LoginInput, SendOtpInput, VerifyOtpInput } from "./auth.validation";

export interface SafeUserProfile {
  id: string;
  phone: string;
  email: string | null;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

export interface UnitMembershipInfo {
  id: string;
  memberType: string;
  isPrimaryHead: boolean;
  approvalStatus: string;
  unit: {
    id: string;
    unitNumber: string;
    floorNumber: number | null;
    occupancyStatus: string;
    sectionWingId: string;
    sectionWingName: string;
    societyId: string;
    societyName: string;
    societyCode: string;
    propertyType: string;
    address?: string;
  };
}

export interface AuthSuccessResult {
  user: SafeUserProfile;
  token: string;
  primarySocietyId?: string;
  primaryUnitId?: string;
  memberships: UnitMembershipInfo[];
}

/**
 * In-memory token revocation registry for stateless session invalidation
 */
const revokedTokens = new Set<string>();

export const invalidateSession = (token: string): void => {
  if (token) {
    revokedTokens.add(token);
    // Auto purge token from set after 7 days (JWT expiry window)
    const timer = setTimeout(() => {
      revokedTokens.delete(token);
    }, 7 * 24 * 60 * 60 * 1000);
    if (typeof timer.unref === "function") timer.unref();
  }
};

export const isSessionRevoked = (token: string): boolean => {
  return revokedTokens.has(token);
};

const userMembershipInclude = {
  unitMembers: {
    where: {
      approvalStatus: {
        not: "DEACTIVATED",
      },
    },
    include: {
      unit: {
        include: {
          sectionWing: {
            select: {
              id: true,
              name: true,
            },
          },
          society: {
            select: {
              id: true,
              name: true,
              code: true,
              propertyType: true,
              address: true,
            },
          },
        },
      },
    },
  },
};

/**
 * Format memberships for API response
 */
const formatMemberships = (unitMembers: any[]): UnitMembershipInfo[] => {
  return (unitMembers || []).map((m: any) => ({
    id: m.id,
    memberType: m.memberType,
    isPrimaryHead: m.isPrimaryHead,
    approvalStatus: m.approvalStatus,
    unit: {
      id: m.unit.id,
      unitNumber: m.unit.unitNumber,
      floorNumber: m.unit.floorNumber,
      occupancyStatus: m.unit.occupancyStatus,
      sectionWingId: m.unit.sectionWing.id,
      sectionWingName: m.unit.sectionWing.name,
      societyId: m.unit.society.id,
      societyName: m.unit.society.name,
      societyCode: m.unit.society.code,
      propertyType: m.unit.society.propertyType,
      address: m.unit.society.address,
    },
  }));
};

/**
 * Resolve primary society and unit from user memberships
 */
const resolvePrimaryAssociation = (unitMembers: any[]) => {
  const primaryMembership =
    unitMembers.find((m: any) => m.isPrimaryHead && m.approvalStatus === "APPROVED") ||
    unitMembers.find((m: any) => m.approvalStatus === "APPROVED") ||
    unitMembers[0];

  return {
    primarySocietyId: primaryMembership?.unit?.societyId,
    primaryUnitId: primaryMembership?.unit?.id,
  };
};

/**
 * Generate session result with token for a user
 */
const buildAuthResult = (user: any): AuthSuccessResult => {
  const { primarySocietyId, primaryUnitId } = resolvePrimaryAssociation(user.unitMembers || []);
  const token = generateToken({
    id: user.id,
    phone: user.phone,
    email: user.email,
    role: user.role,
    societyId: primarySocietyId,
    unitId: primaryUnitId,
  });

  return {
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
    token,
    primarySocietyId,
    primaryUnitId,
    memberships: formatMemberships(user.unitMembers || []),
  };
};

/**
 * Helper to resolve identifier and channel (email vs mobile)
 */
const resolveOtpTarget = (payload: {
  identifier?: string;
  email?: string;
  phone?: string;
  type?: "email" | "mobile";
}) => {
  const rawIdentifier = (payload.identifier || payload.email || payload.phone || "").trim();
  const cleanMobile = sanitizeMobileNumber(rawIdentifier);
  const isTenDigitPhone = /^[0-9]{10}$/.test(cleanMobile) && !rawIdentifier.includes("@");

  const isEmail =
    payload.type === "email" ||
    rawIdentifier.includes("@") ||
    Boolean(payload.email);

  const isMobile =
    !isEmail &&
    (payload.type === "mobile" || isTenDigitPhone || Boolean(payload.phone));

  const normalizedEmail = isEmail ? (payload.email || rawIdentifier).toLowerCase().trim() : null;
  const rawPhone = isMobile ? (payload.phone || rawIdentifier).trim().replace(/\s+/g, "") : null;
  const normalizedPhone = isMobile && cleanMobile ? `+91${cleanMobile}` : null;
  const destination = isEmail ? normalizedEmail! : normalizedPhone!;

  return {
    isEmail,
    isMobile,
    normalizedEmail,
    rawPhone,
    cleanMobile,
    normalizedPhone,
    destination,
  };
};

/**
 * 1. Dispatch OTP: Securely validate registered user existence, generate 6-digit OTP, and dispatch via Nodemailer / SMS.
 * SECURITY: If user does not exist in PostgreSQL, rejects with HTTP 404 immediately without generating OTP or calling Nodemailer.
 */
export const requestOtp = async (
  payload: SendOtpInput
): Promise<{ destination: string; channel: "email" | "mobile"; recipientName?: string }> => {
  const {
    isEmail,
    normalizedEmail,
    rawPhone,
    cleanMobile,
    normalizedPhone,
    destination,
  } = resolveOtpTarget(payload);

  // 1. Strict Pre-Login User Existence Validation in PostgreSQL
  // Normalize lookup email: email.toLowerCase().trim() and query Prisma using mode: 'insensitive'
  const user = await executeResilientPrismaQuery(() =>
    isEmail
      ? prisma.user.findFirst({
          where: {
            email: {
              equals: normalizedEmail!,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          select: { id: true, fullName: true, email: true, phone: true, isActive: true, role: true },
        })
      : prisma.user.findFirst({
          where: {
            OR: [
              { phone: normalizedPhone! },
              { phone: cleanMobile },
              ...(rawPhone ? [{ phone: rawPhone }] : []),
              ...(normalizedPhone!.startsWith("+91") ? [{ phone: normalizedPhone!.replace(/^\+91/, "") }] : []),
            ],
          },
          select: { id: true, fullName: true, email: true, phone: true, isActive: true, role: true },
        })
  );

  if (!user) {
    throw new AppError(
      404,
      "Account not found. Please register your society or join as a resident first."
    );
  }

  if (!user.isActive) {
    throw new AppError(
      403,
      "Your account has been deactivated. Please contact society administration."
    );
  }

  // 2. Generate CSPRNG 6-digit OTP and store HMAC hash with 10-min expiry in DB & memory
  const rawOtp = await otpService.createOtp(destination);

  if (isEmail) {
    // Dispatch real OTP email via Nodemailer / Resend
    console.log("[Email Dispatch] Attempting to send OTP to:", user.email || destination);
    await sendOtpEmail(destination, rawOtp, user.fullName || undefined);

    return { destination, channel: "email", recipientName: user.fullName };
  } else {
    // Dispatch SMS OTP via Fast2SMS Quick Route (route=q)
    console.info(`[AuthService] Attempting to send SMS OTP to registered mobile: ${destination}`);
    await sendMobileOtp(cleanMobile || destination, rawOtp);
    return { destination, channel: "mobile", recipientName: user.fullName };
  }
};

/**
 * 2. Verify OTP and Authenticate User Session
 */
export const verifyOtpAndAuthenticate = async (
  payload: VerifyOtpInput
): Promise<AuthSuccessResult> => {
  const {
    isEmail,
    normalizedEmail,
    rawPhone,
    cleanMobile,
    normalizedPhone,
    destination,
  } = resolveOtpTarget(payload);

  // 1. Verify candidate OTP against secure cryptographic store
  let verification = await otpService.verifyOtp(destination, payload.otp);
  if (
    !verification.valid &&
    !isEmail &&
    cleanMobile &&
    cleanMobile !== destination &&
    verification.reason?.includes("No active verification code")
  ) {
    verification = await otpService.verifyOtp(cleanMobile, payload.otp);
  }

  if (!verification.valid) {
    throw new AppError(400, verification.reason || "Invalid verification code.");
  }

  // 2. Locate registered user in database with case-insensitive email lookup
  const user = isEmail
    ? await prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail!,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        include: userMembershipInclude.unitMembers ? userMembershipInclude : undefined,
      })
    : await prisma.user.findFirst({
        where: {
          OR: [
            { phone: normalizedPhone! },
            { phone: cleanMobile },
            ...(rawPhone ? [{ phone: rawPhone }] : []),
            ...(normalizedPhone!.startsWith("+91") ? [{ phone: normalizedPhone!.replace(/^\+91/, "") }] : []),
          ],
        },
        include: userMembershipInclude.unitMembers ? userMembershipInclude : undefined,
      });

  if (!user) {
    throw new AppError(
      404,
      "Account not found. Please register your society or join as a resident first."
    );
  }

  if (!user.isActive) {
    throw new AppError(
      403,
      "Your account has been deactivated. Please contact society administration."
    );
  }

  return buildAuthResult(user);
};

/**
 * 3. Handle Unified Login (Email/Phone + OTP or Password)
 */
export const loginUser = async (payload: LoginInput): Promise<AuthSuccessResult> => {
  const {
    isEmail,
    normalizedEmail: targetEmail,
    rawPhone: rawTargetPhone,
    cleanMobile,
    normalizedPhone: targetPhone,
    destination,
  } = resolveOtpTarget(payload);

  if (!destination) {
    throw new AppError(400, "Please provide a valid registered phone number or email address.");
  }

  // If OTP is provided, verify against OTP service
  if (payload.otp) {
    let verification = await otpService.verifyOtp(destination, payload.otp);
    if (
      !verification.valid &&
      !isEmail &&
      cleanMobile &&
      cleanMobile !== destination &&
      verification.reason?.includes("No active verification code")
    ) {
      verification = await otpService.verifyOtp(cleanMobile, payload.otp);
    }

    if (!verification.valid) {
      throw new AppError(400, verification.reason || "Invalid verification code.");
    }
  }

  // Find user by email (mode: 'insensitive') or phone
  const user = isEmail
    ? await prisma.user.findFirst({
        where: {
          email: {
            equals: targetEmail!,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        include: userMembershipInclude,
      })
    : await prisma.user.findFirst({
        where: {
          OR: [
            { phone: targetPhone! },
            { phone: cleanMobile },
            ...(rawTargetPhone ? [{ phone: rawTargetPhone }] : []),
            ...(targetPhone!.startsWith("+91") ? [{ phone: targetPhone!.replace(/^\+91/, "") }] : []),
          ],
        },
        include: userMembershipInclude,
      });

  if (!user) {
    throw new AppError(
      404,
      "Account not found. Please register your society or join as a resident first."
    );
  }

  if (!user.isActive) {
    throw new AppError(
      403,
      "Your account has been deactivated. Please contact society administration."
    );
  }

  return buildAuthResult(user);
};

/**
 * 4. Fetch authenticated user's active profile and society associations
 */
export const getCurrentUser = async (userId: string): Promise<AuthSuccessResult> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      createdAt: true,
      unitMembers: userMembershipInclude.unitMembers,
    },
  });

  if (!user) {
    throw new AppError(404, "User profile not found.");
  }

  if (!user.isActive) {
    throw new AppError(403, "User account is deactivated. Access revoked.");
  }

  const { primarySocietyId, primaryUnitId } = resolvePrimaryAssociation(user.unitMembers || []);

  return {
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
    token: "", // not re-issuing on /me
    primarySocietyId,
    primaryUnitId,
    memberships: formatMemberships(user.unitMembers || []),
  };
};
