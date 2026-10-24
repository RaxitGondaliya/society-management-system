import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import { AuthUserPayload } from "../../types/express";
import {
  CreateStaffInput,
  AssignFlatInput,
  StaffAttendanceInput,
  StaffRatingInput,
  StaffQueryInput,
} from "./staff.validation";

export class StaffService {
  /**
   * Helper to resolve societyId for caller
   */
  private static async resolveSocietyId(user: AuthUserPayload): Promise<string> {
    if (user.societyId) {
      return user.societyId;
    }

    const membership = await prisma.unitMember.findFirst({
      where: { userId: user.id, approvalStatus: "APPROVED" },
      include: { unit: true },
    });

    if (membership?.unit?.societyId) {
      return membership.unit.societyId;
    }

    const society = await prisma.society.findFirst();
    if (!society) {
      throw new AppError(404, "No society found in system");
    }
    return society.id;
  }

  /**
   * 1. Register Staff Member (Admin or Resident sponsoring domestic help)
   */
  static async registerStaff(user: AuthUserPayload, input: CreateStaffInput) {
    const societyId = await this.resolveSocietyId(user);

    // Check phone uniqueness within society for this staff category
    const existing = await prisma.staffMember.findFirst({
      where: {
        societyId,
        phone: input.phone,
        staffType: input.staffType,
      },
    });

    if (existing) {
      throw new AppError(
        409,
        `A staff member with phone '${input.phone}' is already registered as '${input.staffType}' in this society.`
      );
    }

    // Generate unique 6-digit staff pass / identification code (e.g. STF-1029)
    const count = await prisma.staffMember.count({ where: { societyId } });
    const seq = String(count + 1).padStart(4, "0");
    const staffCode = `STF-${seq}`;

    // Create staff profile
    const staff = await prisma.staffMember.create({
      data: {
        societyId,
        staffCode,
        fullName: input.fullName,
        phone: input.phone,
        staffType: input.staffType,
        idProofType: input.idProofType || null,
        idProofNumber: input.idProofNumber || null,
        policeVerificationStatus: input.policeVerificationStatus || "PENDING",
        photoUrl: input.photoUrl || null,
        emergencyContact: input.emergencyContact || null,
        isActive: true,
      },
    });

    // If unitId was passed (e.g. resident registering their maid directly), map to unit
    let initialAssignment = null;
    if (input.unitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: input.unitId },
      });

      if (!unit || unit.societyId !== societyId) {
        throw new AppError(404, "Target unit not found in this society.");
      }

      if (user.role === "RESIDENT") {
        const isMember = await prisma.unitMember.findFirst({
          where: { unitId: input.unitId, userId: user.id, approvalStatus: "APPROVED" },
        });
        if (!isMember) {
          throw new AppError(403, "You can only assign staff to your own registered flat.");
        }
      }

      initialAssignment = await prisma.staffUnitAssignment.create({
        data: {
          staffId: staff.id,
          unitId: input.unitId,
          jobDescription: input.jobDescription || null,
          isActive: true,
        },
        include: {
          unit: {
            select: {
              id: true,
              unitNumber: true,
              sectionWing: { select: { name: true } },
            },
          },
        },
      });
    }

    return {
      staff,
      initialAssignment,
    };
  }

  /**
   * 2. Assign Staff to Flat (Supports multi-flat mapping)
   */
  static async assignStaffToFlat(user: AuthUserPayload, input: AssignFlatInput) {
    const societyId = await this.resolveSocietyId(user);

    const staff = await prisma.staffMember.findUnique({
      where: { id: input.staffId },
    });

    if (!staff || staff.societyId !== societyId) {
      throw new AppError(404, "Staff member not found in this society.");
    }

    if (!staff.isActive) {
      throw new AppError(400, "Cannot assign deactivated staff member.");
    }

    const unit = await prisma.unit.findUnique({
      where: { id: input.unitId },
    });

    if (!unit || unit.societyId !== societyId) {
      throw new AppError(404, "Target unit not found in this society.");
    }

    if (user.role === "RESIDENT") {
      const isMember = await prisma.unitMember.findFirst({
        where: { unitId: input.unitId, userId: user.id, approvalStatus: "APPROVED" },
      });
      if (!isMember) {
        throw new AppError(403, "You can only assign staff to your own registered flat.");
      }
    }

    const existingAssignment = await prisma.staffUnitAssignment.findUnique({
      where: {
        staffId_unitId: {
          staffId: input.staffId,
          unitId: input.unitId,
        },
      },
    });

    if (existingAssignment) {
      if (existingAssignment.isActive) {
        throw new AppError(409, "This staff member is already assigned to this flat.");
      } else {
        const reactivated = await prisma.staffUnitAssignment.update({
          where: { id: existingAssignment.id },
          data: {
            isActive: true,
            jobDescription: input.jobDescription || existingAssignment.jobDescription,
          },
          include: {
            staff: { select: { id: true, staffCode: true, fullName: true, staffType: true, phone: true } },
            unit: { select: { id: true, unitNumber: true, sectionWing: { select: { name: true } } } },
          },
        });
        return reactivated;
      }
    }

    const assignment = await prisma.staffUnitAssignment.create({
      data: {
        staffId: input.staffId,
        unitId: input.unitId,
        jobDescription: input.jobDescription || null,
        isActive: true,
      },
      include: {
        staff: { select: { id: true, staffCode: true, fullName: true, staffType: true, phone: true } },
        unit: { select: { id: true, unitNumber: true, sectionWing: { select: { name: true } } } },
      },
    });

    return assignment;
  }

  /**
   * 3. Unassign Staff from Flat
   */
  static async unassignStaffFromFlat(user: AuthUserPayload, unitStaffId: string) {
    const assignment = await prisma.staffUnitAssignment.findUnique({
      where: { id: unitStaffId },
      include: { staff: true, unit: true },
    });

    if (!assignment) {
      throw new AppError(404, "Staff flat assignment not found.");
    }

    if (user.role === "RESIDENT") {
      const isMember = await prisma.unitMember.findFirst({
        where: { unitId: assignment.unitId, userId: user.id, approvalStatus: "APPROVED" },
      });
      if (!isMember) {
        throw new AppError(403, "You can only unassign staff from your own flat.");
      }
    }

    await prisma.staffUnitAssignment.update({
      where: { id: unitStaffId },
      data: { isActive: false },
    });

    return {
      message: `Staff '${assignment.staff.fullName}' unassigned from Flat ${assignment.unit.unitNumber}.`,
      unitStaffId,
    };
  }

  /**
   * 4. Log Daily Staff Attendance (Gate Check-In / Check-Out)
   */
  static async logStaffAttendance(user: AuthUserPayload, input: StaffAttendanceInput) {
    const societyId = await this.resolveSocietyId(user);

    const staff = await prisma.staffMember.findFirst({
      where: {
        societyId,
        OR: [
          ...(input.staffId ? [{ id: input.staffId }] : []),
          ...(input.passcode ? [{ staffCode: input.passcode }] : []),
        ],
      },
    });

    if (!staff) {
      throw new AppError(404, "Staff member not found with the provided credentials.");
    }

    if (!staff.isActive) {
      throw new AppError(400, "This staff member's profile is deactivated.");
    }

    const now = new Date();
    const todayMidnight = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);

    if (input.action === "CHECK_IN") {
      // Check if already clocked in today without checkout
      const activeCheckIn = await prisma.staffAttendance.findFirst({
        where: {
          staffId: staff.id,
          attendanceDate: todayMidnight,
          checkOutTime: null,
        },
      });

      if (activeCheckIn) {
        throw new AppError(
          409,
          `Staff '${staff.fullName}' (${staff.staffCode}) is already checked in at ${activeCheckIn.checkInTime.toISOString()}.`
        );
      }

      const attendance = await prisma.staffAttendance.create({
        data: {
          staffId: staff.id,
          societyId,
          attendanceDate: todayMidnight,
          checkInTime: now,
          guardUserId: user.id,
        },
        include: {
          staff: {
            select: {
              id: true,
              staffCode: true,
              fullName: true,
              staffType: true,
              phone: true,
              photoUrl: true,
            },
          },
        },
      });

      return {
        action: "CHECKED_IN",
        staff: attendance.staff,
        checkInTime: attendance.checkInTime,
        attendanceId: attendance.id,
      };
    } else {
      // CHECK_OUT
      const activeCheckIn = await prisma.staffAttendance.findFirst({
        where: {
          staffId: staff.id,
          attendanceDate: todayMidnight,
          checkOutTime: null,
        },
        orderBy: { checkInTime: "desc" },
      });

      if (!activeCheckIn) {
        throw new AppError(
          404,
          `Staff '${staff.fullName}' (${staff.staffCode}) does not have an active check-in record for today.`
        );
      }

      const durationMinutes = Math.max(
        1,
        Math.round((now.getTime() - activeCheckIn.checkInTime.getTime()) / (1000 * 60))
      );

      const updated = await prisma.staffAttendance.update({
        where: { id: activeCheckIn.id },
        data: {
          checkOutTime: now,
          durationMinutes,
        },
        include: {
          staff: {
            select: {
              id: true,
              staffCode: true,
              fullName: true,
              staffType: true,
              phone: true,
            },
          },
        },
      });

      return {
        action: "CHECKED_OUT",
        staff: updated.staff,
        checkInTime: updated.checkInTime,
        checkOutTime: updated.checkOutTime,
        durationMinutes: updated.durationMinutes,
        attendanceId: updated.id,
      };
    }
  }

  /**
   * 5. Get Real-Time Active Staff on Premises (Security Dashboard)
   */
  static async getActiveStaffOnPremises(user: AuthUserPayload) {
    const societyId = await this.resolveSocietyId(user);
    const now = new Date();
    const todayMidnight = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);

    const activeRecords = await prisma.staffAttendance.findMany({
      where: {
        societyId,
        attendanceDate: todayMidnight,
        checkOutTime: null,
      },
      include: {
        staff: {
          include: {
            assignedUnits: {
              where: { isActive: true },
              include: {
                unit: { select: { unitNumber: true, sectionWing: { select: { name: true } } } },
              },
            },
          },
        },
      },
      orderBy: { checkInTime: "desc" },
    });

    const staffList = activeRecords.map((r) => {
      const minutesInside = Math.max(
        1,
        Math.round((now.getTime() - r.checkInTime.getTime()) / (1000 * 60))
      );

      const assignedFlats = r.staff.assignedUnits.map((au) =>
        `${au.unit.sectionWing?.name || ""} - ${au.unit.unitNumber}`.trim()
      );

      return {
        attendanceId: r.id,
        staffId: r.staff.id,
        staffCode: r.staff.staffCode,
        fullName: r.staff.fullName,
        staffType: r.staff.staffType,
        phone: r.staff.phone,
        photoUrl: r.staff.photoUrl,
        checkInTime: r.checkInTime,
        minutesInside,
        assignedFlats,
      };
    });

    return {
      totalActiveStaff: staffList.length,
      staffList,
    };
  }

  /**
   * 6. Submit Staff Review & Rating (Resident)
   */
  static async addStaffReview(
    user: AuthUserPayload,
    staffId: string,
    input: StaffRatingInput
  ) {
    const societyId = await this.resolveSocietyId(user);

    const staff = await prisma.staffMember.findUnique({
      where: { id: staffId },
    });

    if (!staff || staff.societyId !== societyId) {
      throw new AppError(404, "Staff member not found in this society.");
    }

    // Resolve target unit
    let targetUnitId = input.unitId;
    if (!targetUnitId && user.role === "RESIDENT") {
      const membership = await prisma.unitMember.findFirst({
        where: { userId: user.id, approvalStatus: "APPROVED" },
      });
      if (membership) {
        targetUnitId = membership.unitId;
      }
    }

    if (!targetUnitId) {
      throw new AppError(400, "unitId is required to associate this review.");
    }

    // Verify staff is assigned to resident's flat
    if (user.role === "RESIDENT") {
      const isAssigned = await prisma.staffUnitAssignment.findFirst({
        where: {
          staffId,
          unitId: targetUnitId,
          isActive: true,
        },
      });

      if (!isAssigned) {
        throw new AppError(
          403,
          "You can only submit reviews for staff members who are currently assigned to your flat."
        );
      }
    }

    // Upsert review record
    const review = await prisma.staffReview.upsert({
      where: {
        staffId_unitId_userId: {
          staffId,
          unitId: targetUnitId,
          userId: user.id,
        },
      },
      update: {
        rating: input.rating,
        review: input.review || null,
      },
      create: {
        staffId,
        unitId: targetUnitId,
        userId: user.id,
        rating: input.rating,
        review: input.review || null,
      },
    });

    // Recompute cumulative average rating
    const allReviews = await prisma.staffReview.findMany({
      where: { staffId },
    });

    const totalReviews = allReviews.length;
    const avgRating =
      totalReviews > 0
        ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
        : 0;

    const updatedStaff = await prisma.staffMember.update({
      where: { id: staffId },
      data: {
        rating: avgRating,
        totalReviews,
      },
    });

    return {
      review,
      staff: {
        id: updatedStaff.id,
        fullName: updatedStaff.fullName,
        rating: updatedStaff.rating,
        totalReviews: updatedStaff.totalReviews,
      },
    };
  }

  /**
   * 7. List Society Staff Directory (With Multi-Filter & Assigned Flats)
   */
  static async listSocietyStaff(user: AuthUserPayload, query: StaffQueryInput) {
    const societyId = await this.resolveSocietyId(user);
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      societyId,
    };

    if (query.staffType) where.staffType = query.staffType;
    if (query.policeVerificationStatus) where.policeVerificationStatus = query.policeVerificationStatus;
    if (query.isActive !== undefined) {
      where.isActive = query.isActive === true || (query.isActive as unknown) === "true";
    }
    if (query.unitId) {
      where.assignedUnits = {
        some: {
          unitId: query.unitId,
          isActive: true,
        },
      };
    }

    const [total, staffList] = await Promise.all([
      prisma.staffMember.count({ where }),
      prisma.staffMember.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ rating: "desc" }, { fullName: "asc" }],
        include: {
          assignedUnits: {
            where: { isActive: true },
            include: {
              unit: {
                select: {
                  id: true,
                  unitNumber: true,
                  sectionWing: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const formattedStaff = staffList.map((s) => ({
      ...s,
      assignedUnits: s.assignedUnits.map((au) => ({
        unitStaffId: au.id,
        unitId: au.unit.id,
        unitNumber: au.unit.unitNumber,
        wing: au.unit.sectionWing?.name || "",
        jobDescription: au.jobDescription,
        assignedAt: au.assignedAt,
      })),
    }));

    return {
      staff: formattedStaff,
      pagination: {
        totalRecords: total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
