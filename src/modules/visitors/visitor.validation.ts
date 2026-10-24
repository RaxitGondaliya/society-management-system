import { z } from "zod";

export const createVisitorEntrySchema = z.object({
  societyId: z
    .string()
    .trim()
    .uuid("Invalid society ID format")
    .optional(),
  unitId: z
    .string({
      error: "unitId is required",
    })
    .trim()
    .uuid("Invalid unit ID format"),
  visitorName: z
    .string({
      error: "visitorName is required",
    })
    .trim()
    .min(2, "Visitor name must be at least 2 characters")
    .max(150, "Visitor name cannot exceed 150 characters"),
  phone: z
    .string({
      error: "phone is required",
    })
    .trim()
    .regex(/^[0-9+]{10,15}$/, "Invalid phone number format. Must be 10-15 digits"),
  purpose: z
    .string()
    .trim()
    .max(200, "Purpose cannot exceed 200 characters")
    .optional(),
  category: z
    .enum(["GUEST", "DELIVERY", "CAB", "SERVICE", "OTHER"] as const)
    .optional()
    .default("GUEST"),
  vehicleNumber: z
    .string()
    .trim()
    .max(30, "Vehicle number cannot exceed 30 characters")
    .optional()
    .nullable(),
  vehicleType: z
    .enum(["TWO_WHEELER", "FOUR_WHEELER", "NONE"] as const)
    .optional()
    .default("NONE"),
  photoUrl: z
    .string()
    .trim()
    .optional()
    .nullable(),
  expectedDurationMinutes: z
    .number()
    .int("expectedDurationMinutes must be an integer")
    .positive("expectedDurationMinutes must be positive")
    .max(1440, "expectedDurationMinutes cannot exceed 24 hours")
    .optional(),
  passcode: z
    .string()
    .trim()
    .min(4, "Passcode must be at least 4 digits")
    .max(10, "Passcode cannot exceed 10 digits")
    .optional(),
});

export const preApproveGuestSchema = z.object({
  societyId: z
    .string()
    .trim()
    .uuid("Invalid society ID format")
    .optional(),
  unitId: z
    .string()
    .trim()
    .uuid("Invalid unit ID format")
    .optional(),
  visitorName: z
    .string({
      error: "visitorName is required",
    })
    .trim()
    .min(2, "Visitor name must be at least 2 characters")
    .max(150, "Visitor name cannot exceed 150 characters"),
  phone: z
    .string({
      error: "phone is required",
    })
    .trim()
    .regex(/^[0-9+]{10,15}$/, "Invalid phone number format. Must be 10-15 digits"),
  purpose: z
    .string()
    .trim()
    .max(200, "Purpose cannot exceed 200 characters")
    .optional(),
  category: z
    .enum(["GUEST", "DELIVERY", "CAB", "SERVICE", "OTHER"] as const)
    .optional()
    .default("GUEST"),
  expectedArrival: z
    .string()
    .trim()
    .optional(),
  vehicleNumber: z
    .string()
    .trim()
    .max(30, "Vehicle number cannot exceed 30 characters")
    .optional()
    .nullable(),
});

export const visitorDecisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "DENIED", "LEAVE_AT_GATE"] as const, {
    error: "status must be APPROVED, REJECTED, DENIED, or LEAVE_AT_GATE",
  }),
});

export const visitorCheckoutSchema = z.object({
  checkoutNotes: z
    .string()
    .trim()
    .max(255, "Checkout notes cannot exceed 255 characters")
    .optional(),
});

export const visitorIdParamSchema = z.object({
  visitorId: z
    .string({
      error: "visitorId parameter is required",
    })
    .trim()
    .uuid("Invalid visitor ID format"),
});

export const visitorQuerySchema = z.object({
  status: z
    .enum([
      "PENDING_APPROVAL",
      "APPROVED",
      "DENIED",
      "REJECTED",
      "CHECKED_IN",
      "CHECKED_OUT",
      "LEAVE_AT_GATE",
    ] as const)
    .optional(),
  unitId: z
    .string()
    .trim()
    .uuid("Invalid unit ID format")
    .optional(),
  societyId: z
    .string()
    .trim()
    .uuid("Invalid society ID format")
    .optional(),
  startDate: z
    .string()
    .trim()
    .optional(),
  endDate: z
    .string()
    .trim()
    .optional(),
  page: z
    .string()
    .optional()
    .default("1"),
  limit: z
    .string()
    .optional()
    .default("20"),
});

export type CreateVisitorEntryInput = z.infer<typeof createVisitorEntrySchema>;
export type PreApproveGuestInput = z.infer<typeof preApproveGuestSchema>;
export type VisitorDecisionInput = z.infer<typeof visitorDecisionSchema>;
export type VisitorCheckoutInput = z.infer<typeof visitorCheckoutSchema>;
export type VisitorQueryParams = z.infer<typeof visitorQuerySchema>;
