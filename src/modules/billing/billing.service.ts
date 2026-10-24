import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import {
  GenerateBillsInput,
  RecordPaymentInput,
  BillQueryParams,
} from "./billing.validation";

/**
 * Generate monthly maintenance bills for all units in a society
 */
export const generateSocietyBills = async (
  payload: GenerateBillsInput,
  adminSocietyId?: string
) => {
  const targetSocietyId = payload.societyId || adminSocietyId;

  if (!targetSocietyId) {
    throw new AppError(
      400,
      "Society ID missing. Please specify societyId or login with active society context."
    );
  }

  const society = await prisma.society.findUnique({
    where: { id: targetSocietyId },
    select: { id: true, name: true, code: true },
  });

  if (!society) {
    throw new AppError(404, "Society not found.");
  }

  // Format primary month key (e.g., '2026-10')
  const primaryMonthKey = `${payload.billingYear}-${String(
    payload.billingMonth
  ).padStart(2, "0")}`;

  // Generate sequence of covered months if multi-month billing
  const monthsCovered: string[] = [];
  let currentYear = payload.billingYear;
  let currentMonth = payload.billingMonth;

  for (let i = 0; i < payload.numberOfMonths; i++) {
    monthsCovered.push(
      `${currentYear}-${String(currentMonth).padStart(2, "0")}`
    );
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  // Prevent double-billing for the same starting month
  const existingBills = await prisma.maintenanceBill.findMany({
    where: { societyId: targetSocietyId },
    select: { id: true, monthsCovered: true },
  });

  const alreadyBilled = existingBills.some((bill) => {
    const list = Array.isArray(bill.monthsCovered)
      ? (bill.monthsCovered as string[])
      : [];
    return list.includes(primaryMonthKey);
  });

  if (alreadyBilled) {
    throw new AppError(
      409,
      `Maintenance bills for period '${primaryMonthKey}' have already been generated for this society.`
    );
  }

  // Fetch all units in the society
  const units = await prisma.unit.findMany({
    where: { societyId: targetSocietyId },
    select: {
      id: true,
      unitNumber: true,
      occupancyStatus: true,
      sectionWing: { select: { name: true } },
    },
    orderBy: [{ floorNumber: "asc" }, { unitNumber: "asc" }],
  });

  if (units.length === 0) {
    throw new AppError(
      400,
      "No units found in this society to generate maintenance bills."
    );
  }

  // Batch-create bills inside transaction
  return await prisma.$transaction(async (tx) => {
    const totalPerUnit = payload.amount * payload.numberOfMonths;

    const billsData = units.map((unit) => {
      const sanitizedWing = unit.sectionWing.name.replace(/[^a-zA-Z0-9]/g, "");
      const sanitizedUnitNum = unit.unitNumber.replace(/[^a-zA-Z0-9]/g, "");
      const receiptNo = `INV-${payload.billingYear}${String(
        payload.billingMonth
      ).padStart(2, "0")}-${sanitizedWing}-${sanitizedUnitNum}`;

      return {
        societyId: targetSocietyId,
        unitId: unit.id,
        numberOfMonths: payload.numberOfMonths,
        monthsCovered: monthsCovered,
        amountPerMonth: new Prisma.Decimal(payload.amount),
        totalAmount: new Prisma.Decimal(totalPerUnit),
        paymentMode: "PENDING",
        status: "PENDING",
        receiptNo,
      };
    });

    await tx.maintenanceBill.createMany({
      data: billsData,
    });

    return {
      message: "Maintenance bills generated successfully.",
      society: {
        id: society.id,
        name: society.name,
        code: society.code,
      },
      billingPeriod: {
        month: payload.billingMonth,
        year: payload.billingYear,
        monthsCovered,
        numberOfMonths: payload.numberOfMonths,
      },
      billingMode: payload.billingMode,
      ratePerMonth: payload.amount,
      totalAmountPerUnit: totalPerUnit,
      totalUnitsBilled: units.length,
      totalBilledAmount: totalPerUnit * units.length,
      status: "PENDING",
    };
  });
};

/**
 * Record maintenance bill payment (Online, UPI, Cash, Cheque)
 */
export const recordBillPayment = async (
  billId: string,
  payload: RecordPaymentInput,
  adminUser: { id: string; societyId?: string }
) => {
  return await prisma.$transaction(async (tx) => {
    const bill = await tx.maintenanceBill.findUnique({
      where: { id: billId },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            occupancyStatus: true,
            sectionWing: { select: { name: true } },
          },
        },
        society: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!bill) {
      throw new AppError(404, "Maintenance bill not found.");
    }

    if (adminUser.societyId && bill.societyId !== adminUser.societyId) {
      throw new AppError(
        403,
        "Forbidden: You do not have permission to record payments for this society."
      );
    }

    if (bill.status === "PAID") {
      throw new AppError(
        400,
        `This maintenance bill is already marked as PAID (Receipt No: ${bill.receiptNo}).`
      );
    }

    const sanitizedWing = bill.unit.sectionWing.name.replace(/[^a-zA-Z0-9]/g, "");
    const sanitizedUnitNum = bill.unit.unitNumber.replace(/[^a-zA-Z0-9]/g, "");
    const generatedReceiptNo = `RCPT-${Date.now().toString(36).toUpperCase()}-${sanitizedWing}-${sanitizedUnitNum}`;

    const updatedBill = await tx.maintenanceBill.update({
      where: { id: bill.id },
      data: {
        status: "PAID",
        paymentMode: payload.paymentMethod,
        utrReference:
          payload.transactionReference || payload.chequeNumber || null,
        paidAt: payload.paymentDate ? new Date(payload.paymentDate) : new Date(),
        paidByUserId: payload.paidByUserId || null,
        cashCollectorId:
          payload.paymentMethod === "CASH"
            ? payload.cashCollectorId || adminUser.id
            : null,
        receiptNo: generatedReceiptNo,
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            sectionWing: { select: { name: true } },
          },
        },
        paidByUser: {
          select: { id: true, fullName: true, phone: true },
        },
        cashCollector: {
          select: { id: true, fullName: true, phone: true },
        },
      },
    });

    return {
      message: "Payment recorded successfully.",
      billId: updatedBill.id,
      receiptNumber: updatedBill.receiptNo,
      unit: {
        id: updatedBill.unit.id,
        unitNumber: updatedBill.unit.unitNumber,
        wing: updatedBill.unit.sectionWing.name,
      },
      paymentDetails: {
        amountPaid: Number(updatedBill.totalAmount),
        paymentMode: updatedBill.paymentMode,
        transactionReference: updatedBill.utrReference,
        paidAt: updatedBill.paidAt,
        status: updatedBill.status,
      },
      paidBy: updatedBill.paidByUser || null,
      cashCollector: updatedBill.cashCollector || null,
    };
  });
};

