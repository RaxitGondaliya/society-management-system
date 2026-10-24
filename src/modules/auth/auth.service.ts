import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import { generateToken } from "../../utils/jwt";
import { LoginInput } from "./auth.validation";

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

export interface LoginResult {
  user: SafeUserProfile;
  token: string;
  primarySocietyId?: string;
  primaryUnitId?: string;
  memberships: UnitMembershipInfo[];
}

export interface CurrentUserProfileResult {
  user: SafeUserProfile;
  primarySocietyId?: string;
  primaryUnitId?: string;
  memberships: UnitMembershipInfo[];
}

/**
 * Login user via phone number and return JWT token with society association
 */
export const loginUser = async (payload: LoginInput): Promise<LoginResult> => {
  const user = await prisma.user.findUnique({
    where: { phone: payload.phone },
    include: {
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
    },
  });

  if (!user) {
    throw new AppError(
      404,
      "User account not found with the provided phone number."
    );
  }

  if (!user.isActive) {
    throw new AppError(
      403,
      "Your account has been deactivated. Please contact society administration."
    );
  }

  // Determine primary society and unit association
  const primaryMembership =
    user.unitMembers.find(
      (m) => m.isPrimaryHead && m.approvalStatus === "APPROVED"
    ) ||
    user.unitMembers.find((m) => m.approvalStatus === "APPROVED") ||
    user.unitMembers[0];

  const primarySocietyId = primaryMembership?.unit.societyId;
  const primaryUnitId = primaryMembership?.unit.id;

  // Generate secure JWT access token
  const token = generateToken({
    id: user.id,
    phone: user.phone,
    email: user.email,
    role: user.role,
    societyId: primarySocietyId,
    unitId: primaryUnitId,
  });

  const formattedMemberships: UnitMembershipInfo[] = user.unitMembers.map((m) => ({
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
    memberships: formattedMemberships,
  };
};

/**
 * Fetch authenticated user's active profile and society associations
 */
export const getCurrentUser = async (
  userId: string
): Promise<CurrentUserProfileResult> => {
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
    },
  });

  if (!user) {
    throw new AppError(404, "User profile not found.");
  }

  if (!user.isActive) {
    throw new AppError(403, "User account is deactivated. Access revoked.");
  }

  const primaryMembership =
    user.unitMembers.find(
      (m) => m.isPrimaryHead && m.approvalStatus === "APPROVED"
    ) ||
    user.unitMembers.find((m) => m.approvalStatus === "APPROVED") ||
    user.unitMembers[0];

  const primarySocietyId = primaryMembership?.unit.societyId;
  const primaryUnitId = primaryMembership?.unit.id;

  const formattedMemberships: UnitMembershipInfo[] = user.unitMembers.map((m) => ({
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
    primarySocietyId,
    primaryUnitId,
    memberships: formattedMemberships,
  };
};
