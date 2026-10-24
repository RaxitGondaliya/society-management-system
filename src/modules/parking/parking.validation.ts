import { z } from "zod";

export const PARKING_ZONES = [
  "BASEMENT_1",
  "BASEMENT_2",
  "GROUND",
  "STILT",
  "OPEN_PODIUM",
] as const;

export const VEHICLE_TYPES = [
  "TWO_WHEELER",
  "FOUR_WHEELER",
  "HEAVY_VEHICLE",
] as const;

export const RESIDENT_VEHICLE_TYPES = [
  "TWO_WHEELER",
  "FOUR_WHEELER",
] as const;

export const SLOT_TYPES = [
  "DEDICATED_RESIDENT",
  "GUEST_VISITOR",
  "COMMERCIAL_SERVICE",
] as const;

export const ALLOCATION_TYPES = [
  "PERMANENT_DEEDED",
  "ANNUAL_LEASE",
  "TEMPORARY",
] as const;

export const GATE_ACTIONS = ["ENTRY", "EXIT"] as const;

export const VIOLATION_TYPES = [
  "UNAUTHORIZED_SLOT",
  "PARKED_WITHOUT_PERMIT",
  "BLOCKED_DRIVEWAY",
  "ILLEGAL_EV_CHARGING",
] as const;

export const createSlotSchema = z.object({
  slotNumber: z
    .string()
    .min(2, "Slot number must be at least 2 characters long")
    .max(50, "Slot number must not exceed 50 characters")
    .transform((val) => val.trim().toUpperCase()),
  zone: z.enum(PARKING_ZONES),
  vehicleType: z.enum(VEHICLE_TYPES),
  slotType: z.enum(SLOT_TYPES).default("DEDICATED_RESIDENT"),
  hasEvCharging: z.boolean().default(false),
});

export const allocateSlotSchema = z.object({
  slotId: z.string().uuid("Invalid slotId format. Must be a valid UUID"),
  unitId: z.string().uuid("Invalid unitId format. Must be a valid UUID"),
  allocationType: z.enum(ALLOCATION_TYPES).optional().default("PERMANENT_DEEDED"),
  monthlyFee: z
    .number()
    .min(0, "Monthly fee must be a non-negative number")
    .optional()
    .default(0),
});

export const registerVehicleSchema = z.object({
  licensePlate: z
    .string()
    .min(4, "License plate must be at least 4 characters long")
    .max(20, "License plate must not exceed 20 characters")
    .transform((val) => val.trim().toUpperCase()),
  unitId: z.string().uuid("Invalid unitId format. Must be a valid UUID"),
  vehicleType: z.enum(RESIDENT_VEHICLE_TYPES),
  makeModel: z
    .string()
    .min(2, "Vehicle make and model must be at least 2 characters long")
    .max(100),
  rfidTag: z.string().max(50).optional().nullable(),
  fastagId: z.string().max(50).optional().nullable(),
  parkingSlotId: z.string().uuid("Invalid parkingSlotId format").optional().nullable(),
});

export const vehicleGateLogSchema = z.object({
  licensePlate: z
    .string()
    .min(4, "License plate must be at least 4 characters long")
    .max(20)
    .transform((val) => val.trim().toUpperCase()),
  action: z.enum(GATE_ACTIONS),
  gateNumber: z.string().max(50).optional().nullable(),
});

export const parkingViolationSchema = z.object({
  vehicleNumber: z
    .string()
    .min(4, "Vehicle number must be at least 4 characters long")
    .max(20)
    .transform((val) => val.trim().toUpperCase()),
  slotId: z.string().uuid("Invalid slotId format. Must be a valid UUID"),
  violationType: z.enum(VIOLATION_TYPES),
  penaltyAmount: z
    .number()
    .min(0, "Penalty amount must be a non-negative number")
    .optional()
    .default(0),
  photoUrl: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const parkingQuerySchema = z.object({
  zone: z.enum(PARKING_ZONES).optional(),
  vehicleType: z.enum(VEHICLE_TYPES).optional(),
  slotType: z.enum(SLOT_TYPES).optional(),
  isAllocated: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === "true")
    .optional(),
  hasEvCharging: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === "true")
    .optional(),
  unitId: z.string().uuid().optional(),
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

export type CreateSlotInput = z.infer<typeof createSlotSchema>;
export type AllocateSlotInput = z.infer<typeof allocateSlotSchema>;
export type RegisterVehicleInput = z.infer<typeof registerVehicleSchema>;
export type VehicleGateLogInput = z.infer<typeof vehicleGateLogSchema>;
export type ParkingViolationInput = z.infer<typeof parkingViolationSchema>;
export type ParkingQueryInput = z.infer<typeof parkingQuerySchema>;
