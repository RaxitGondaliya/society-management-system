import { Prisma } from "@prisma/client";
import { prisma, executeResilientPrismaQuery } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import { generateToken } from "../../utils/jwt";
import { sanitizeMobileNumber } from "../../utils/sms.service";
import { otpService } from "../auth/otp.service";
import {
  RegisterSocietyInput,
  normalizeRegistrationInput,
  CreateWingInput,
  UpdateWingInput,
  CreateUnitInput,
  UpdateUnitInput,
} from "./society.validation";

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
    status: string;
    residentType: string;
    societyId: string;
    unitId: string;
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
  rawPayload: RegisterSocietyInput
): Promise<SocietyRegistrationResult> => {
  const payload = normalizeRegistrationInput(rawPayload);

  // If an OTP is provided on society registration, verify it if not already verified in the onboarding wizard
  if (payload.otp) {
    const cleanPhone = sanitizeMobileNumber(payload.admin.phone);
    if (!otpService.isDestinationVerified(cleanPhone, payload.otp)) {
      let verification = await otpService.verifyOtp(cleanPhone, payload.otp, { consume: true });
      if (!verification.valid) {
        verification = await otpService.verifyOtp(`+91${cleanPhone}`, payload.otp, { consume: true });
      }
      if (
        !verification.valid &&
        !verification.reason?.includes("No active verification code")
      ) {
        throw new AppError(400, verification.reason || "Invalid or expired verification code.");
      }
    }
  }

  const email = payload.email || payload.admin?.email;
  const societyName = payload.name || payload.societyName;

  console.log("[Register] Incoming payload:", { email, societyName: societyName || payload.name });
  console.log("[Register] Attempting Prisma insert into Neon DB...");

  const result = await prisma.$transaction(
    async (tx) => {
      // Step a: Normalize input
      const adminEmail = payload.admin.email ? payload.admin.email.trim().toLowerCase() : null;
      const rawPhone = payload.admin.phone.trim().replace(/\s+/g, "");
      const adminPhone = rawPhone.startsWith("+") ? rawPhone : `+91${rawPhone}`;
      const adminFullName = payload.admin.fullName.trim();
      const plan = payload.subscriptionPlan || (rawPayload as any).plan || "ACTIVE";

      // Step b: Create Society Record in Neon DB
      const societyCode = await generateUniqueSocietyCode(societyName, tx);
      const society = await tx.society.create({
        data: {
          name: societyName,
          code: societyCode,
          propertyType: payload.propertyType,
          address: payload.address,
          latitude: payload.latitude !== undefined && payload.latitude !== null ? new Prisma.Decimal(payload.latitude) : null,
          longitude: payload.longitude !== undefined && payload.longitude !== null ? new Prisma.Decimal(payload.longitude) : null,
          bankAccountNo: payload.bankAccountNo || null,
          bankIfsc: payload.bankIfsc || null,
          bankBeneficiaryName: payload.bankBeneficiaryName || null,
          upiId: payload.upiId || null,
          subscriptionPlan: plan,
        },
      });

      // Step c: Create/Link User record with role SUPER_ADMIN, email, phone, name
      const userOrConditions: Prisma.UserWhereInput[] = [
        { phone: adminPhone },
      ];
      if (adminPhone.startsWith("+91")) {
        userOrConditions.push({ phone: adminPhone.replace(/^\+91/, "") });
      }
      if (adminEmail) {
        userOrConditions.push({
          email: { equals: adminEmail, mode: Prisma.QueryMode.insensitive },
        });
      }

      let user = await tx.user.findFirst({
        where: {
          OR: userOrConditions,
        },
      });

      if (user) {
        if (!user.isActive) {
          throw new AppError(
            403,
            "User account with this phone/email is currently deactivated."
          );
        }

        // Upgrade role to SUPER_ADMIN if not already and synchronize contact
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            role: "SUPER_ADMIN",
            fullName: adminFullName || user.fullName,
            phone: adminPhone,
            ...(adminEmail && !user.email ? { email: adminEmail } : {}),
          },
        });
      } else {
        // Create Admin User with SUPER_ADMIN role in Neon DB
        user = await tx.user.create({
          data: {
            phone: adminPhone,
            email: adminEmail,
            fullName: adminFullName,
            role: "SUPER_ADMIN",
            isActive: true,
          },
        });
      }

      // Step d: Batch-create SectionWings and Units based on Property Layout
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

    // 5. Link Admin to the first Unit via UnitMember & sync SUPER_ADMIN + APPROVED status on User
    try {
      await tx.user.update({
        where: { id: user.id },
        data: {
          role: "SUPER_ADMIN",
          status: "APPROVED",
          residentType: "OWNER",
          societyId: society.id,
          unitId: firstUnit.id,
        },
      });
    } catch {
      // Fallback if optional columns are migrating
    }

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
      role: "SUPER_ADMIN",
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
        role: "SUPER_ADMIN",
        status: "APPROVED",
        residentType: "OWNER",
        societyId: society.id,
        unitId: firstUnit.id,
      },
      assignedUnit: firstUnit,
      layoutSummary: {
        totalSections: createdSections.length,
        totalUnits: totalUnitsCount,
        sectionBreakdown: createdSections,
      },
      token,
    };
  }, {
    maxWait: 10000,
    timeout: 25000,
  });

  console.log('[Register] Successfully committed to Neon DB with ID:', result.admin.id);
  return result;
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

