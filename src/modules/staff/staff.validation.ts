import { z } from "zod";

export const STAFF_TYPES = [
  "MAID",
  "DRIVER",
  "COOK",
  "CLEANER",
  "GARDENER",
  "SECURITY_GUARD",
  "TECHNICIAN",
  "OTHER",
] as const;

export const ID_PROOF_TYPES = [
  "AADHAAR",
  "PAN",
  "VOTER_ID",
  "DRIVING_LICENSE",
] as const;

export const POLICE_VERIFICATION_STATUSES = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
] as const;

export const ATTENDANCE_ACTIONS = ["CHECK_IN", "CHECK_OUT"] as const;

const phoneRegex = /^\+?[0-9]{10,15}$/;

export const createStaffSchema = z.object({
  fullName: z
    .string()
    .min(3, "Full name must be at least 3 characters long")
    .max(150, "Full name must not exceed 150 characters"),
  phone: z
    .string()
    .regex(phoneRegex, "Phone number must be between 10 and 15 digits"),
  staffType: z.enum(STAFF_TYPES),
  idProofType: z.enum(ID_PROOF_TYPES).optional().nullable(),
  idProofNumber: z.string().max(50).optional().nullable(),
  policeVerificationStatus: z.enum(POLICE_VERIFICATION_STATUSES).default("PENDING"),
  photoUrl: z.string().optional().nullable(),
  emergencyContact: z
    .string()
    .regex(phoneRegex, "Emergency contact must be between 10 and 15 digits")
    .optional()
    .nullable(),
  unitId: z.string().uuid("Invalid unitId format").optional().nullable(),
  jobDescription: z.string().max(255).optional().nullable(),
});

export const assignFlatSchema = z.object({
  staffId: z.string().uuid("Invalid staffId format. Must be a valid UUID"),
  unitId: z.string().uuid("Invalid unitId format. Must be a valid UUID"),
  jobDescription: z.string().max(255).optional().nullable(),
});

export const staffAttendanceSchema = z
  .object({
    staffId: z.string().uuid("Invalid staffId format").optional(),
    passcode: z.string().min(4, "Passcode / Staff Code must be at least 4 characters").optional(),
    action: z.enum(ATTENDANCE_ACTIONS),
  })
  .refine(
    (data) => data.staffId !== undefined || data.passcode !== undefined,
    {
      message: "Either staffId or passcode must be provided",
      path: ["staffId"],
    }
  );

export const staffRatingSchema = z.object({
  rating: z
    .number()
    .int("Rating must be an integer")
    .min(1, "Rating must be between 1 and 5 stars")
    .max(5, "Rating must be between 1 and 5 stars"),
  unitId: z.string().uuid("Invalid unitId format").optional().nullable(),
  review: z.string().max(500).optional().nullable(),
});

export const staffQuerySchema = z.object({
  staffType: z.enum(STAFF_TYPES).optional(),
  policeVerificationStatus: z.enum(POLICE_VERIFICATION_STATUSES).optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === "true")
    .optional(),
  unitId: z.string().uuid().optional(),
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

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type AssignFlatInput = z.infer<typeof assignFlatSchema>;
export type StaffAttendanceInput = z.infer<typeof staffAttendanceSchema>;
export type StaffRatingInput = z.infer<typeof staffRatingSchema>;
export type StaffQueryInput = z.infer<typeof staffQuerySchema>;
