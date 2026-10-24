import { z } from "zod";

export const ASSET_CATEGORIES = [
  "ELECTRICAL",
  "PLUMBING",
  "ELEVATOR",
  "SECURITY_SYSTEM",
  "FIRE_SAFETY",
  "GYM_EQUIPMENT",
  "OTHER",
] as const;

export const ASSET_STATUSES = [
  "OPERATIONAL",
  "UNDER_MAINTENANCE",
  "DECOMMISSIONED",
] as const;

export const MAINTENANCE_TYPES = [
  "PREVENTIVE_AMC",
  "BREAKDOWN_REPAIR",
  "ROUTINE_INSPECTION",
] as const;

export const INVENTORY_CATEGORIES = [
  "LIGHTING",
  "PLUMBING_PARTS",
  "CLEANING_CHEMICALS",
  "ELECTRICAL_PARTS",
  "STATIONERY",
  "OTHER",
] as const;

export const UNIT_OF_MEASURES = [
  "PIECES",
  "KG",
  "LITERS",
  "BOXES",
  "METERS",
] as const;

const phoneRegex = /^\+?[0-9]{10,15}$/;

const isIsoDate = (val: string) => !isNaN(Date.parse(val));

export const createAssetSchema = z.object({
  name: z
    .string()
    .min(3, "Asset name must be at least 3 characters long")
    .max(150, "Asset name must not exceed 150 characters"),
  category: z.enum(ASSET_CATEGORIES),
  location: z
    .string()
    .min(2, "Location must be at least 2 characters long")
    .max(100, "Location must not exceed 100 characters"),
  serialNumber: z.string().max(100).optional().nullable(),
  modelNumber: z.string().max(100).optional().nullable(),
  manufacturer: z.string().max(100).optional().nullable(),
  purchaseDate: z
    .string()
    .refine(isIsoDate, "purchaseDate must be a valid ISO date string"),
  purchaseCost: z
    .number()
    .min(0, "Purchase cost must be a non-negative number")
    .optional()
    .nullable(),
  warrantyExpiry: z
    .string()
    .refine(isIsoDate, "warrantyExpiry must be a valid ISO date string")
    .optional()
    .nullable(),
  amcDetails: z
    .object({
      vendorName: z
        .string()
        .min(2, "Vendor name must be at least 2 characters long")
        .max(100),
      vendorPhone: z
        .string()
        .regex(phoneRegex, "Vendor phone must be between 10 and 15 digits"),
      startDate: z
        .string()
        .refine(isIsoDate, "startDate must be a valid ISO date string"),
      endDate: z
        .string()
        .refine(isIsoDate, "endDate must be a valid ISO date string"),
      cost: z
        .number()
        .min(0, "AMC cost must be a non-negative number")
        .optional()
        .nullable(),
    })
    .optional()
    .nullable(),
});

export const logMaintenanceRecordSchema = z.object({
  assetId: z.string().uuid("Invalid assetId format. Must be a valid UUID").optional(),
  maintenanceType: z.enum(MAINTENANCE_TYPES),
  serviceDate: z
    .string()
    .refine(isIsoDate, "serviceDate must be a valid ISO date string"),
  cost: z
    .number()
    .min(0, "Maintenance cost must be a non-negative number")
    .default(0),
  servicedBy: z
    .string()
    .min(2, "Serviced by technician or vendor name is required")
    .max(100),
  notes: z.string().max(1000).optional().nullable(),
  invoiceNumber: z.string().max(100).optional().nullable(),
  nextServiceDue: z
    .string()
    .refine(isIsoDate, "nextServiceDue must be a valid ISO date string")
    .optional()
    .nullable(),
  updateAssetStatus: z.enum(ASSET_STATUSES).optional(),
});

export const inventoryItemSchema = z.object({
  itemName: z
    .string()
    .min(2, "Item name must be at least 2 characters long")
    .max(150),
  category: z.enum(INVENTORY_CATEGORIES),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .min(0, "Quantity cannot be negative")
    .default(0),
  unitOfMeasure: z.enum(UNIT_OF_MEASURES),
  minimumThreshold: z
    .number()
    .int("Minimum threshold must be an integer")
    .min(1, "Minimum threshold must be at least 1")
    .default(5),
  unitCost: z
    .number()
    .min(0, "Unit cost must be a non-negative number")
    .optional()
    .nullable(),
});

export const adjustStockSchema = z.object({
  quantityChange: z
    .number()
    .int("quantityChange must be an integer")
    .refine(
      (val) => val !== 0,
      "quantityChange must be a non-zero integer (positive to restock, negative to consume)"
    ),
  reason: z
    .string()
    .min(3, "Reason must be at least 3 characters long")
    .max(255),
});

export const assetQuerySchema = z.object({
  category: z.enum(ASSET_CATEGORIES).optional(),
  status: z.enum(ASSET_STATUSES).optional(),
  search: z.string().optional(),
  page: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val) || 1)
    .optional()
    .default(1),
  limit: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val) || 20)
    .optional()
    .default(20),
});

export const inventoryQuerySchema = z.object({
  category: z.enum(INVENTORY_CATEGORIES).optional(),
  lowStockOnly: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === "true")
    .optional(),
  search: z.string().optional(),
  page: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val) || 1)
    .optional()
    .default(1),
  limit: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val) || 20)
    .optional()
    .default(20),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type LogMaintenanceRecordInput = z.infer<typeof logMaintenanceRecordSchema>;
export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type AssetQueryInput = z.infer<typeof assetQuerySchema>;
export type InventoryQueryInput = z.infer<typeof inventoryQuerySchema>;
