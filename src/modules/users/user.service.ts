import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import { generateToken } from "../../utils/jwt";
import { sanitizeMobileNumber } from "../../utils/sms.service";
import { otpService } from "../auth/otp.service";
import {
  JoinSocietyInput,
  ApprovalDecisionInput,
  UpdateOccupancyInput,
} from "./user.validation";

/**
 * Submit resident onboarding request to join a society unit
 */
export const requestToJoinSociety = async (payload: JoinSocietyInput) => {
  const cleanPhone = sanitizeMobileNumber(payload.phone);
  const formattedPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : payload.phone;

  // Verify mobile OTP if provided
  if (payload.otp) {
    let verification = await otpService.verifyOtp(cleanPhone, payload.otp, { consume: true });
    if (!verification.valid) {
      verification = await otpService.verifyOtp(formattedPhone, payload.otp, { consume: true });
    }
    if (!verification.valid) {
      throw new AppError(400, verification.reason || "Invalid or expired verification code.");
    }
    await otpService.clearOtp(cleanPhone);
    await otpService.clearOtp(formattedPhone);
  }

  // 1. Resolve Society by ID or Code
  const society = payload.societyId
    ? await prisma.society.findUnique({
        where: { id: payload.societyId },
        select: { id: true, name: true, code: true, propertyType: true },
      })
    : await prisma.society.findUnique({
        where: { code: payload.societyCode?.trim().toUpperCase() },
        select: { id: true, name: true, code: true, propertyType: true },
      });

  if (!society) {
    throw new AppError(
      404,
      "Society not found with the specified ID or Society Code."
    );
  }

  // 2. Verify Unit belongs to this society
  const unit = await prisma.unit.findUnique({
    where: { id: payload.unitId },
    include: {
      sectionWing: {
        select: { id: true, name: true },
      },
    },
  });

  if (!unit || unit.societyId !== society.id) {
    throw new AppError(
      404,
      "Target unit was not found within this society."
    );
  }

  // 3. Concurrency & duplicate checks
  const existingUser = await prisma.user.findUnique({
    where: { phone: payload.phone },
  });

  if (existingUser) {
    const existingMembership = await prisma.unitMember.findFirst({
      where: {
        unitId: unit.id,
        userId: existingUser.id,
      },
    });

    if (existingMembership) {
      if (existingMembership.approvalStatus === "APPROVED") {
        throw new AppError(
          409,
          "User is already an approved member of this unit."
        );
      }
      if (existingMembership.approvalStatus === "PENDING") {
        throw new AppError(
          409,
          "A pending join request for this unit is already awaiting admin approval."
        );
      }
    }
  }

  // If joining as OWNER, check if an approved OWNER is already registered on this unit
  if (payload.memberType === "OWNER") {
    const existingApprovedOwner = await prisma.unitMember.findFirst({
      where: {
        unitId: unit.id,
        memberType: "OWNER",
        approvalStatus: "APPROVED",
      },
    });

    if (existingApprovedOwner) {
      throw new AppError(
        409,
        "This unit already has an approved registered owner. For ownership transfers, please contact society administration."
      );
    }
  }

  // 4. ACID Transaction: Upsert User, Create UnitMember, Link Family Members
  return await prisma.$transaction(async (tx) => {
    let user = existingUser;

    if (!user) {
      // Check email uniqueness if email provided
      if (payload.email) {
        const existingEmailUser = await tx.user.findUnique({
          where: { email: payload.email },
        });

        if (existingEmailUser) {
          throw new AppError(
            409,
            `A user with email '${payload.email}' already exists.`
          );
        }
      }

      user = await tx.user.create({
        data: {
          fullName: payload.fullName,
          phone: payload.phone,
          email: payload.email || null,
          role: "RESIDENT",
          isActive: true,
        },
      });
    }

    // Create pending UnitMember record
    const membership = await tx.unitMember.create({
      data: {
        unitId: unit.id,
        userId: user.id,
        memberType: payload.memberType,
        isPrimaryHead: false,
        approvalStatus: "PENDING",
      },
    });

    // Save optional family members linked to this unit
    if (payload.familyMembers && payload.familyMembers.length > 0) {
      await tx.familyMember.createMany({
        data: payload.familyMembers.map((fam) => ({
          unitId: unit.id,
          fullName: fam.fullName,
          relation: fam.relation,
          age: fam.age ?? null,
          phone: fam.phone ?? null,
          isEmergencyContact: fam.isEmergencyContact ?? false,
        })),
      });
    }

    // Generate valid JWT auth token for the resident session
    const token = generateToken({
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role, // 'RESIDENT'
      societyId: society.id,
      unitId: unit.id,
    });

    return {
      token,
      message: "Registration completed successfully.",
      requestId: membership.id,
      status: membership.approvalStatus,
      memberType: membership.memberType,
      society: {
        id: society.id,
        name: society.name,
        code: society.code,
      },
      unit: {
        id: unit.id,
        unitNumber: unit.unitNumber,
        wing: unit.sectionWing.name,
      },
      user: {
        id: user.id,
        name: user.fullName,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
      submittedAt: membership.createdAt,
    };
  }, {
    maxWait: 10000,
    timeout: 20000,
  });
};

/**
 * Retrieve pending join requests scoped to a society
 */
export const getPendingApprovals = async (societyId: string) => {
  const pendingRequests = await prisma.unitMember.findMany({
    where: {
      approvalStatus: "PENDING",
      unit: {
        societyId,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          role: true,
          createdAt: true,
        },
      },
      unit: {
        select: {
          id: true,
          unitNumber: true,
          floorNumber: true,
          occupancyStatus: true,
          sectionWing: {
            select: {
              id: true,
              name: true,
            },
          },
          familyMembers: {
            select: {
              id: true,
              fullName: true,
              relation: true,
              age: true,
              phone: true,
              isEmergencyContact: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return pendingRequests.map((req) => ({
    membershipId: req.id,
    memberType: req.memberType,
    approvalStatus: req.approvalStatus,
    createdAt: req.createdAt,
    user: req.user,
    unit: {
      id: req.unit.id,
      unitNumber: req.unit.unitNumber,
      floorNumber: req.unit.floorNumber,
      occupancyStatus: req.unit.occupancyStatus,
      sectionWing: req.unit.sectionWing,
    },
    familyMembers: req.unit.familyMembers,
  }));
};

/**
 * Review, approve, or reject a resident join request inside an ACID transaction
 */
export const reviewJoinRequest = async (
  membershipId: string,
  decision: ApprovalDecisionInput,
  adminSocietyId?: string
) => {
  return await prisma.$transaction(async (tx) => {
    const membership = await tx.unitMember.findUnique({
      where: { id: membershipId },
      include: {
        unit: {
          include: {
            sectionWing: {
              select: { id: true, name: true },
            },
            society: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        user: {
          select: { id: true, fullName: true, phone: true, email: true, role: true },
        },
      },
    });

    if (!membership) {
      throw new AppError(404, "Join request not found.");
    }

    if (adminSocietyId && membership.unit.societyId !== adminSocietyId) {
      throw new AppError(
        403,
        "Forbidden: You are not authorized to review requests for this society."
      );
    }

    if (membership.approvalStatus !== "PENDING") {
      throw new AppError(
        400,
        `This join request has already been processed with status '${membership.approvalStatus}'.`
      );
    }

    if (decision.status === "APPROVED") {
      // Check if an approved primary head already exists on this unit
      const existingPrimaryHead = await tx.unitMember.findFirst({
        where: {
          unitId: membership.unitId,
          approvalStatus: "APPROVED",
          isPrimaryHead: true,
        },
      });

      // Update UnitMember record to APPROVED
      const updatedMembership = await tx.unitMember.update({
        where: { id: membership.id },
        data: {
          approvalStatus: "APPROVED",
          isPrimaryHead: !existingPrimaryHead,
        },
      });

      // Update Unit occupancyStatus
      const newOccupancyStatus =
        membership.memberType === "OWNER" ? "OCCUPIED_OWNER" : "OCCUPIED_TENANT";

      await tx.unit.update({
        where: { id: membership.unitId },
        data: {
          occupancyStatus: newOccupancyStatus,
        },
      });

      return {
        message: "Resident join request approved successfully.",
        membershipId: updatedMembership.id,
        approvalStatus: updatedMembership.approvalStatus,
        isPrimaryHead: updatedMembership.isPrimaryHead,
        unit: {
          id: membership.unit.id,
          unitNumber: membership.unit.unitNumber,
          occupancyStatus: newOccupancyStatus,
          sectionWing: membership.unit.sectionWing.name,
        },
        user: membership.user,
      };
    } else {
      // REJECTED
      const updatedMembership = await tx.unitMember.update({
        where: { id: membership.id },
        data: {
          approvalStatus: "REJECTED",
          deactivationReason: decision.rejectionReason || "Rejected by Society Admin",
          deactivatedAt: new Date(),
        },
      });

      return {
        message: "Resident join request rejected.",
        membershipId: updatedMembership.id,
        approvalStatus: updatedMembership.approvalStatus,
        rejectionReason: updatedMembership.deactivationReason,
        unit: {
          id: membership.unit.id,
          unitNumber: membership.unit.unitNumber,
          sectionWing: membership.unit.sectionWing.name,
        },
        user: membership.user,
      };
    }
  });
};

/**
 * Fetch hierarchical society directory (Wings -> Units -> Members -> Family)
 */
export const getSocietyDirectory = async (societyId: string) => {
  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: {
      id: true,
      name: true,
      code: true,
      propertyType: true,
      address: true,
      sections: {
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          units: {
            orderBy: [{ floorNumber: "asc" }, { unitNumber: "asc" }],
            select: {
              id: true,
              unitNumber: true,
              floorNumber: true,
              occupancyStatus: true,
              members: {
                where: {
                  approvalStatus: "APPROVED",
                },
                select: {
                  id: true,
                  memberType: true,
                  isPrimaryHead: true,
                  createdAt: true,
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                      phone: true,
                      email: true,
                      role: true,
                    },
                  },
                },
              },
              familyMembers: {
                select: {
                  id: true,
                  fullName: true,
                  relation: true,
                  age: true,
                  phone: true,
                  isEmergencyContact: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!society) {
    throw new AppError(404, "Society not found.");
  }

  return {
    society: {
      id: society.id,
      name: society.name,
      code: society.code,
      propertyType: society.propertyType,
      address: society.address,
    },
    sections: society.sections.map((section) => ({
      id: section.id,
      name: section.name,
      totalUnits: section.units.length,
      units: section.units.map((u) => {
        const primaryMember =
          u.members.find((m) => m.isPrimaryHead) || u.members[0] || null;

        return {
          id: u.id,
          unitNumber: u.unitNumber,
          floorNumber: u.floorNumber,
          occupancyStatus: u.occupancyStatus,
          primaryResident: primaryMember
            ? {
                id: primaryMember.user.id,
                fullName: primaryMember.user.fullName,
                phone: primaryMember.user.phone,
                memberType: primaryMember.memberType,
              }
            : null,
          members: u.members.map((m) => ({
            id: m.id,
            memberType: m.memberType,
            isPrimaryHead: m.isPrimaryHead,
            user: m.user,
          })),
          familyMembers: u.familyMembers,
        };
      }),
    })),
  };
};

/**
 * Update unit occupancy or primary head status
 */
export const updateUnitOccupancy = async (
  unitId: string,
  payload: UpdateOccupancyInput,
  adminSocietyId?: string
) => {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      sectionWing: {
        select: { id: true, name: true },
      },
    },
  });

  if (!unit) {
    throw new AppError(404, "Unit not found.");
  }

  if (adminSocietyId && unit.societyId !== adminSocietyId) {
    throw new AppError(
      403,
      "Forbidden: You do not have permission to manage units in this society."
    );
  }

  const updatedUnit = await prisma.unit.update({
    where: { id: unitId },
    data: {
      ...(payload.occupancyStatus ? { occupancyStatus: payload.occupancyStatus } : {}),
    },
    include: {
      sectionWing: {
        select: { id: true, name: true },
      },
    },
  });

  return {
    message: "Unit occupancy updated successfully.",
    unit: {
      id: updatedUnit.id,
      unitNumber: updatedUnit.unitNumber,
      floorNumber: updatedUnit.floorNumber,
      occupancyStatus: updatedUnit.occupancyStatus,
      wing: updatedUnit.sectionWing.name,
    },
  };
};