/**
 * Fetch bills for a specific unit (accessible by unit resident or admin)
 */
export const getUnitBills = async (unitId: string, societyId?: string) => {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      sectionWing: { select: { name: true } },
      society: { select: { id: true, name: true, code: true } },
    },
  });

  if (!unit) {
    throw new AppError(404, "Unit not found.");
  }

  if (societyId && unit.societyId !== societyId) {
    throw new AppError(
      403,
      "Forbidden: You do not have access to this unit's billing records."
    );
  }

  const bills = await prisma.maintenanceBill.findMany({
    where: { unitId },
    orderBy: { paidAt: "desc" },
    include: {
      paidByUser: { select: { id: true, fullName: true, phone: true } },
      cashCollector: { select: { id: true, fullName: true, phone: true } },
    },
  });

  let totalDues = 0;
  let totalPaid = 0;
  let pendingCount = 0;

  const formattedBills = bills.map((b) => {
    const amount = Number(b.totalAmount);
    if (b.status === "PAID") {
      totalPaid += amount;
    } else {
      totalDues += amount;
      pendingCount++;
    }

    return {
      id: b.id,
      receiptNo: b.receiptNo,
      monthsCovered: b.monthsCovered,
      numberOfMonths: b.numberOfMonths,
      amountPerMonth: Number(b.amountPerMonth),
      totalAmount: amount,
      paymentMode: b.paymentMode,
      status: b.status,
      utrReference: b.utrReference,
      paidAt: b.paidAt,
      paidBy: b.paidByUser,
      cashCollector: b.cashCollector,
    };
  });

  return {
    unit: {
      id: unit.id,
      unitNumber: unit.unitNumber,
      wing: unit.sectionWing.name,
      occupancyStatus: unit.occupancyStatus,
    },
    society: unit.society,
    summary: {
      totalBills: bills.length,
      pendingBillsCount: pendingCount,
      totalDues,
      totalPaid,
    },
    bills: formattedBills,
  };
};

/**
 * Fetch bills for the authenticated user across their active unit memberships
 */
