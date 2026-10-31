import { prisma, executeResilientPrismaQuery } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import { generateToken } from "../../utils/jwt";
import { sanitizeMobileNumber } from "../../utils/sms.service";
import { otpService } from "../auth/otp.service";
import {
  JoinSocietyInput,
  ApprovalDecisionInput,
  UpdateOccupancyInput,
  UpdateMyProfileInput,
  AdminUpdateUserStatusInput,
} from "./user.validation";

/**
 * Submit resident onboarding request to join a society unit
 */
export const requestToJoinSociety = async (payload: JoinSocietyInput) => {
  const cleanPhone = sanitizeMobileNumber(payload.phone);
  const formattedPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : payload.phone;

  // Verify mobile OTP if provided and not already verified in onboarding wizard session
  if (payload.otp) {
    if (!otpService.isDestinationVerified(cleanPhone, payload.otp)) {
      let verification = await otpService.verifyOtp(cleanPhone, payload.otp, { consume: true });
      if (!verification.valid) {
        verification = await otpService.verifyOtp(formattedPhone, payload.otp, { consume: true });
      }
      if (
        !verification.valid &&
        !verification.reason?.includes("No active verification code")
      ) {
        throw new AppError(400, verification.reason || "Invalid or expired verification code.");
      }
    }
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
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: formattedPhone },
        { phone: cleanPhone },
        { phone: payload.phone },
      ],
    },
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

      try {
        user = await tx.user.create({
          data: {
            fullName: payload.fullName,
            phone: formattedPhone,
            email: payload.email || null,
            role: "RESIDENT",
            residentType: payload.memberType,
            status: "PENDING",
            societyId: society.id,
            unitId: unit.id,
            isActive: true,
          },
        });
      } catch {
        user = await tx.user.create({
          data: {
            fullName: payload.fullName,
            phone: formattedPhone,
            email: payload.email || null,
            role: "RESIDENT",
            isActive: true,
          },
        });
      }
    } else {
      const isAdminUser = ["SUPER_ADMIN", "SOCIETY_ADMIN", "SUB_ADMIN"].includes(
        (user.role || "").toUpperCase()
      );
      try {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            fullName: payload.fullName || user.fullName,
            residentType: payload.memberType,
            ...(isAdminUser ? {} : { status: "PENDING" }),
            societyId: society.id,
            unitId: unit.id,
          },
        });
      } catch {
        // Ignore if optional columns are not yet migrated
      }
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
        status: "PENDING",
        residentType: payload.memberType,
        societyId: society.id,
        unitId: unit.id,
      },
      submittedAt: membership.createdAt,
    };
  }, {
    maxWait: 10000,
    timeout: 20000,
  });
};

/**
 * Fetch current logged-in user profile, role, status, society details, and associated unit
 * GET /api/v1/users/me
 */