/**
 * List all registered societies with their wings/blocks and units (Public for "Join My Society" dropdown)
 */
export const listAllSocieties = async () => {
  const societies = await executeResilientPrismaQuery(() =>
    prisma.society.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        propertyType: true,
        address: true,
        subscriptionPlan: true,
        createdAt: true,
        sections: {
          orderBy: { name: "asc" },
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
              },
            },
          },
        },
      },
    })
  );

  return societies;
};

/**
 * Fetch complete society structure (wings & units) for Admin management
 */
export const getSocietyStructure = async (societyId: string) => {
  const society = await executeResilientPrismaQuery(() =>
    prisma.society.findUnique({
      where: { id: societyId },
      select: {
        id: true,
        name: true,
        code: true,
        propertyType: true,
        address: true,
        subscriptionPlan: true,
        createdAt: true,
        sections: {
          orderBy: { name: "asc" },
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
                sectionWingId: true,
                members: {
                  where: { approvalStatus: "APPROVED" },
                  select: {
                    id: true,
                    memberType: true,
                    isPrimaryHead: true,
                    user: {
                      select: {
                        id: true,
                        fullName: true,
                      },
                    },
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

  return society;
};

/**
 * Create a new Wing / Tower / Block in the society
 */
export const createWing = async (societyId: string, payload: CreateWingInput) => {
  const formattedName = formatSectionWingName(payload.name);

  const existing = await executeResilientPrismaQuery(() =>
    prisma.sectionWing.findFirst({
      where: {
        societyId,
        name: { equals: formattedName, mode: "insensitive" },
      },
    })
  );

  if (existing) {
    throw new AppError(409, `A wing/block named '${formattedName}' already exists in this society.`);
  }

  const wing = await executeResilientPrismaQuery(() =>
    prisma.sectionWing.create({
      data: {
        societyId,
        name: formattedName,
      },
      include: {
        units: true,
      },
    })
  );

  return wing;
};

/**
 * Update an existing Wing / Tower / Block
 */
export const updateWing = async (
  societyId: string,
  wingId: string,
  payload: UpdateWingInput
) => {
  const wing = await executeResilientPrismaQuery(() =>
    prisma.sectionWing.findUnique({
      where: { id: wingId },
    })
  );

  if (!wing || wing.societyId !== societyId) {
    throw new AppError(404, "Wing / Tower not found in your society.");
  }

  const formattedName = formatSectionWingName(payload.name);

  const duplicate = await executeResilientPrismaQuery(() =>
    prisma.sectionWing.findFirst({
      where: {
        societyId,
        name: { equals: formattedName, mode: "insensitive" },
        NOT: { id: wingId },
      },
    })
  );

  if (duplicate) {
    throw new AppError(409, `Another wing/block named '${formattedName}' already exists.`);
  }

  const updated = await executeResilientPrismaQuery(() =>
    prisma.sectionWing.update({
      where: { id: wingId },
      data: { name: formattedName },
      include: {
        units: {
          orderBy: [{ floorNumber: "asc" }, { unitNumber: "asc" }],
        },
      },
    })
  );

  return updated;
};

/**
 * Delete a Wing / Tower / Block and its units
 */
export const deleteWing = async (societyId: string, wingId: string) => {
  const wing = await executeResilientPrismaQuery(() =>
    prisma.sectionWing.findUnique({
      where: { id: wingId },
      include: { units: { select: { id: true } } },
    })
  );

  if (!wing || wing.societyId !== societyId) {
    throw new AppError(404, "Wing / Tower not found in your society.");
  }

  const unitIds = wing.units.map((u) => u.id);

  await prisma.$transaction(async (tx) => {
    if (unitIds.length > 0) {
      await tx.familyMember.deleteMany({ where: { unitId: { in: unitIds } } });
      await tx.unitMember.deleteMany({ where: { unitId: { in: unitIds } } });
      await tx.unit.deleteMany({ where: { id: { in: unitIds } } });
    }
    await tx.sectionWing.delete({ where: { id: wingId } });
  });

  return { deletedWingId: wingId, deletedUnitsCount: unitIds.length };
};

/**
 * Create a new Unit / Flat / House in a Wing
 */
export const createUnit = async (societyId: string, payload: CreateUnitInput) => {
  const wing = await executeResilientPrismaQuery(() =>
    prisma.sectionWing.findUnique({
      where: { id: payload.sectionWingId },
    })
  );

  if (!wing || wing.societyId !== societyId) {
    throw new AppError(404, "Target Wing / Tower not found in your society.");
  }

  const cleanUnitNumber = payload.unitNumber.trim();

  const duplicate = await executeResilientPrismaQuery(() =>
    prisma.unit.findFirst({
      where: {
        societyId,
        sectionWingId: payload.sectionWingId,
        unitNumber: { equals: cleanUnitNumber, mode: "insensitive" },
      },
    })
  );

  if (duplicate) {
    throw new AppError(
      409,
      `Unit '${cleanUnitNumber}' already exists in ${wing.name}.`
    );
  }

  const unit = await executeResilientPrismaQuery(() =>
    prisma.unit.create({
      data: {
        societyId,
        sectionWingId: payload.sectionWingId,
        unitNumber: cleanUnitNumber,
        floorNumber: payload.floorNumber ?? 1,
        occupancyStatus: payload.occupancyStatus || "VACANT",
      },
    })
  );

  return unit;
};

/**
 * Update an existing Unit / Flat / House
 */
export const updateUnit = async (
  societyId: string,
  unitId: string,
  payload: UpdateUnitInput
) => {
  const unit = await executeResilientPrismaQuery(() =>
    prisma.unit.findUnique({
      where: { id: unitId },
    })
  );

  if (!unit || unit.societyId !== societyId) {
    throw new AppError(404, "Unit / Flat not found in your society.");
  }

  const targetWingId = payload.sectionWingId || unit.sectionWingId;
  const targetUnitNumber = payload.unitNumber ? payload.unitNumber.trim() : unit.unitNumber;

  if (payload.unitNumber || payload.sectionWingId) {
    const duplicate = await executeResilientPrismaQuery(() =>
      prisma.unit.findFirst({
        where: {
          societyId,
          sectionWingId: targetWingId,
          unitNumber: { equals: targetUnitNumber, mode: "insensitive" },
          NOT: { id: unitId },
        },
      })
    );

    if (duplicate) {
      throw new AppError(409, `Unit '${targetUnitNumber}' already exists in the selected wing.`);
    }
  }

  const updated = await executeResilientPrismaQuery(() =>
    prisma.unit.update({
      where: { id: unitId },
      data: {
        ...(payload.sectionWingId ? { sectionWingId: payload.sectionWingId } : {}),
        ...(payload.unitNumber ? { unitNumber: targetUnitNumber } : {}),
        ...(payload.floorNumber !== undefined ? { floorNumber: payload.floorNumber } : {}),
        ...(payload.occupancyStatus ? { occupancyStatus: payload.occupancyStatus } : {}),
      },
    })
  );

  return updated;
};

/**
 * Delete a Unit / Flat / House
 */
export const deleteUnit = async (societyId: string, unitId: string) => {
  const unit = await executeResilientPrismaQuery(() =>
    prisma.unit.findUnique({
      where: { id: unitId },
    })
  );

  if (!unit || unit.societyId !== societyId) {
    throw new AppError(404, "Unit / Flat not found in your society.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.familyMember.deleteMany({ where: { unitId } });
    await tx.unitMember.deleteMany({ where: { unitId } });
    await tx.unit.delete({ where: { id: unitId } });
  });

  return { deletedUnitId: unitId };
};
