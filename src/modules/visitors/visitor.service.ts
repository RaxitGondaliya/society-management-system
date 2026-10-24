import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import {
  CreateVisitorEntryInput,
  PreApproveGuestInput,
  VisitorDecisionInput,
  VisitorQueryParams,
} from "./visitor.validation";

/**
 * Log visitor at gate by security guard or admin
 */
export const logVisitorAtGate = async (
  payload: CreateVisitorEntryInput,
  guardUser: { id: string; societyId?: string }
) => {
  const societyId = payload.societyId || guardUser.societyId;

  if (!societyId) {
    throw new AppError(
      400,
      "Society ID missing. Please specify societyId or login with society context."
    );
  }

  // 1. Verify target unit belongs to this society
  const unit = await prisma.unit.findUnique({
    where: { id: payload.unitId },
    include: {
      sectionWing: { select: { name: true } },
      society: { select: { id: true, name: true, code: true } },
      members: {
        where: { approvalStatus: "APPROVED" },
        select: {
          id: true,
          isPrimaryHead: true,
          memberType: true,
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!unit || unit.societyId !== societyId) {
    throw new AppError(404, "Target unit was not found within this society.");
  }

  // 2. Check for matching pre-approved pass
  let preApprovedVisitor = null;

  if (payload.passcode) {
    preApprovedVisitor = await prisma.visitor.findFirst({
      where: {
        unitId: unit.id,
        preApprovedPasscode: payload.passcode.trim(),
        status: "APPROVED",
        exitTime: null,
      },
    });
  } else if (payload.phone) {
    preApprovedVisitor = await prisma.visitor.findFirst({
      where: {
        unitId: unit.id,
        phone: payload.phone.trim(),
        status: "APPROVED",
        exitTime: null,
        preApprovedPasscode: { not: null },
      },
    });
  }

  if (preApprovedVisitor) {
    const updated = await prisma.visitor.update({
      where: { id: preApprovedVisitor.id },
      data: {
        guardUserId: guardUser.id,
        entryTime: new Date(),
        vehicleNumber: payload.vehicleNumber || preApprovedVisitor.vehicleNumber,
        photoUrl: payload.photoUrl || preApprovedVisitor.photoUrl,
        category: payload.category || preApprovedVisitor.category,
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

    return {
      message: "Pre-approved guest verified. Entry authorized.",
      isPreApproved: true,
      status: "APPROVED",
      visitor: {
        id: updated.id,
        visitorName: updated.visitorName,
        phone: updated.phone,
        category: updated.category,
        vehicleNumber: updated.vehicleNumber,
        status: updated.status,
        entryTime: updated.entryTime,
        passcode: updated.preApprovedPasscode,
        unit: {
          id: updated.unit.id,
          unitNumber: updated.unit.unitNumber,
          wing: updated.unit.sectionWing.name,
        },
      },
      targetResidents: unit.members,
    };
  }

  // 3. New walk-in visitor entry (awaiting resident approval)
  const newVisitor = await prisma.visitor.create({
    data: {
      societyId,
      unitId: unit.id,
      guardUserId: guardUser.id,
      visitorName: payload.visitorName,
      phone: payload.phone,
      category: payload.category || "GUEST",
      vehicleNumber: payload.vehicleNumber || null,
      photoUrl: payload.photoUrl || null,
      status: "PENDING_APPROVAL",
      entryTime: new Date(),
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

  return {
    message: "Visitor entry logged. Approval request sent to resident.",
    isPreApproved: false,
    status: newVisitor.status,
    visitor: {
      id: newVisitor.id,
      visitorName: newVisitor.visitorName,
      phone: newVisitor.phone,
      category: newVisitor.category,
      vehicleNumber: newVisitor.vehicleNumber,
      status: newVisitor.status,
      entryTime: newVisitor.entryTime,
      unit: {
        id: newVisitor.unit.id,
        unitNumber: newVisitor.unit.unitNumber,
        wing: newVisitor.unit.sectionWing.name,
      },
    },
    targetResidents: unit.members,
  };
};

/**
 * Pre-approve guest by resident for their unit
 */
export const preApproveVisitor = async (
  payload: PreApproveGuestInput,
  residentUser: { id: string; societyId?: string; unitId?: string }
) => {
  const membership = await prisma.unitMember.findFirst({
    where: {
      userId: residentUser.id,
      approvalStatus: "APPROVED",
      ...(payload.unitId ? { unitId: payload.unitId } : {}),
    },
    include: {
      unit: {
        select: {
          id: true,
          societyId: true,
          unitNumber: true,
          sectionWing: { select: { name: true } },
        },
      },
    },
  });

  if (!membership) {
    throw new AppError(
      403,
      "Forbidden: You do not have an approved residency in this unit."
    );
  }

  // Generate unique 6-digit numeric passcode
  const passcode = Math.floor(100000 + Math.random() * 900000).toString();

  const visitor = await prisma.visitor.create({
    data: {
      societyId: membership.unit.societyId,
      unitId: membership.unit.id,
      visitorName: payload.visitorName,
      phone: payload.phone,
      category: payload.category || "GUEST",
      vehicleNumber: payload.vehicleNumber || null,
      preApprovedPasscode: passcode,
      status: "APPROVED",
      entryTime: payload.expectedArrival
        ? new Date(payload.expectedArrival)
        : new Date(),
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

  return {
    message: "Visitor pre-approved successfully.",
    passcode,
    visitor: {
      id: visitor.id,
      visitorName: visitor.visitorName,
      phone: visitor.phone,
      category: visitor.category,
      vehicleNumber: visitor.vehicleNumber,
      status: visitor.status,
      expectedArrival: visitor.entryTime,
      unit: {
        id: visitor.unit.id,
        unitNumber: visitor.unit.unitNumber,
        wing: visitor.unit.sectionWing.name,
      },
    },
  };
};

/**
 * Resident approves or denies pending visitor entry
 */
export const residentDecisionOnVisitor = async (
  visitorId: string,
  decision: VisitorDecisionInput,
  callerUser: { id: string; role: string }
) => {
  const visitor = await prisma.visitor.findUnique({
    where: { id: visitorId },
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

  if (!visitor) {
    throw new AppError(404, "Visitor entry not found.");
  }

  // Resident verification for target unit
  if (callerUser.role === "RESIDENT") {
    const isMember = await prisma.unitMember.findFirst({
      where: {
        unitId: visitor.unitId,
        userId: callerUser.id,
        approvalStatus: "APPROVED",
      },
    });

    if (!isMember) {
      throw new AppError(
        403,
        "Forbidden: You are not authorized to decide on visitors for this unit."
      );
    }
  }

  // Map status (REJECTED -> DENIED)
  let finalStatus: string = decision.status;
  if (decision.status === "REJECTED") {
    finalStatus = "DENIED";
  }

  const updated = await prisma.visitor.update({
    where: { id: visitor.id },
    data: {
      status: finalStatus,
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

  return {
    message: `Visitor entry ${finalStatus.toLowerCase()}.`,
    status: updated.status,
    visitor: {
      id: updated.id,
      visitorName: updated.visitorName,
      phone: updated.phone,
      status: updated.status,
      unit: {
        id: updated.unit.id,
        unitNumber: updated.unit.unitNumber,
        wing: updated.unit.sectionWing.name,
      },
    },
  };
};

/**
 * Checkout visitor when exiting through the gate
 */
export const checkoutVisitor = async (
  visitorId: string,
  guardUser: { id: string; societyId?: string }
) => {
  const visitor = await prisma.visitor.findUnique({
    where: { id: visitorId },
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

  if (!visitor) {
    throw new AppError(404, "Visitor entry not found.");
  }

  if (guardUser.societyId && visitor.societyId !== guardUser.societyId) {
    throw new AppError(
      403,
      "Forbidden: You do not have permission to checkout visitors from another society."
    );
  }

  if (visitor.exitTime !== null) {
    throw new AppError(400, "Visitor has already checked out.");
  }

  const exitTime = new Date();
  const stayMinutes = Math.max(
    1,
    Math.round((exitTime.getTime() - new Date(visitor.entryTime).getTime()) / 60000)
  );

  const updated = await prisma.visitor.update({
    where: { id: visitor.id },
    data: {
      exitTime,
    },
  });

  return {
    message: "Visitor checkout recorded successfully.",
    visitorId: updated.id,
    visitorName: updated.visitorName,
    entryTime: updated.entryTime,
    exitTime: updated.exitTime,
    durationMinutes: stayMinutes,
    unit: {
      id: visitor.unit.id,
      unitNumber: visitor.unit.unitNumber,
      wing: visitor.unit.sectionWing.name,
    },
  };
};

/**
 * List all currently on-premises active visitors
 */
export const listActiveVisitors = async (societyId: string) => {
  const activeVisitors = await prisma.visitor.findMany({
    where: {
      societyId,
      exitTime: null,
      status: { in: ["APPROVED", "CHECKED_IN"] },
    },
    orderBy: { entryTime: "desc" },
    include: {
      unit: {
        select: {
          id: true,
          unitNumber: true,
          sectionWing: { select: { name: true } },
        },
      },
      guardUser: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });

  return {
    totalActiveVisitors: activeVisitors.length,
    visitors: activeVisitors.map((v) => ({
      id: v.id,
      visitorName: v.visitorName,
      phone: v.phone,
      category: v.category,
      vehicleNumber: v.vehicleNumber,
      status: v.status,
      entryTime: v.entryTime,
      unit: {
        id: v.unit.id,
        unitNumber: v.unit.unitNumber,
        wing: v.unit.sectionWing.name,
      },
      loggedByGuard: v.guardUser ? v.guardUser.fullName : null,
    })),
  };
};

/**
 * Get visitor history for a specific unit (Resident view)
 */
export const getUnitVisitorHistory = async (
  unitId: string,
  societyId?: string
) => {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      sectionWing: { select: { name: true } },
    },
  });

  if (!unit) {
    throw new AppError(404, "Unit not found.");
  }

  if (societyId && unit.societyId !== societyId) {
    throw new AppError(
      403,
      "Forbidden: You do not have access to this unit's visitor logs."
    );
  }

  const visitors = await prisma.visitor.findMany({
    where: { unitId },
    orderBy: { entryTime: "desc" },
    include: {
      guardUser: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });

  return {
    unit: {
      id: unit.id,
      unitNumber: unit.unitNumber,
      wing: unit.sectionWing.name,
    },
    totalVisitors: visitors.length,
    visitors: visitors.map((v) => ({
      id: v.id,
      visitorName: v.visitorName,
      phone: v.phone,
      category: v.category,
      vehicleNumber: v.vehicleNumber,
      status: v.status,
      passcode: v.preApprovedPasscode,
      entryTime: v.entryTime,
      exitTime: v.exitTime,
      loggedByGuard: v.guardUser ? v.guardUser.fullName : null,
    })),
  };
};

/**
 * List all visitor logs for society with filters and pagination
 */
export const listAllVisitors = async (
  params: VisitorQueryParams,
  callerSocietyId?: string
) => {
  const targetSocietyId = params.societyId || callerSocietyId;

  if (!targetSocietyId) {
    throw new AppError(
      400,
      "Society ID missing. Provide societyId query parameter or login with active society."
    );
  }

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.VisitorWhereInput = {
    societyId: targetSocietyId,
    ...(params.status ? { status: params.status } : {}),
    ...(params.unitId ? { unitId: params.unitId } : {}),
    ...(params.startDate || params.endDate
      ? {
          entryTime: {
            ...(params.startDate ? { gte: new Date(params.startDate) } : {}),
            ...(params.endDate ? { lte: new Date(params.endDate) } : {}),
          },
        }
      : {}),
  };

  const [totalRecords, visitors] = await Promise.all([
    prisma.visitor.count({ where: whereClause }),
    prisma.visitor.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { entryTime: "desc" },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            sectionWing: { select: { name: true } },
          },
        },
        guardUser: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    }),
  ]);

  return {
    visitors: visitors.map((v) => ({
      id: v.id,
      visitorName: v.visitorName,
      phone: v.phone,
      category: v.category,
      vehicleNumber: v.vehicleNumber,
      status: v.status,
      passcode: v.preApprovedPasscode,
      entryTime: v.entryTime,
      exitTime: v.exitTime,
      unit: {
        id: v.unit.id,
        unitNumber: v.unit.unitNumber,
        wing: v.unit.sectionWing.name,
      },
      loggedByGuard: v.guardUser ? v.guardUser.fullName : null,
    })),
    pagination: {
      totalRecords,
      page,
      limit,
      totalPages: Math.ceil(totalRecords / limit),
    },
  };
};