export const getCallerUnitBills = async (userId: string) => {
  const memberships = await prisma.unitMember.findMany({
    where: {
      userId,
      approvalStatus: "APPROVED",
    },
    select: {
      unitId: true,
      unit: {
        select: {
          id: true,
          unitNumber: true,
          societyId: true,
          sectionWing: { select: { name: true } },
          society: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  if (memberships.length === 0) {
    return {
      message: "No active unit memberships found for user.",
      totalUnits: 0,
      units: [],
    };
  }

  const results = [];
  for (const m of memberships) {
    const unitBillsData = await getUnitBills(m.unitId, m.unit.societyId);
    results.push(unitBillsData);
  }

  return {
    totalUnits: results.length,
    units: results,
  };
};

/**
 * List all bills for society admin with filters and pagination
 */
export const listAllBills = async (
  params: BillQueryParams,
  adminSocietyId?: string
) => {
  const targetSocietyId = params.societyId || adminSocietyId;

  if (!targetSocietyId) {
    throw new AppError(
      400,
      "Society ID missing. Provide societyId query parameter or login with active society."
    );
  }

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.MaintenanceBillWhereInput = {
    societyId: targetSocietyId,
    ...(params.status ? { status: params.status } : {}),
    ...(params.unitId ? { unitId: params.unitId } : {}),
  };

  const [totalRecords, bills] = await Promise.all([
    prisma.maintenanceBill.count({ where: whereClause }),
    prisma.maintenanceBill.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { paidAt: "desc" },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            occupancyStatus: true,
            sectionWing: { select: { name: true } },
          },
        },
        paidByUser: { select: { id: true, fullName: true, phone: true } },
        cashCollector: { select: { id: true, fullName: true, phone: true } },
      },
    }),
  ]);

  return {
    bills: bills.map((b) => ({
      id: b.id,
      receiptNo: b.receiptNo,
      unit: {
        id: b.unit.id,
        unitNumber: b.unit.unitNumber,
        wing: b.unit.sectionWing.name,
        occupancyStatus: b.unit.occupancyStatus,
      },
      monthsCovered: b.monthsCovered,
      numberOfMonths: b.numberOfMonths,
      amountPerMonth: Number(b.amountPerMonth),
      totalAmount: Number(b.totalAmount),
      paymentMode: b.paymentMode,
      status: b.status,
      utrReference: b.utrReference,
      paidAt: b.paidAt,
      paidBy: b.paidByUser,
      cashCollector: b.cashCollector,
    })),
    pagination: {
      totalRecords,
      page,
      limit,
      totalPages: Math.ceil(totalRecords / limit),
    },
  };
};

/**
 * Society-level financial analytics and defaulter list
 */
export const getSocietyFinancialSummary = async (societyId: string) => {
  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { id: true, name: true, code: true },
  });

  if (!society) {
    throw new AppError(404, "Society not found.");
  }

  const bills = await prisma.maintenanceBill.findMany({
    where: { societyId },
    include: {
      unit: {
        select: {
          id: true,
          unitNumber: true,
          occupancyStatus: true,
          sectionWing: { select: { name: true } },
          members: {
            where: { approvalStatus: "APPROVED" },
            select: {
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
      },
    },
  });

  let totalBilled = 0;
  let totalCollected = 0;
  let totalPending = 0;
  let paidCount = 0;
  let pendingCount = 0;

  // Track defaulter units
  const defaulterMap = new Map<
    string,
    {
      unitId: string;
      unitNumber: string;
      wing: string;
      pendingAmount: number;
      pendingMonths: string[];
      primaryResident: {
        fullName: string;
        phone: string;
        email: string | null;
        memberType: string;
      } | null;
    }
  >();

  for (const b of bills) {
    const amount = Number(b.totalAmount);
    totalBilled += amount;

    if (b.status === "PAID") {
      totalCollected += amount;
      paidCount++;
    } else {
      totalPending += amount;
      pendingCount++;

      const unitId = b.unitId;
      const months = Array.isArray(b.monthsCovered)
        ? (b.monthsCovered as string[])
        : [];

      if (!defaulterMap.has(unitId)) {
        const primary =
          b.unit.members.find((m) => m.isPrimaryHead) ||
          b.unit.members[0] ||
          null;

        defaulterMap.set(unitId, {
          unitId,
          unitNumber: b.unit.unitNumber,
          wing: b.unit.sectionWing.name,
          pendingAmount: amount,
          pendingMonths: [...months],
          primaryResident: primary
            ? {
                fullName: primary.user.fullName,
                phone: primary.user.phone,
                email: primary.user.email,
                memberType: primary.memberType,
              }
            : null,
        });
      } else {
        const item = defaulterMap.get(unitId)!;
        item.pendingAmount += amount;
        item.pendingMonths.push(...months);
      }
    }
  }

  const collectionRate =
    totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

  return {
    society,
    summary: {
      totalBilledAmount: totalBilled,
      totalCollectedAmount: totalCollected,
      totalPendingAmount: totalPending,
      collectionRatePercentage: Number(collectionRate.toFixed(2)),
      totalBillsCount: bills.length,
      paidBillsCount: paidCount,
      pendingBillsCount: pendingCount,
    },
    defaultersCount: defaulterMap.size,
    defaulters: Array.from(defaulterMap.values()).sort(
      (a, b) => b.pendingAmount - a.pendingAmount
    ),
  };
};