export const getMyProfile = async (userId: string) => {
  let user: any = null;
  try {
    user = await executeResilientPrismaQuery(() =>
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          society: {
            select: {
              id: true,
              name: true,
              code: true,
              propertyType: true,
              address: true,
              subscriptionPlan: true,
            },
          },
          unit: {
            include: {
              sectionWing: {
                select: { id: true, name: true },
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
          unitMembers: {
            include: {
              unit: {
                include: {
                  sectionWing: {
                    select: { id: true, name: true },
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
            orderBy: [{ isPrimaryHead: "desc" }, { createdAt: "desc" }],
          },
        },
      })
    );
  } catch {
    user = await executeResilientPrismaQuery(() =>
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          unitMembers: {
            include: {
              unit: {
                include: {
                  sectionWing: {
                    select: { id: true, name: true },
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
            orderBy: [{ isPrimaryHead: "desc" }, { createdAt: "desc" }],
          },
        },
      })
    );
  }

  if (!user) {
    throw new AppError(404, "User profile not found.");
  }

  const memberships = Array.isArray(user.unitMembers) ? user.unitMembers : [];
  const approvedMembership = memberships.find(
    (m: any) => m.approvalStatus === "APPROVED"
  );
  const primaryMembership = approvedMembership || memberships[0] || null;

  const isAdminOrGuard = [
    "SUPER_ADMIN",
    "SOCIETY_ADMIN",
    "SUB_ADMIN",
    "COMMITTEE",
    "GUARD",
    "SECURITY",
  ].includes((user.role || "").toUpperCase());

  const effectiveStatus = isAdminOrGuard
    ? "APPROVED"
    : approvedMembership
    ? "APPROVED"
    : user.status || primaryMembership?.approvalStatus || "PENDING";

  const effectiveResidentType =
    user.residentType || primaryMembership?.memberType || null;

  const resolvedUnit = user.unit || primaryMembership?.unit || null;
  const resolvedSociety =
    user.society ||
    resolvedUnit?.society ||
    primaryMembership?.unit?.society ||
    null;

  return {
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      name: user.fullName,
      fullName: user.fullName,
      role: user.role,
      status: effectiveStatus,
      residentType: effectiveResidentType,
      societyId: user.societyId || resolvedSociety?.id || null,
      unitId: user.unitId || resolvedUnit?.id || null,
      avatarUrl: user.avatarUrl || null,
      emergencyContact: user.emergencyContact || null,
      isActive: user.isActive,
      phoneVerified: true,
      createdAt: user.createdAt,
    },
    society: resolvedSociety
      ? {
          id: resolvedSociety.id,
          name: resolvedSociety.name,
          code: resolvedSociety.code,
          propertyType: resolvedSociety.propertyType,
          address: resolvedSociety.address,
        }
      : null,
    unit: resolvedUnit
      ? {
          id: resolvedUnit.id,
          unitNumber: resolvedUnit.unitNumber,
          floorNumber: resolvedUnit.floorNumber,
          occupancyStatus: resolvedUnit.occupancyStatus,
          sectionWingId: resolvedUnit.sectionWingId,
          sectionWingName: resolvedUnit.sectionWing?.name || null,
        }
      : null,
    primarySocietyId: user.societyId || resolvedSociety?.id || null,
    primaryUnitId: user.unitId || resolvedUnit?.id || null,
    memberships: memberships.map((m: any) => ({
      id: m.id,
      memberType: m.memberType,
      isPrimaryHead: m.isPrimaryHead,
      approvalStatus: m.approvalStatus,
      unit: m.unit
        ? {
            id: m.unit.id,
            unitNumber: m.unit.unitNumber,
            floorNumber: m.unit.floorNumber,
            occupancyStatus: m.unit.occupancyStatus,
            sectionWingId: m.unit.sectionWingId,
            sectionWingName: m.unit.sectionWing?.name,
            societyId: m.unit.societyId,
            societyName: m.unit.society?.name,
            societyCode: m.unit.society?.code,
            propertyType: m.unit.society?.propertyType,
            address: m.unit.society?.address,
          }
        : null,
    })),
  };
};

/**
 * Update personal profile info (name, residentType, emergencyContact, avatarUrl)
 * PUT /api/v1/users/me
 * SECURITY: Prevents privilege escalation (cannot modify role or approval status).
 */
export const updateMyProfile = async (
  userId: string,
  payload: UpdateMyProfileInput
) => {
  // Double-check against privilege escalation
  if (payload.role !== undefined || payload.status !== undefined) {
    throw new AppError(
      403,
      "Forbidden: You do not have permission to change your role or approval status."
    );
  }

  const nextFullName = (payload.fullName || payload.name || "").trim();
  const nextAvatarUrl =
    payload.avatarUrl !== undefined
      ? payload.avatarUrl?.trim() || null
      : payload.avatar !== undefined
      ? payload.avatar?.trim() || null
      : undefined;
  const nextEmergencyContact =
    payload.emergencyContact !== undefined
      ? payload.emergencyContact?.trim() || null
      : undefined;
  const nextResidentType =
    payload.residentType !== undefined ? payload.residentType : undefined;
  const nextEmail =
    payload.email !== undefined
      ? payload.email?.trim().toLowerCase() || null
      : undefined;

  if (nextEmail) {
    const emailOwner = await executeResilientPrismaQuery(() =>
      prisma.user.findFirst({
        where: {
          email: { equals: nextEmail, mode: "insensitive" },
          NOT: { id: userId },
        },
        select: { id: true },
      })
    );
    if (emailOwner) {
      throw new AppError(409, "Email address is already in use by another account.");
    }
  }

  try {
    await executeResilientPrismaQuery(() =>
      prisma.user.update({
        where: { id: userId },
        data: {
          ...(nextFullName ? { fullName: nextFullName } : {}),
          ...(nextEmail !== undefined ? { email: nextEmail } : {}),
          ...(nextResidentType !== undefined ? { residentType: nextResidentType } : {}),
          ...(nextEmergencyContact !== undefined
            ? { emergencyContact: nextEmergencyContact }
            : {}),
          ...(nextAvatarUrl !== undefined ? { avatarUrl: nextAvatarUrl } : {}),
        },
      })
    );
  } catch {
    // Fallback if optional columns are not yet pushed to DB
    await executeResilientPrismaQuery(() =>
      prisma.user.update({
        where: { id: userId },
        data: {
          ...(nextFullName ? { fullName: nextFullName } : {}),
          ...(nextEmail !== undefined ? { email: nextEmail } : {}),
        },
      })
    );
  }

  // Sync residentType (OWNER / TENANT) to primary UnitMember record if present
  if (nextResidentType) {
    const primaryMembership = await executeResilientPrismaQuery(() =>
      prisma.unitMember.findFirst({
        where: { userId },
        orderBy: [{ isPrimaryHead: "desc" }, { createdAt: "desc" }],
      })
    );
    if (primaryMembership) {
      await executeResilientPrismaQuery(() =>
        prisma.unitMember.update({
          where: { id: primaryMembership.id },
          data: { memberType: nextResidentType },
        })
      );
    }
  }

  return await getMyProfile(userId);
};

/**
 * Retrieve pending join requests and pending resident onboarding accounts scoped to a society
 */
export const getPendingApprovals = async (societyId?: string) => {
  const pendingRequests = await executeResilientPrismaQuery(() =>
    prisma.unitMember.findMany({
      where: {
        approvalStatus: "PENDING",
        ...(societyId
          ? {
              unit: {
                societyId,
              },
            }
          : {}),
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
    })
  );

  const mappedUnitRequests = (pendingRequests || []).map((req) => ({
    id: req.user.id,
    membershipId: req.id,
    fullName: req.user.fullName,
    name: req.user.fullName,
    phone: req.user.phone,
    email: req.user.email,
    unitNumber: req.unit.unitNumber,
    wingName: req.unit.sectionWing?.name || "Main Wing",
    memberType: req.memberType,
    residentType: req.memberType,
    approvalStatus: req.approvalStatus,
    status: req.approvalStatus,
    createdAt: req.createdAt,
    user: {
      ...req.user,
      status: "PENDING",
      residentType: req.memberType,
    },
    unit: {
      id: req.unit.id,
      unitNumber: req.unit.unitNumber,
      floorNumber: req.unit.floorNumber,
      occupancyStatus: req.unit.occupancyStatus,
      sectionWing: req.unit.sectionWing,
    },
    familyMembers: req.unit.familyMembers,
  }));

  // Also include standalone User records with status === 'PENDING' that have no pending UnitMember row yet
  try {
    const existingUserIds = new Set(mappedUnitRequests.map((r) => r.user.id));
    const pendingUsers = await executeResilientPrismaQuery(() =>
      prisma.user.findMany({
        where: {
          status: "PENDING",
          role: "RESIDENT",
          ...(societyId
            ? {
                OR: [{ societyId }, { societyId: null }],
              }
            : {}),
        },
        include: {
          unit: {
            include: {
              sectionWing: { select: { id: true, name: true } },
              familyMembers: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      })
    );

    for (const u of pendingUsers || []) {
      if (!existingUserIds.has(u.id)) {
        mappedUnitRequests.push({
          id: u.id,
          membershipId: u.id,
          fullName: u.fullName,
          name: u.fullName,
          phone: u.phone,
          email: u.email,
          unitNumber: u.unit?.unitNumber || "Unassigned",
          wingName: u.unit?.sectionWing?.name || "Pending Unit",
          memberType: u.residentType || "OWNER",
          residentType: u.residentType || "OWNER",
          approvalStatus: "PENDING",
          status: "PENDING",
          createdAt: u.createdAt,
          user: {
            id: u.id,
            fullName: u.fullName,
            phone: u.phone,
            email: u.email,
            role: u.role,
            createdAt: u.createdAt,
            status: u.status || "PENDING",
            residentType: u.residentType || "OWNER",
          },
          unit: u.unit
            ? {
                id: u.unit.id,
                unitNumber: u.unit.unitNumber,
                floorNumber: u.unit.floorNumber,
                occupancyStatus: u.unit.occupancyStatus,
                sectionWing: u.unit.sectionWing,
              }
            : ({
                id: "",
                unitNumber: "Unassigned",
                floorNumber: null,
                occupancyStatus: "VACANT",
                sectionWing: { id: "", name: "Pending Unit Assignment" },
              } as any),
          familyMembers: u.unit?.familyMembers || [],
        });
      }
    }
  } catch {
    // Ignore if optional User.status column is not yet migrated
  }

  return mappedUnitRequests;
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

      // Update User status and association
      try {
        await tx.user.update({
          where: { id: membership.userId },
          data: {
            status: "APPROVED",
            residentType: membership.memberType,
            societyId: membership.unit.societyId,
            unitId: membership.unitId,
          },
        });
      } catch {
        // Fallback if optional columns not yet pushed
      }

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
        status: updatedMembership.approvalStatus,
        isPrimaryHead: updatedMembership.isPrimaryHead,
        unit: {
          id: membership.unit.id,
          unitNumber: membership.unit.unitNumber,
          occupancyStatus: newOccupancyStatus,
          sectionWing: membership.unit.sectionWing.name,
        },
        user: {
          ...membership.user,
          status: "APPROVED",
          residentType: membership.memberType,
        },
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

      try {
        await tx.user.update({
          where: { id: membership.userId },
          data: {
            status: "REJECTED",
          },
        });
      } catch {
        // Fallback if optional columns not yet pushed
      }

      return {
        message: "Resident join request rejected.",
        membershipId: updatedMembership.id,
        approvalStatus: updatedMembership.approvalStatus,
        status: updatedMembership.approvalStatus,
        rejectionReason: updatedMembership.deactivationReason,
        unit: {
          id: membership.unit.id,
          unitNumber: membership.unit.unitNumber,
          sectionWing: membership.unit.sectionWing.name,
        },
        user: {
          ...membership.user,
          status: "REJECTED",
        },
      };
    }
  });
};

/**
 * Admin: Approve or reject a resident onboarding request by userId or membershipId
 * PATCH /api/v1/admin/users/:id/status
 */
export const adminUpdateUserStatus = async (
  targetId: string,
  decision: AdminUpdateUserStatusInput,
  adminSocietyId?: string
) => {
  // 1. Check if targetId matches a UnitMember record directly
  const existingMembership = await executeResilientPrismaQuery(() =>
    prisma.unitMember.findUnique({
      where: { id: targetId },
      select: { id: true, approvalStatus: true },
    })
  );

  if (existingMembership && existingMembership.approvalStatus === "PENDING" && (decision.status === "APPROVED" || decision.status === "REJECTED")) {
    return await reviewJoinRequest(
      existingMembership.id,
      {
        status: decision.status,
        rejectionReason: decision.rejectionReason,
      },
      adminSocietyId
    );
  }

  // 2. Otherwise resolve targetId as a User ID
  const user = await executeResilientPrismaQuery(() =>
    prisma.user.findUnique({
      where: { id: targetId },
      include: {
        unitMembers: {
          orderBy: { createdAt: "desc" },
          include: {
            unit: {
              include: {
                sectionWing: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })
  );

  if (!user) {
    throw new AppError(404, "Resident user or onboarding request not found.");
  }

  const pendingMembership = user.unitMembers.find(
    (m) => m.approvalStatus === "PENDING"
  );

  if (
    pendingMembership &&
    (decision.status === "APPROVED" || decision.status === "REJECTED")
  ) {
    const res = await reviewJoinRequest(
      pendingMembership.id,
      {
        status: decision.status,
        rejectionReason: decision.rejectionReason,
      },
      adminSocietyId
    );

    if (decision.role || decision.residentType) {
      try {
        await executeResilientPrismaQuery(() =>
          prisma.user.update({
            where: { id: user.id },
            data: {
              ...(decision.role ? { role: decision.role } : {}),
              ...(decision.residentType
                ? { residentType: decision.residentType }
                : {}),
            },
          })
        );
      } catch {
        // Ignore if optional column is migrating
      }
    }

    return res;
  }

  // 3. Update User status/role directly (e.g., standalone resident signup without unitMember yet)
  let updatedUser: any = user;
  try {
    updatedUser = await executeResilientPrismaQuery(() =>
      prisma.user.update({
        where: { id: user.id },
        data: {
          status: decision.status,
          ...(decision.role ? { role: decision.role } : {}),
          ...(decision.residentType !== undefined
            ? { residentType: decision.residentType }
            : {}),
          ...(decision.unitId !== undefined ? { unitId: decision.unitId } : {}),
          ...(adminSocietyId ? { societyId: adminSocietyId } : {}),
        },
      })
    );
  } catch {
    if (decision.role) {
      updatedUser = await executeResilientPrismaQuery(() =>
        prisma.user.update({
          where: { id: user.id },
          data: { role: decision.role },
        })
      );
    }
  }

  return {
    message: `User onboarding status updated to ${decision.status}.`,
    status: decision.status,
    approvalStatus: decision.status,
    user: {
      id: updatedUser.id,
      fullName: updatedUser.fullName,
      phone: updatedUser.phone,
      email: updatedUser.email,
      role: updatedUser.role,
      status: decision.status,
      residentType: updatedUser.residentType || decision.residentType || null,
    },
  };
};

/**
 * Fetch hierarchical society directory (Wings -> Units -> Members -> Family)
 * STRICT PRIVACY GUARD: Never expose phone numbers or personal email addresses in directory responses.
 */
export const getSocietyDirectory = async (societyId: string) => {
  const society = await executeResilientPrismaQuery(() =>
    prisma.society.findUnique({
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
                    isEmergencyContact: true,
                  },
                },
              },
            },
          },
        },
      },
    })
  );

  if (!society) {
    throw new AppError(404, "Society not found.");
  }

  // Flat list of approved residents with family members and strict privacy guard (zero phone/email exposure)
  const approvedMembersList: Array<{
    id: string;
    userId: string;
    fullName: string;
    role: string;
    wingId: string;
    wingName: string;
    unitId: string;
    unitNumber: string;
    floorNumber: number | null;
    residentType: string;
    isPrimaryHead: boolean;
    memberCount: number;
    familyMembers: Array<{
      id: string;
      fullName: string;
      relation: string;
      age: number | null;
      isEmergencyContact: boolean;
    }>;
  }> = [];

  for (const section of society.sections) {
    for (const u of section.units) {
      const safeFamily = (u.familyMembers || []).map((fm) => ({
        id: fm.id,
        fullName: fm.fullName,
        relation: fm.relation,
        age: fm.age,
        isEmergencyContact: fm.isEmergencyContact,
      }));

      for (const m of u.members) {
        approvedMembersList.push({
          id: m.id,
          userId: m.user.id,
          fullName: m.user.fullName,
          role: m.user.role,
          wingId: section.id,
          wingName: section.name,
          unitId: u.id,
          unitNumber: u.unitNumber,
          floorNumber: u.floorNumber,
          residentType: m.memberType,
          isPrimaryHead: m.isPrimaryHead,
          memberCount: 1 + safeFamily.length,
          familyMembers: safeFamily,
        });
      }
    }
  }

  return {
    society: {
      id: society.id,
      name: society.name,
      code: society.code,
      propertyType: society.propertyType,
      address: society.address,
    },
    members: approvedMembersList,
    sections: society.sections.map((section) => ({
      id: section.id,
      name: section.name,
      totalUnits: section.units.length,
      units: section.units.map((u) => {
        const primaryMember =
          u.members.find((m) => m.isPrimaryHead) || u.members[0] || null;

        const safeFamily = u.familyMembers.map((fm) => ({
          id: fm.id,
          fullName: fm.fullName,
          relation: fm.relation,
          age: fm.age,
          isEmergencyContact: fm.isEmergencyContact,
        }));

        return {
          id: u.id,
          unitNumber: u.unitNumber,
          floorNumber: u.floorNumber,
          occupancyStatus: u.occupancyStatus,
          memberCount: (u.members.length > 0 ? 1 : 0) + safeFamily.length,
          primaryResident: primaryMember
            ? {
                id: primaryMember.user.id,
                fullName: primaryMember.user.fullName,
                memberType: primaryMember.memberType,
              }
            : null,
          members: u.members.map((m) => ({
            id: m.id,
            memberType: m.memberType,
            isPrimaryHead: m.isPrimaryHead,
            user: {
              id: m.user.id,
              fullName: m.user.fullName,
              role: m.user.role,
            },
          })),
          familyMembers: safeFamily,
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
