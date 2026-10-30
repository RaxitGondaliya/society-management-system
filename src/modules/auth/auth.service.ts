import { Prisma } from "@prisma/client";
import { prisma, executeResilientPrismaQuery } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import { generateToken } from "../../utils/jwt";
import { sendOtpEmail } from "../../utils/email.service";
import {
  flushStdout,
  sendMobileOtp,
  sanitizeMobileNumber,
} from "../../utils/sms.service";
import { otpService } from "./otp.service";
import {
  LoginInput,
  SendOtpInput,
  VerifyOtpInput,
  RegisterOtpInput,
  VerifyRegisterOtpInput,
  RegisterUserInput,
} from "./auth.validation";

export interface SafeUserProfile {
  id: string;
  phone: string;
  email: string | null;
  fullName: string;
  name?: string;
  role: string;
  isActive: boolean;
  phoneVerified?: boolean;
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

  // 2. Generate CSPRNG 6-digit OTP
  const rawOtp = otpService.generateOtp();

  if (isEmail) {
    await otpService.saveOtp(destination, rawOtp);
    // Dispatch real OTP email via Nodemailer / Resend
    console.log("[Email Dispatch] Attempting to send OTP to:", user.email || destination);
    flushStdout();
    await sendOtpEmail(destination, rawOtp, user.fullName || undefined);
    flushStdout();

    return { destination, channel: "email", recipientName: user.fullName };
  } else {
    flushStdout();
    console.log(`\n========================================\n[MOBILE OTP DISPATCH] Destination: ${cleanMobile || destination} | OTP: >>> ${rawOtp} <<<\n========================================\n`);
    flushStdout();
    await otpService.saveOtp(destination, rawOtp);
    if (cleanMobile) {
      await otpService.saveOtp(cleanMobile, rawOtp);
    }
    // Dispatch SMS OTP via Fast2SMS Quick Route (route=q)
    console.info(`[AuthService] Attempting to send SMS OTP to registered mobile: ${destination}`);
    await sendMobileOtp(cleanMobile || destination, rawOtp);
    flushStdout();
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
  const user = await executeResilientPrismaQuery(() =>
    isEmail
      ? prisma.user.findFirst({
          where: {
            email: {
              equals: normalizedEmail!,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          include: userMembershipInclude.unitMembers ? userMembershipInclude : undefined,
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
          include: userMembershipInclude.unitMembers ? userMembershipInclude : undefined,
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

  return buildAuthResult(user);
};

/**
 * 3. Handle Unified Login (Email/Phone + OTP)
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

  // Unconditionally enforce OTP verification before issuing JWT
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

  // Find user by email (mode: 'insensitive') or phone
  const user = await executeResilientPrismaQuery(() =>
    isEmail
      ? prisma.user.findFirst({
          where: {
            email: {
              equals: targetEmail!,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          include: userMembershipInclude,
        })
      : prisma.user.findFirst({
          where: {
            OR: [
              { phone: targetPhone! },
              { phone: cleanMobile },
              ...(rawTargetPhone ? [{ phone: rawTargetPhone }] : []),
              ...(targetPhone!.startsWith("+91") ? [{ phone: targetPhone!.replace(/^\+91/, "") }] : []),
            ],
          },
          include: userMembershipInclude,
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

  return buildAuthResult(user);
};

/**
 * 4. Fetch authenticated user's active profile and society associations
 */
export const getCurrentUser = async (userId: string): Promise<AuthSuccessResult> => {
  const user = await executeResilientPrismaQuery(() =>
    prisma.user.findUnique({
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
    })
  );

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

/**
 * 5. Dispatch Registration Mobile OTP (POST /api/v1/auth/register-otp)
 * Ensures mobile number does NOT already exist in DB (returns 409 Conflict if registered).
 * Generates 6-digit OTP, logs prominent terminal fallback banner immediately,
 * caches/stores via otpService, and dispatches via Fast2SMS (route=q).
 */
export const requestRegistrationOtp = async (
  payload: RegisterOtpInput
): Promise<{ destination: string; cleanMobile: string; channel: "mobile" }> => {
  const rawPhone = (
    payload.phone ||
    payload.mobile ||
    payload.identifier ||
    ""
  ).trim();
  const cleanMobile = sanitizeMobileNumber(rawPhone);

  if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
    throw new AppError(400, "Please provide a valid 10-digit Indian mobile number.");
  }

  const normalizedPhone = `+91${cleanMobile}`;

  // Ensure mobile number does NOT already exist in database
  let existingUser: { id: string; phone: string } | null | undefined = null;
  try {
    existingUser = await executeResilientPrismaQuery(() =>
      prisma.user.findFirst({
        where: {
          OR: [
            { phone: normalizedPhone },
            { phone: cleanMobile },
            ...(rawPhone ? [{ phone: rawPhone }] : []),
          ],
        },
        select: { id: true, phone: true },
      })
    );
  } catch (dbErr: any) {
    console.warn(
      "[AuthService] Database lookup warning during register-otp (continuing with OTP generation):",
      dbErr?.message || dbErr
    );
  }

  if (existingUser) {
    throw new AppError(409, "Mobile number already registered. Please login.");
  }

  // 1. Generate 6-digit registration OTP code
  const otpCode = otpService.generateOtp();

  // 2. Immediately print prominent fallback log banner BEFORE saving to DB or dispatching to Fast2SMS
  flushStdout();
  console.log(`\n========================================\n[REGISTRATION OTP DISPATCH] Destination: ${cleanMobile} | OTP: >>> ${otpCode} <<<\n========================================\n`);
  flushStdout();

  // 3. Store OTP in memory & DB under both +91 and 10-digit keys
  await otpService.saveOtp(normalizedPhone, otpCode);
  await otpService.saveOtp(cleanMobile, otpCode);

  // 4. Await Fast2SMS Quick Route (route=q) dispatch and its internal fallback logging
  await sendMobileOtp(cleanMobile, otpCode);
  flushStdout();

  return {
    destination: normalizedPhone,
    cleanMobile,
    channel: "mobile",
  };
};

/**
 * 6. Pre-verify Registration Mobile OTP inline (POST /api/v1/auth/verify-register-otp)
 * Verifies the 6-digit OTP without consuming it yet so final registration submission can consume it.
 */
export const verifyRegistrationOtp = async (
  payload: VerifyRegisterOtpInput
): Promise<{ verified: boolean; phone: string }> => {
  const rawPhone = (
    payload.phone ||
    payload.mobile ||
    payload.identifier ||
    ""
  ).trim();
  const cleanMobile = sanitizeMobileNumber(rawPhone);

  if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
    throw new AppError(400, "Please provide a valid 10-digit Indian mobile number.");
  }

  const normalizedPhone = `+91${cleanMobile}`;

  let verification = await otpService.verifyOtp(normalizedPhone, payload.otp, {
    consume: false,
  });
  if (
    !verification.valid &&
    verification.reason?.includes("No active verification code")
  ) {
    verification = await otpService.verifyOtp(cleanMobile, payload.otp, {
      consume: false,
    });
  }

  if (!verification.valid) {
    throw new AppError(
      400,
      verification.reason || "Invalid or expired verification code."
    );
  }

  return {
    verified: true,
    phone: normalizedPhone,
  };
};

/**
 * 7. Complete User Registration with Verified Mobile OTP (POST /api/v1/auth/register)
 * - Unconditionally verifies 6-digit mobile OTP via otpService.verifyOtp
 * - Email is optional and requires NO OTP verification
 * - Creates user in PostgreSQL, issues JWT token, and returns user profile + token
 */
export const registerUserWithOtp = async (
  payload: RegisterUserInput
): Promise<AuthSuccessResult> => {
  const resolvedName = (
    payload.name ||
    payload.fullName ||
    payload.admin?.fullName ||
    ""
  ).trim();
  const rawPhone = (payload.phone || payload.admin?.phone || "").trim();
  const cleanMobile = sanitizeMobileNumber(rawPhone);

  if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
    throw new AppError(400, "Please provide a valid 10-digit Indian mobile number.");
  }

  const normalizedPhone = `+91${cleanMobile}`;
  const rawEmail = (payload.email ?? payload.admin?.email ?? "").toString().trim().toLowerCase();
  const normalizedEmail = rawEmail.length > 0 ? rawEmail : null;
  const resolvedRole = payload.role || "RESIDENT";

  // 1. Unconditionally verify mobile OTP with otpService.verifyOtp (consumes OTP)
  let verification = await otpService.verifyOtp(normalizedPhone, payload.otp, {
    consume: true,
  });
  if (
    !verification.valid &&
    verification.reason?.includes("No active verification code")
  ) {
    verification = await otpService.verifyOtp(cleanMobile, payload.otp, {
      consume: true,
    });
  }

  if (!verification.valid) {
    throw new AppError(
      400,
      verification.reason || "Invalid or expired mobile verification code."
    );
  }

  // 2. Ensure mobile number is not already registered
  const existingPhoneUser = await executeResilientPrismaQuery(() =>
    prisma.user.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          { phone: cleanMobile },
          ...(rawPhone ? [{ phone: rawPhone }] : []),
        ],
      },
      select: { id: true },
    })
  );

