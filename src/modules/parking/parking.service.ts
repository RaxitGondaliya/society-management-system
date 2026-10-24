import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import { AuthUserPayload } from "../../types/express";
import {
  CreateSlotInput,
  AllocateSlotInput,
  RegisterVehicleInput,
  VehicleGateLogInput,
  ParkingViolationInput,
  ParkingQueryInput,
} from "./parking.validation";

export class ParkingService {
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
      throw new AppError(404, "No society found in the system");
    }
    return society.id;
  }

  /**
   * 1. Create Parking Slot / Bay (Admin)
   */
  static async createParkingSlot(user: AuthUserPayload, input: CreateSlotInput) {
    const societyId = await this.resolveSocietyId(user);

    // Enforce unique slot number within society
    const existing = await prisma.parkingSlot.findFirst({
      where: {
        societyId,
        slotNumber: input.slotNumber,
      },
    });

    if (existing) {
      throw new AppError(
        409,
        `Parking slot '${input.slotNumber}' is already defined in this society.`
      );
    }

    const slot = await prisma.parkingSlot.create({
      data: {
        societyId,
        slotNumber: input.slotNumber,
        zone: input.zone,
        vehicleType: input.vehicleType,
        slotType: input.slotType,
        hasEvCharging: input.hasEvCharging,
        isAllocated: false,
      },
    });

    return slot;
  }

  /**
   * 2. Allocate Parking Slot to Flat / Unit (ACID Transaction)
   */
  static async allocateSlotToUnit(
    user: AuthUserPayload,
    input: AllocateSlotInput
  ) {
    const societyId = await this.resolveSocietyId(user);

    return await prisma.$transaction(async (tx) => {
      const slot = await tx.parkingSlot.findFirst({
        where: { id: input.slotId, societyId },
      });

      if (!slot) {
        throw new AppError(404, "Parking slot not found in this society.");
      }

      if (
        slot.isAllocated &&
        slot.allocatedUnitId &&
        slot.allocatedUnitId !== input.unitId
      ) {
        throw new AppError(
          409,
          `Parking slot '${slot.slotNumber}' is already allocated to another unit.`
        );
      }

      const unit = await tx.unit.findFirst({
        where: { id: input.unitId, societyId },
        include: { sectionWing: true },
      });

      if (!unit) {
        throw new AppError(404, "Target unit not found in this society.");
      }

      const updatedSlot = await tx.parkingSlot.update({
        where: { id: slot.id },
        data: {
          isAllocated: true,
          allocatedUnitId: unit.id,
          allocationType: input.allocationType || "PERMANENT_DEEDED",
          monthlyFee: input.monthlyFee ?? 0,
          allocatedAt: new Date(),
        },
        include: {
          allocatedUnit: {
            select: {
              id: true,
              unitNumber: true,
              sectionWing: { select: { name: true } },
            },
          },
        },
      });

      return updatedSlot;
    });
  }

  /**
   * 3. Register Resident Vehicle (Resident / Admin)
   */
  static async registerResidentVehicle(
    user: AuthUserPayload,
    input: RegisterVehicleInput
  ) {
    const societyId = await this.resolveSocietyId(user);

    // If resident caller, verify they belong to this unit
    if (user.role === "RESIDENT") {
      const membership = await prisma.unitMember.findFirst({
        where: {
          userId: user.id,
          unitId: input.unitId,
          approvalStatus: "APPROVED",
        },
      });

      if (!membership) {
        throw new AppError(
          403,
          "You can only register vehicles for your own approved unit."
        );
      }
    }

    const unit = await prisma.unit.findFirst({
      where: { id: input.unitId, societyId },
    });

    if (!unit) {
      throw new AppError(404, "Unit not found in this society.");
    }

    // Check plate uniqueness in society
    const existingVehicle = await prisma.residentVehicle.findFirst({
      where: {
        societyId,
        licensePlate: input.licensePlate,
      },
    });

    if (existingVehicle) {
      throw new AppError(
        409,
        `Vehicle with license plate '${input.licensePlate}' is already registered in this society.`
      );
    }

    // If parkingSlotId is supplied, verify it belongs to this society
    if (input.parkingSlotId) {
      const slot = await prisma.parkingSlot.findFirst({
        where: { id: input.parkingSlotId, societyId },
      });

      if (!slot) {
        throw new AppError(
          404,
          "Specified parking slot not found in this society."
        );
      }
    }

    const vehicle = await prisma.residentVehicle.create({
      data: {
        societyId,
        unitId: input.unitId,
        parkingSlotId: input.parkingSlotId || null,
        licensePlate: input.licensePlate,
        vehicleType: input.vehicleType,
        makeModel: input.makeModel.trim(),
        rfidTag: input.rfidTag?.trim() || null,
        fastagId: input.fastagId?.trim() || null,
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            sectionWing: { select: { name: true } },
          },
        },
        parkingSlot: {
          select: {
            id: true,
            slotNumber: true,
            zone: true,
            hasEvCharging: true,
          },
        },
      },
    });

    return vehicle;
  }

  /**
   * 4. Log Vehicle Gate Movement (RFID / ANPR / Guard Check)
   */
  static async logVehicleGateMovement(
    user: AuthUserPayload,
    input: VehicleGateLogInput
  ) {
    const societyId = await this.resolveSocietyId(user);

    // 1. Check if registered resident vehicle
    const residentVehicle = await prisma.residentVehicle.findFirst({
      where: {
        societyId,
        licensePlate: input.licensePlate,
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
        parkingSlot: true,
      },
    });

    if (residentVehicle) {
      const movementLog = await prisma.vehicleGateMovementLog.create({
        data: {
          societyId,
          licensePlate: input.licensePlate,
          action: input.action,
          gateNumber: input.gateNumber?.trim() || "MAIN_GATE",
          isAuthorized: true,
          authorizationType: "REGISTERED_RESIDENT",
          residentVehicleId: residentVehicle.id,
          loggedByUserId: user.id,
        },
      });

      return {
        movementLog,
        status: "AUTHORIZED",
        vehicleType: "REGISTERED_RESIDENT",
        vehicleDetails: {
          licensePlate: residentVehicle.licensePlate,
          makeModel: residentVehicle.makeModel,
          unitNumber: residentVehicle.unit.unitNumber,
          wing: residentVehicle.unit.sectionWing.name,
          slotNumber: residentVehicle.parkingSlot?.slotNumber || "UNASSIGNED",
        },
      };
    }

    // 2. Check if approved visitor vehicle exists in Visitor module
    const approvedVisitor = await prisma.visitor.findFirst({
      where: {
        societyId,
        vehicleNumber: { contains: input.licensePlate, mode: "insensitive" },
        status: "APPROVED",
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
      },
    });

    if (approvedVisitor) {
      const movementLog = await prisma.vehicleGateMovementLog.create({
        data: {
          societyId,
          licensePlate: input.licensePlate,
          action: input.action,
          gateNumber: input.gateNumber?.trim() || "MAIN_GATE",
          isAuthorized: true,
          authorizationType: "APPROVED_VISITOR",
          visitorId: approvedVisitor.id,
          loggedByUserId: user.id,
        },
      });

      return {
        movementLog,
        status: "AUTHORIZED",
        vehicleType: "APPROVED_VISITOR",
        visitorDetails: {
          visitorName: approvedVisitor.visitorName,
          category: approvedVisitor.category,
          visitingUnit: approvedVisitor.unit.unitNumber,
          wing: approvedVisitor.unit.sectionWing.name,
        },
      };
    }

    // 3. Unscheduled / Unauthorized vehicle
    const movementLog = await prisma.vehicleGateMovementLog.create({
      data: {
        societyId,
        licensePlate: input.licensePlate,
        action: input.action,
        gateNumber: input.gateNumber?.trim() || "MAIN_GATE",
        isAuthorized: false,
        authorizationType: "VISITOR_UNSCHEDULED",
        loggedByUserId: user.id,
      },
    });

    return {
      movementLog,
      status: "WARNING_UNSCHEDULED",
      vehicleType: "UNREGISTERED",
      warningMessage:
        "Vehicle is neither registered to a resident nor pre-approved as a visitor.",
    };
  }

  /**
   * 5. Report Parking Violation (Guard / Resident)
   */
  static async reportParkingViolation(
    user: AuthUserPayload,
    input: ParkingViolationInput
  ) {
    const societyId = await this.resolveSocietyId(user);

    const slot = await prisma.parkingSlot.findFirst({
      where: { id: input.slotId, societyId },
      include: { allocatedUnit: true },
    });

    if (!slot) {
      throw new AppError(404, "Parking slot not found in this society.");
    }

    // Auto-detect if offending vehicle belongs to a resident unit in this society
    const residentVehicle = await prisma.residentVehicle.findFirst({
      where: { societyId, licensePlate: input.vehicleNumber },
    });

    const unitId = residentVehicle ? residentVehicle.unitId : null;

    const violation = await prisma.parkingViolation.create({
      data: {
        societyId,
        slotId: slot.id,
        vehicleNumber: input.vehicleNumber,
        unitId,
        violationType: input.violationType,
        penaltyAmount: input.penaltyAmount ?? 0,
        photoUrl: input.photoUrl || null,
        notes: input.notes?.trim() || null,
        reportedByUserId: user.id,
      },
      include: {
        slot: {
          select: {
            id: true,
            slotNumber: true,
            zone: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            sectionWing: { select: { name: true } },
          },
        },
        reportedByUser: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    return violation;
  }

  /**
   * 6. Real-Time Parking Capacity & Metrics Overview (Admin)
   */
  static async getSocietyParkingOverview(user: AuthUserPayload) {
    const societyId = await this.resolveSocietyId(user);

    const totalSlots = await prisma.parkingSlot.count({ where: { societyId } });
    const allocatedSlots = await prisma.parkingSlot.count({
      where: { societyId, isAllocated: true },
    });
    const vacantSlots = totalSlots - allocatedSlots;

    const evChargingSlots = await prisma.parkingSlot.count({
      where: { societyId, hasEvCharging: true },
    });

    const dedicatedResidentSlots = await prisma.parkingSlot.count({
      where: { societyId, slotType: "DEDICATED_RESIDENT" },
    });

    const guestVisitorSlots = await prisma.parkingSlot.count({
      where: { societyId, slotType: "GUEST_VISITOR" },
    });

    const commercialServiceSlots = await prisma.parkingSlot.count({
      where: { societyId, slotType: "COMMERCIAL_SERVICE" },
    });

    const totalVehicles = await prisma.residentVehicle.count({
      where: { societyId, isActive: true },
    });

    const twoWheelers = await prisma.residentVehicle.count({
      where: { societyId, vehicleType: "TWO_WHEELER", isActive: true },
    });

    const fourWheelers = await prisma.residentVehicle.count({
      where: { societyId, vehicleType: "FOUR_WHEELER", isActive: true },
    });

    // Grouping by Zone
    const zones = await prisma.parkingSlot.groupBy({
      by: ["zone"],
      where: { societyId },
      _count: {
        id: true,
      },
    });

    const allocatedZones = await prisma.parkingSlot.groupBy({
      by: ["zone"],
      where: { societyId, isAllocated: true },
      _count: {
        id: true,
      },
    });

    const allocatedMap = new Map(
      allocatedZones.map((z) => [z.zone, z._count.id])
    );

    const zoneBreakdown = zones.map((z) => {
      const allocated = allocatedMap.get(z.zone) || 0;
      return {
        zone: z.zone,
        total: z._count.id,
        allocated,
        vacant: z._count.id - allocated,
      };
    });

    return {
      capacity: {
        totalSlots,
        allocatedSlots,
        vacantSlots,
        occupancyRate: totalSlots > 0 ? Math.round((allocatedSlots / totalSlots) * 100) : 0,
        evChargingSlots,
      },
      slotTypes: {
        dedicatedResidentSlots,
        guestVisitorSlots,
        commercialServiceSlots,
      },
      vehicles: {
        totalRegisteredVehicles: totalVehicles,
        twoWheelers,
        fourWheelers,
      },
      zoneBreakdown,
    };
  }

  /**
   * 7. Resident's Vehicles & Assigned Parking Bays
   */
  static async getUnitVehiclesAndSlots(user: AuthUserPayload) {
    const membership = await prisma.unitMember.findFirst({
      where: { userId: user.id, approvalStatus: "APPROVED" },
      include: {
        unit: {
          include: {
            sectionWing: true,
          },
        },
      },
    });

    if (!membership?.unit) {
      throw new AppError(404, "No approved unit found for this resident.");
    }

    const unit = membership.unit;

    const allocatedSlots = await prisma.parkingSlot.findMany({
      where: { allocatedUnitId: unit.id },
      include: {
        vehicles: {
          select: {
            id: true,
            licensePlate: true,
            makeModel: true,
            vehicleType: true,
          },
        },
      },
      orderBy: { slotNumber: "asc" },
    });

    const registeredVehicles = await prisma.residentVehicle.findMany({
      where: { unitId: unit.id, isActive: true },
      include: {
        parkingSlot: {
          select: {
            id: true,
            slotNumber: true,
            zone: true,
            hasEvCharging: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const recentViolations = await prisma.parkingViolation.findMany({
      where: { unitId: unit.id },
      include: {
        slot: {
          select: {
            slotNumber: true,
            zone: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return {
      unit: {
        id: unit.id,
        unitNumber: unit.unitNumber,
        wing: unit.sectionWing.name,
      },
      allocatedSlots,
      registeredVehicles,
      recentViolations,
    };
  }

  /**
   * 8. Filtered List of Society Parking Bays
   */
  static async listSocietySlots(
    user: AuthUserPayload,
    query: ParkingQueryInput
  ) {
    const societyId = await this.resolveSocietyId(user);

    const where: Prisma.ParkingSlotWhereInput = { societyId };

    if (query.zone) {
      where.zone = query.zone;
    }

    if (query.vehicleType) {
      where.vehicleType = query.vehicleType;
    }

    if (query.slotType) {
      where.slotType = query.slotType;
    }

    if (query.unitId) {
      where.allocatedUnitId = query.unitId;
    }

    if (query.isAllocated !== undefined) {
      where.isAllocated =
        query.isAllocated === true || (query.isAllocated as unknown) === "true";
    }

    if (query.hasEvCharging !== undefined) {
      where.hasEvCharging =
        query.hasEvCharging === true ||
        (query.hasEvCharging as unknown) === "true";
    }

    if (query.search && query.search.trim() !== "") {
      const searchTerm = query.search.trim();
      where.OR = [
        { slotNumber: { contains: searchTerm, mode: "insensitive" } },
        {
          allocatedUnit: {
            unitNumber: { contains: searchTerm, mode: "insensitive" },
          },
        },
      ];
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;

    const totalRecords = await prisma.parkingSlot.count({ where });

    const slots = await prisma.parkingSlot.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ zone: "asc" }, { slotNumber: "asc" }],
      include: {
        allocatedUnit: {
          select: {
            id: true,
            unitNumber: true,
            sectionWing: { select: { name: true } },
          },
        },
        vehicles: {
          select: {
            id: true,
            licensePlate: true,
            makeModel: true,
            vehicleType: true,
          },
        },
      },
    });

    return {
      slots,
      pagination: {
        totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit),
      },
    };
  }
}
