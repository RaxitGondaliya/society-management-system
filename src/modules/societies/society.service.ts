import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import { generateToken } from "../../utils/jwt";
import { RegisterSocietyInput } from "./society.validation";

/**
 * Format wing name cleanly (e.g., 'A' -> 'Wing A', 'Tower 1' -> 'Tower 1')
 */
const formatSectionWingName = (name: string): string => {
  const trimmed = name.trim();
  if (/^[A-Za-z0-9]$/.test(trimmed)) {
    return `Wing ${trimmed.toUpperCase()}`;
  }
  return trimmed;
};

/**
 * Generates an ultra-clean, unique Society Code (e.g., SHIV-7890)
 */
export const generateUniqueSocietyCode = async (
  societyName: string,
  tx: Prisma.TransactionClient
): Promise<string> => {
  const cleanName = societyName.replace(/[^a-zA-Z]/g, "").toUpperCase();
  const prefix = (cleanName.length >= 4 ? cleanName.substring(0, 4) : (cleanName + "SOC").substring(0, 4));
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoids ambiguous I, 1, O, 0

  let code = "";
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    let randomSuffix = "";
    for (let i = 0; i < 4; i++) {
      randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code = `${prefix}-${randomSuffix}`;

    const existing = await tx.society.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    const timestampFallback = Date.now().toString(36).toUpperCase().slice(-4);
    code = `${prefix}-${timestampFallback}`;
  }

  return code;
};

export interface SocietyRegistrationResult {
  society: {
    id: string;
    name: string;
    code: string;
    propertyType: string;
    address: string;
    subscriptionPlan: string;
    bankAccountNo?: string | null;
    bankIfsc?: string | null;
    bankBeneficiaryName?: string | null;
    upiId?: string | null;
    createdAt: Date;
  };
  admin: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    role: string;
  };
  assignedUnit: {
    id: string;
    unitNumber: string;
    sectionWingId: string;
    sectionWingName: string;
    occupancyStatus: string;
  };
  layoutSummary: {
    totalSections: number;
    totalUnits: number;
    sectionBreakdown: Array<{
      id: string;
      name: string;
      unitCount: number;
    }>;
  };
  token: string;
}

/**
 * Register a new society and auto-generate layout inside an ACID-compliant transaction
 */