  if (existingPhoneUser) {
    throw new AppError(409, "Mobile number already registered. Please login.");
  }

  // 3. Check optional email uniqueness if provided
  if (normalizedEmail) {
    const existingEmailUser = await executeResilientPrismaQuery(() =>
      prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        select: { id: true },
      })
    );

    if (existingEmailUser) {
      throw new AppError(
        409,
        `An account with email '${normalizedEmail}' already exists.`
      );
    }
  }

  // 4. Create user (and optional unit membership) in PostgreSQL
  const createdUser = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        fullName: resolvedName,
        phone: normalizedPhone,
        email: normalizedEmail,
        role: resolvedRole,
        isActive: true,
      },
    });

    if (payload.unitId) {
      const targetUnit = await tx.unit.findUnique({
        where: { id: payload.unitId },
        select: { id: true },
      });

      if (targetUnit) {
        await tx.unitMember.create({
          data: {
            unitId: targetUnit.id,
            userId: newUser.id,
            memberType: payload.memberType || "OWNER",
            isPrimaryHead: resolvedRole === "SUPER_ADMIN",
            approvalStatus: resolvedRole === "SUPER_ADMIN" ? "APPROVED" : "PENDING",
          },
        });
      }
    }

    return tx.user.findUniqueOrThrow({
      where: { id: newUser.id },
      include: userMembershipInclude,
    });
  });

  const authResult = buildAuthResult(createdUser);
  return {
    ...authResult,
    user: {
      ...authResult.user,
      name: createdUser.fullName,
      phoneVerified: true,
    },
  };
};
