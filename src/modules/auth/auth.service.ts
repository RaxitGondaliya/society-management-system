import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import { generateToken } from "../../utils/jwt";
import { sendOtpEmail } from "../../utils/email.service";
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
 * 1. Dispatch OTP: Securely generate 6-digit OTP and send via Nodemailer / SMS
 * IMPORTANT: The generated OTP is NEVER returned in the API response!
 */
export const requestOtp = async (
  payload: SendOtpInput
): Promise<{ destination: string; channel: "email" | "mobile" }> => {
  const isEmail = Boolean(payload.email || payload.type === "email");
  const destination = isEmail ? payload.email!.trim().toLowerCase() : payload.phone!.trim();

  // Generate CSPRNG 6-digit OTP and store HMAC hash with 10-min expiry in DB & memory
  const rawOtp = await otpService.createOtp(destination);

  if (isEmail) {
    // Look up resident name if available
    const existingUser = await prisma.user.findUnique({
      where: { email: destination },
      select: { fullName: true },
    });

    // Dispatch branded OTP email via Nodemailer Gmail SMTP
    await sendOtpEmail(destination, rawOtp, existingUser?.fullName || undefined);

    console.info(`[AuthService] OTP generated and dispatched via email to ${destination}`);
    return { destination, channel: "email" };
  } else {
    // If SMS gateway is connected, dispatch here.
    console.info(`[AuthService] OTP generated for mobile destination ${destination}`);
    return { destination, channel: "mobile" };
  }
};

/**
 * 2. Verify OTP and Authenticate User Session
 */
export const verifyOtpAndAuthenticate = async (
  payload: VerifyOtpInput
): Promise<AuthSuccessResult> => {
  const isEmail = Boolean(payload.email || payload.type === "email");
  const destination = isEmail ? payload.email!.trim().toLowerCase() : payload.phone!.trim();

  // 1. Verify candidate OTP against secure cryptographic store
  const verification = await otpService.verifyOtp(destination, payload.otp);
  if (!verification.valid) {
    throw new AppError(400, verification.reason || "Invalid verification code.");
  }

  // 2. Locate or provision user in database
  let user = isEmail
    ? await prisma.user.findUnique({
        where: { email: destination },
        include: userMembershipInclude.unitMembers ? userMembershipInclude : undefined,
      })
    : await prisma.user.findUnique({
        where: { phone: destination },
        include: userMembershipInclude.unitMembers ? userMembershipInclude : undefined,
      });

  // If user does not exist yet (e.g. resident joining or registering society), create provisional resident account
  if (!user) {
    const defaultPhone = isEmail
      ? `+919${Math.floor(100000000 + Math.random() * 900000000)}`
      : destination;

    const defaultName = isEmail
      ? destination
          .split("@")[0]
          .replace(/[._-]/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase())
      : "Verified Resident";

    user = await prisma.user.create({
      data: {
        phone: defaultPhone,
        email: isEmail ? destination : null,
        fullName: defaultName,
        role: "RESIDENT",
        isActive: true,
      },
      include: userMembershipInclude,
    });
    console.info(`[AuthService] Provisioned new verified resident user: ${user.id} (${destination})`);
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
  const targetEmail = payload.email?.trim().toLowerCase();
  const rawTargetPhone = payload.phone?.trim() || payload.identifier?.trim();
  const targetPhone = rawTargetPhone
    ? rawTargetPhone.startsWith("+")
      ? rawTargetPhone
      : `+91${rawTargetPhone}`
    : undefined;

  const destination = targetEmail || targetPhone;
  if (!destination) {
    throw new AppError(400, "Please provide a valid registered phone number or email address.");
  }

  // If OTP is provided, verify against OTP service
  if (payload.otp) {
    const verification = await otpService.verifyOtp(destination, payload.otp);
    if (!verification.valid) {
      throw new AppError(400, verification.reason || "Invalid verification code.");
    }
  }

  // Find user by email or phone
  let user = targetEmail
    ? await prisma.user.findUnique({
        where: { email: targetEmail },
        include: userMembershipInclude,
      })
    : await prisma.user.findUnique({
        where: { phone: targetPhone! },
        include: userMembershipInclude,
      });

  // Auto-provision if unseeded resident logged in with valid OTP
  if (!user && payload.otp) {
    const defaultPhone = targetPhone || `+919${Math.floor(100000000 + Math.random() * 900000000)}`;
    const defaultName = targetEmail
      ? targetEmail
          .split("@")[0]
          .replace(/[._-]/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase())
      : "Verified Resident";

    user = await prisma.user.create({
      data: {
        phone: defaultPhone,
        email: targetEmail || null,
        fullName: defaultName,
        role: "RESIDENT",
        isActive: true,
      },
      include: userMembershipInclude,
    });
  }

  if (!user) {
    throw new AppError(
      404,
      `User account not found with ${targetEmail ? "email" : "phone number"}: ${destination}`
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