export const registerSociety = async (
  payload: RegisterSocietyInput
): Promise<SocietyRegistrationResult> => {
  return await prisma.$transaction(async (tx) => {
    // 1. Validate Admin User Existence
    let user = await tx.user.findUnique({
      where: { phone: payload.admin.phone },
    });

    if (user) {
      if (!user.isActive) {
        throw new AppError(
          403,
          "User account with this phone number is currently deactivated."
        );
      }

      // Upgrade role to SUPER_ADMIN if not already
      if (user.role !== "SUPER_ADMIN") {
        user = await tx.user.update({
          where: { id: user.id },
          data: { role: "SUPER_ADMIN" },
        });
      }
    } else {
      // Check email uniqueness if email provided
      if (payload.admin.email) {
        const existingEmailUser = await tx.user.findUnique({
          where: { email: payload.admin.email },
        });

        if (existingEmailUser) {
          throw new AppError(
            409,
            `A user with email '${payload.admin.email}' already exists.`
          );
        }
      }

      // Create Admin User with SUPER_ADMIN role
      user = await tx.user.create({
        data: {
          phone: payload.admin.phone,
          email: payload.admin.email || null,
          fullName: payload.admin.fullName,
          role: "SUPER_ADMIN",
          isActive: true,
        },
      });
    }

    // 2. Generate Unique Society Code
    const societyCode = await generateUniqueSocietyCode(payload.name, tx);

    // 3. Create Society Record
    const society = await tx.society.create({
      data: {
        name: payload.name,
        code: societyCode,
        propertyType: payload.propertyType,
        address: payload.address,
        latitude: payload.latitude !== undefined && payload.latitude !== null ? new Prisma.Decimal(payload.latitude) : null,
        longitude: payload.longitude !== undefined && payload.longitude !== null ? new Prisma.Decimal(payload.longitude) : null,
        bankAccountNo: payload.bankAccountNo || null,
        bankIfsc: payload.bankIfsc || null,
        bankBeneficiaryName: payload.bankBeneficiaryName || null,
        upiId: payload.upiId || null,
        subscriptionPlan: "ACTIVE",
      },
    });

    // 4. Batch-create SectionWings and Units based on Property Layout
    const createdSections: Array<{ id: string; name: string; unitCount: number }> = [];
    let firstUnit: {
      id: string;
      unitNumber: string;
      sectionWingId: string;
      sectionWingName: string;
      occupancyStatus: string;
    } | null = null;
    let totalUnitsCount = 0;

    if (payload.propertyType === "FLAT") {
      const rawWings = payload.layout.wings || ["Wing A"];
      const floorsPerWing = payload.layout.floorsPerWing || 1;
      const unitsPerFloor = payload.layout.unitsPerFloor || 1;

      for (const rawWing of rawWings) {
        const wingName = formatSectionWingName(rawWing);
        const section = await tx.sectionWing.create({
          data: {
            societyId: society.id,
            name: wingName,
          },
        });

        const unitsData: Array<{
          societyId: string;
          sectionWingId: string;
          unitNumber: string;
          floorNumber: number;
          occupancyStatus: string;
        }> = [];

        for (let floor = 1; floor <= floorsPerWing; floor++) {
          for (let u = 1; u <= unitsPerFloor; u++) {
            const unitNumber = `${floor}${u < 10 ? "0" : ""}${u}`;
            const isFirst = !firstUnit && unitsData.length === 0;

            unitsData.push({
              societyId: society.id,
              sectionWingId: section.id,
              unitNumber,
              floorNumber: floor,
              occupancyStatus: isFirst ? "OCCUPIED_OWNER" : "VACANT",
            });
          }
        }

        await tx.unit.createMany({
          data: unitsData,
        });

        totalUnitsCount += unitsData.length;
        createdSections.push({
          id: section.id,
          name: section.name,
          unitCount: unitsData.length,
        });

        if (!firstUnit) {
          const fetchedFirst = await tx.unit.findFirst({
            where: { societyId: society.id, sectionWingId: section.id },
            orderBy: [{ floorNumber: "asc" }, { unitNumber: "asc" }],
          });

          if (fetchedFirst) {
            firstUnit = {
              id: fetchedFirst.id,
              unitNumber: fetchedFirst.unitNumber,
              sectionWingId: section.id,
              sectionWingName: section.name,
              occupancyStatus: fetchedFirst.occupancyStatus,
            };
          }
        }
      }
    } else {
      // ROW_HOUSE or VILLA
      const rawSections =
        payload.layout.sections && payload.layout.sections.length > 0
          ? payload.layout.sections
          : ["Main Section"];
      const totalUnits = payload.layout.totalUnits || 1;
      const defaultPrefix = payload.propertyType === "VILLA" ? "Villa-" : "RH-";
      const prefix = payload.layout.unitPrefix ? payload.layout.unitPrefix.trim() : defaultPrefix;

      const unitsPerSection = Math.ceil(totalUnits / rawSections.length);
      let unitCounter = 1;

      for (let sIdx = 0; sIdx < rawSections.length; sIdx++) {
        const secName = formatSectionWingName(rawSections[sIdx]);
        const section = await tx.sectionWing.create({
          data: {
            societyId: society.id,
            name: secName,
          },
        });

        const unitsForThisSectionCount = Math.min(
          unitsPerSection,
          totalUnits - (unitCounter - 1)
        );

        if (unitsForThisSectionCount <= 0) break;

        const unitsData: Array<{
          societyId: string;
          sectionWingId: string;
          unitNumber: string;
          floorNumber: number;
          occupancyStatus: string;
        }> = [];

        for (let i = 0; i < unitsForThisSectionCount; i++) {
          const unitNumber = `${prefix}${unitCounter}`;
          const isFirst = !firstUnit && unitsData.length === 0;

          unitsData.push({
            societyId: society.id,
            sectionWingId: section.id,
            unitNumber,
            floorNumber: 1,
            occupancyStatus: isFirst ? "OCCUPIED_OWNER" : "VACANT",
          });
          unitCounter++;
        }

        await tx.unit.createMany({
          data: unitsData,
        });

        totalUnitsCount += unitsData.length;
        createdSections.push({
          id: section.id,
          name: section.name,
          unitCount: unitsData.length,
        });

        if (!firstUnit) {
          const fetchedFirst = await tx.unit.findFirst({
            where: { societyId: society.id, sectionWingId: section.id },
            orderBy: { unitNumber: "asc" },
          });

          if (fetchedFirst) {
            firstUnit = {
              id: fetchedFirst.id,
              unitNumber: fetchedFirst.unitNumber,
              sectionWingId: section.id,
              sectionWingName: section.name,
              occupancyStatus: fetchedFirst.occupancyStatus,
            };
          }
        }
      }
    }

    if (!firstUnit) {
      throw new AppError(500, "Failed to initialize society units layout.");
    }

    // 5. Link Admin to the first Unit via UnitMember
    await tx.unitMember.create({
      data: {
        unitId: firstUnit.id,
        userId: user.id,
        memberType: "OWNER",
        isPrimaryHead: true,
        approvalStatus: "APPROVED",
      },
    });

    // 6. Generate JWT Authentication Token
    const token = generateToken({
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      societyId: society.id,
      unitId: firstUnit.id,
    });

    return {
      society: {
        id: society.id,
        name: society.name,
        code: society.code,
        propertyType: society.propertyType,
        address: society.address,
        subscriptionPlan: society.subscriptionPlan,
        bankAccountNo: society.bankAccountNo,
        bankIfsc: society.bankIfsc,
        bankBeneficiaryName: society.bankBeneficiaryName,
        upiId: society.upiId,
        createdAt: society.createdAt,
      },
      admin: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
      assignedUnit: firstUnit,
      layoutSummary: {
        totalSections: createdSections.length,
        totalUnits: totalUnitsCount,
        sectionBreakdown: createdSections,
      },
      token,
    };
  });
};

/**
 * Fetch public society basic info and selectable units by society code
 */
export const getSocietyByCode = async (code: string) => {
  const normalizedCode = code.trim().toUpperCase();

  const society = await prisma.society.findUnique({
    where: { code: normalizedCode },
    select: {
      id: true,
      name: true,
      code: true,
      propertyType: true,
      address: true,
      subscriptionPlan: true,
      createdAt: true,
      sections: {
        select: {
          id: true,
          name: true,
          units: {
            select: {
              id: true,
              unitNumber: true,
              floorNumber: true,
              occupancyStatus: true,
            },
            orderBy: [
              { floorNumber: "asc" },
              { unitNumber: "asc" },
            ],
          },
        },
        orderBy: {
          name: "asc",
        },
      },
    },
  });

  if (!society) {
    throw new AppError(404, `Society with code '${normalizedCode}' not found.`);
  }

  return society;
};
