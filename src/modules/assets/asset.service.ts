import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import { AuthUserPayload } from "../../types/express";
import {
  CreateAssetInput,
  LogMaintenanceRecordInput,
  InventoryItemInput,
  AdjustStockInput,
  AssetQueryInput,
  InventoryQueryInput,
} from "./asset.validation";

const CATEGORY_PREFIX_MAP: Record<string, string> = {
  ELECTRICAL: "AST-ELEC",
  PLUMBING: "AST-PLMB",
  ELEVATOR: "AST-ELEV",
  SECURITY_SYSTEM: "AST-SECU",
  FIRE_SAFETY: "AST-FIRE",
  GYM_EQUIPMENT: "AST-GYM",
  OTHER: "AST-OTHR",
};

export class AssetService {
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
   * 1. Register Physical Asset / Equipment
   */
  static async registerAsset(user: AuthUserPayload, input: CreateAssetInput) {
    const societyId = await this.resolveSocietyId(user);

    // Enforce uniqueness of serial number per society if provided
    if (input.serialNumber && input.serialNumber.trim() !== "") {
      const existing = await prisma.asset.findFirst({
        where: {
          societyId,
          serialNumber: input.serialNumber.trim(),
        },
      });

      if (existing) {
        throw new AppError(
          409,
          `An asset with serial number '${input.serialNumber.trim()}' is already registered in this society.`
        );
      }
    }

    // Generate unique asset code e.g. AST-ELEC-0001
    const count = await prisma.asset.count({ where: { societyId } });
    const codePrefix = CATEGORY_PREFIX_MAP[input.category] || "AST-GEN";
    const assetCode = `${codePrefix}-${String(count + 1).padStart(4, "0")}`;

    const asset = await prisma.asset.create({
      data: {
        societyId,
        assetCode,
        name: input.name.trim(),
        category: input.category,
        location: input.location.trim(),
        serialNumber: input.serialNumber ? input.serialNumber.trim() : null,
        modelNumber: input.modelNumber ? input.modelNumber.trim() : null,
        manufacturer: input.manufacturer ? input.manufacturer.trim() : null,
        purchaseDate: new Date(input.purchaseDate),
        purchaseCost: input.purchaseCost ?? null,
        warrantyExpiry: input.warrantyExpiry
          ? new Date(input.warrantyExpiry)
          : null,
        status: "OPERATIONAL",
        amcVendorName: input.amcDetails?.vendorName?.trim() || null,
        amcVendorPhone: input.amcDetails?.vendorPhone || null,
        amcStartDate: input.amcDetails?.startDate
          ? new Date(input.amcDetails.startDate)
          : null,
        amcEndDate: input.amcDetails?.endDate
          ? new Date(input.amcDetails.endDate)
          : null,
        amcCost: input.amcDetails?.cost ?? null,
      },
    });

    return asset;
  }

