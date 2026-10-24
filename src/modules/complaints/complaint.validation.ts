import { z } from "zod";

export const COMPLAINT_CATEGORIES = [
  "PLUMBING",
  "ELECTRICAL",
  "CARPENTRY",
  "LIFT",
  "SECURITY",
  "PARKING",
  "NOISE",
  "COMMON_AREA",
  "OTHER",
] as const;

export const COMPLAINT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const COMPLAINT_SCOPES = ["PERSONAL", "COMMUNITY"] as const;

export const COMPLAINT_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
] as const;

export const createComplaintSchema = z
  .object({
    title: z
      .string()
      .min(5, "Title must be at least 5 characters long")
      .max(255, "Title must not exceed 255 characters"),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters long"),
    category: z.enum(COMPLAINT_CATEGORIES),
    priority: z.enum(COMPLAINT_PRIORITIES).default("MEDIUM"),
    scope: z.enum(COMPLAINT_SCOPES),
    unitId: z.string().uuid("Invalid unitId format. Must be a valid UUID").optional().nullable(),
    images: z.array(z.string()).optional(),
    photoUrl: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.scope === "PERSONAL" && !data.unitId) {
        return false;
      }
      return true;
    },
    {
      message: "unitId is required when scope is 'PERSONAL'",
      path: ["unitId"],
    }
  );

export const updateComplaintStatusSchema = z.object({
  status: z.enum(COMPLAINT_STATUSES),
  assignedToStaffId: z
    .string()
    .uuid("Invalid staff user ID format")
    .optional()
    .nullable(),
  resolutionNotes: z.string().max(1000).optional().nullable(),
  resolutionProofUrl: z.string().optional().nullable(),
});

export const complaintFeedbackSchema = z.object({
  rating: z
    .number()
    .int("Rating must be an integer")
    .min(1, "Rating must be between 1 and 5 stars")
    .max(5, "Rating must be between 1 and 5 stars"),
  feedback: z.string().max(1000).optional().nullable(),
});

export const complaintQuerySchema = z.object({
  status: z.enum(COMPLAINT_STATUSES).optional(),
  category: z.enum(COMPLAINT_CATEGORIES).optional(),
  priority: z.enum(COMPLAINT_PRIORITIES).optional(),
  scope: z.enum(COMPLAINT_SCOPES).optional(),
  unitId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, "startDate must be a valid ISO Date format (YYYY-MM-DD)")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, "endDate must be a valid ISO Date format (YYYY-MM-DD)")
    .optional(),
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

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintStatusInput = z.infer<typeof updateComplaintStatusSchema>;
export type ComplaintFeedbackInput = z.infer<typeof complaintFeedbackSchema>;
export type ComplaintQueryInput = z.infer<typeof complaintQuerySchema>;