  /**
   * 2. Log Asset Maintenance / Service Record
   */
  static async logAssetServiceRecord(
    user: AuthUserPayload,
    assetId: string,
    input: LogMaintenanceRecordInput
  ) {
    const societyId = await this.resolveSocietyId(user);

    return await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findFirst({
        where: { id: assetId, societyId },
      });

      if (!asset) {
        throw new AppError(404, "Asset not found in this society.");
      }

      // Record maintenance log
      const maintenanceRecord = await tx.assetMaintenanceRecord.create({
        data: {
          assetId: asset.id,
          societyId,
          maintenanceType: input.maintenanceType,
          serviceDate: new Date(input.serviceDate),
          cost: input.cost ?? 0,
          servicedBy: input.servicedBy.trim(),
          notes: input.notes?.trim() || null,
          invoiceNumber: input.invoiceNumber?.trim() || null,
          nextServiceDue: input.nextServiceDue
            ? new Date(input.nextServiceDue)
            : null,
          loggedByUserId: user.id,
        },
        include: {
          loggedBy: {
            select: { id: true, fullName: true, role: true },
          },
        },
      });

      // Update asset status and next inspection date
      const updatedStatus = input.updateAssetStatus || "OPERATIONAL";
      const updatedAsset = await tx.asset.update({
        where: { id: asset.id },
        data: {
          status: updatedStatus,
          ...(input.nextServiceDue && {
            nextServiceDue: new Date(input.nextServiceDue),
          }),
        },
      });

      return {
        maintenanceRecord,
        updatedAsset: {
          id: updatedAsset.id,
          assetCode: updatedAsset.assetCode,
          name: updatedAsset.name,
          status: updatedAsset.status,
          nextServiceDue: updatedAsset.nextServiceDue,
        },
      };
    });
  }

  /**
   * 3. List Society Assets with Filters & Operational Health
   */
  static async listSocietyAssets(
    user: AuthUserPayload,
    query: AssetQueryInput
  ) {
    const societyId = await this.resolveSocietyId(user);

    const where: Prisma.AssetWhereInput = { societyId };

    if (query.category) {
      where.category = query.category;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search && query.search.trim() !== "") {
      const searchTerm = query.search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { assetCode: { contains: searchTerm, mode: "insensitive" } },
        { location: { contains: searchTerm, mode: "insensitive" } },
        { serialNumber: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;

    const totalRecords = await prisma.asset.count({ where });

    const assets = await prisma.asset.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        maintenanceLogs: {
          take: 1,
          orderBy: { serviceDate: "desc" },
          select: {
            id: true,
            maintenanceType: true,
            serviceDate: true,
            servicedBy: true,
            cost: true,
          },
        },
      },
    });

    const now = new Date();

    const formattedAssets = assets.map((item) => {
      const isWarrantyActive = item.warrantyExpiry
        ? new Date(item.warrantyExpiry) > now
        : false;

      const isAmcActive = item.amcEndDate
        ? new Date(item.amcEndDate) > now
        : false;

      let daysUntilAmcExpiry: number | null = null;
      if (item.amcEndDate) {
        const diff = new Date(item.amcEndDate).getTime() - now.getTime();
        daysUntilAmcExpiry = Math.ceil(diff / (1000 * 60 * 60 * 24));
      }

      let daysUntilNextService: number | null = null;
      if (item.nextServiceDue) {
        const diff = new Date(item.nextServiceDue).getTime() - now.getTime();
        daysUntilNextService = Math.ceil(diff / (1000 * 60 * 60 * 24));
      }

      return {
        ...item,
        isWarrantyActive,
        isAmcActive,
        daysUntilAmcExpiry,
        daysUntilNextService,
        lastService: item.maintenanceLogs[0] || null,
      };
    });

    return {
      assets: formattedAssets,
      pagination: {
        totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit),
      },
    };
  }

  /**
   * 4. Upcoming Maintenance, Warranty & AMC Expiry Alerts
   */
  static async getUpcomingMaintenanceAlerts(user: AuthUserPayload) {
    const societyId = await this.resolveSocietyId(user);
    const now = new Date();
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // AMC expiring within next 30 days
    const expiringAmcAssets = await prisma.asset.findMany({
      where: {
        societyId,
        amcEndDate: {
          gte: now,
          lte: thirtyDaysAhead,
        },
      },
      select: {
        id: true,
        assetCode: true,
        name: true,
        category: true,
        location: true,
        amcVendorName: true,
        amcVendorPhone: true,
        amcEndDate: true,
        amcCost: true,
      },
      orderBy: { amcEndDate: "asc" },
    });

    // Routine service due in 30 days or overdue
    const upcomingServiceAssets = await prisma.asset.findMany({
      where: {
        societyId,
        nextServiceDue: {
          lte: thirtyDaysAhead,
        },
      },
      select: {
        id: true,
        assetCode: true,
        name: true,
        category: true,
        location: true,
        status: true,
        nextServiceDue: true,
      },
      orderBy: { nextServiceDue: "asc" },
    });

    // Warranty expiring within next 30 days
    const expiringWarrantyAssets = await prisma.asset.findMany({
      where: {
        societyId,
        warrantyExpiry: {
          gte: now,
          lte: thirtyDaysAhead,
        },
      },
      select: {
        id: true,
        assetCode: true,
        name: true,
        category: true,
        manufacturer: true,
        warrantyExpiry: true,
      },
      orderBy: { warrantyExpiry: "asc" },
    });

    const formatDaysRemaining = (targetDate: Date) => {
      const diff = new Date(targetDate).getTime() - now.getTime();
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    return {
      totalAlerts:
        expiringAmcAssets.length +
        upcomingServiceAssets.length +
        expiringWarrantyAssets.length,
      expiringAmc: expiringAmcAssets.map((a) => ({
        ...a,
        daysRemaining: formatDaysRemaining(a.amcEndDate!),
      })),
      upcomingServices: upcomingServiceAssets.map((a) => ({
        ...a,
        isOverdue: new Date(a.nextServiceDue!) < now,
        daysRemaining: formatDaysRemaining(a.nextServiceDue!),
      })),
      expiringWarranties: expiringWarrantyAssets.map((a) => ({
        ...a,
        daysRemaining: formatDaysRemaining(a.warrantyExpiry!),
      })),
    };
  }

  /**
   * 5. Manage / Upsert Inventory Item
   */
  static async manageInventoryItem(
    user: AuthUserPayload,
    input: InventoryItemInput
  ) {
    const societyId = await this.resolveSocietyId(user);
    const trimmedName = input.itemName.trim();

    const existing = await prisma.inventoryItem.findFirst({
      where: {
        societyId,
        itemName: trimmedName,
      },
    });

    const isLowStock = input.quantity <= input.minimumThreshold;

    if (existing) {
      const updated = await prisma.inventoryItem.update({
        where: { id: existing.id },
        data: {
          category: input.category,
          quantity: input.quantity,
          unitOfMeasure: input.unitOfMeasure,
          minimumThreshold: input.minimumThreshold,
          unitCost: input.unitCost ?? existing.unitCost,
          isLowStock,
        },
      });

      return {
        item: updated,
        isNew: false,
      };
    }

    // Generate unique inventory code e.g. INV-0001
    const count = await prisma.inventoryItem.count({ where: { societyId } });
    const itemCode = `INV-${String(count + 1).padStart(4, "0")}`;

    const created = await prisma.inventoryItem.create({
      data: {
        societyId,
        itemCode,
        itemName: trimmedName,
        category: input.category,
        quantity: input.quantity,
        unitOfMeasure: input.unitOfMeasure,
        minimumThreshold: input.minimumThreshold,
        unitCost: input.unitCost ?? null,
        isLowStock,
      },
    });

    return {
      item: created,
      isNew: true,
    };
  }

  /**
   * 6. Adjust Inventory Stock (ACID Stock Ledger)
   */
  static async adjustInventoryStock(
    user: AuthUserPayload,
    itemId: string,
    input: AdjustStockInput
  ) {
    const societyId = await this.resolveSocietyId(user);

    return await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({
        where: { id: itemId, societyId },
      });

      if (!item) {
        throw new AppError(404, "Inventory item not found in this society.");
      }

      const newQuantity = item.quantity + input.quantityChange;

      // Enforce non-negative constraint
      if (newQuantity < 0) {
        throw new AppError(
          400,
          `Insufficient stock for '${item.itemName}'. Current stock is ${item.quantity} ${item.unitOfMeasure}, cannot consume ${Math.abs(input.quantityChange)}.`
        );
      }

      const isLowStock = newQuantity <= item.minimumThreshold;

      const updatedItem = await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          quantity: newQuantity,
          isLowStock,
        },
      });

      const stockLog = await tx.inventoryStockLog.create({
        data: {
          inventoryItemId: item.id,
          quantityChange: input.quantityChange,
          quantityAfter: newQuantity,
          reason: input.reason.trim(),
          adjustedByUserId: user.id,
        },
        include: {
          adjustedByUser: {
            select: { id: true, fullName: true, role: true },
          },
        },
      });

      return {
        item: updatedItem,
        stockLog,
      };
    });
  }

  /**
   * 7. Query Inventory Status & Threshold Warnings
   */
  static async getInventoryStatus(
    user: AuthUserPayload,
    query: InventoryQueryInput
  ) {
    const societyId = await this.resolveSocietyId(user);

    const where: Prisma.InventoryItemWhereInput = { societyId };

    if (query.category) {
      where.category = query.category;
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;

    if (query.lowStockOnly !== undefined) {
      where.isLowStock =
        query.lowStockOnly === true ||
        (query.lowStockOnly as unknown) === "true";
    }

    if (query.search && query.search.trim() !== "") {
      const searchTerm = query.search.trim();
      where.OR = [
        { itemName: { contains: searchTerm, mode: "insensitive" } },
        { itemCode: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    const totalRecords = await prisma.inventoryItem.count({ where });
    const lowStockAlertCount = await prisma.inventoryItem.count({
      where: { societyId, isLowStock: true },
    });

    const items = await prisma.inventoryItem.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ isLowStock: "desc" }, { itemName: "asc" }],
      include: {
        stockLogs: {
          take: 3,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            quantityChange: true,
            quantityAfter: true,
            reason: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      summary: {
        totalUniqueItems: totalRecords,
        lowStockAlertCount,
      },
      items,
      pagination: {
        totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit),
      },
    };
  }
}
