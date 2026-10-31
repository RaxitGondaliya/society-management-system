import { z } from "zod";

export const familyMemberSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Family member name must be at least 2 characters")
    .max(150, "Family member name cannot exceed 150 characters"),
  relation: z
    .string()
    .trim()
    .min(2, "Relation must be at least 2 characters")
    .max(50, "Relation cannot exceed 50 characters"),
  age: z
    .number()
    .int("Age must be an integer")
    .positive("Age must be positive")
    .max(120, "Age cannot exceed 120")
    .optional()
    .nullable(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+]{10,15}$/, "Invalid phone number format")
    .optional()
    .nullable(),
  isEmergencyContact: z.boolean().optional().default(false),
});

export const joinSocietySchema = z
  .object({
    societyId: z
      .string()
      .trim()
      .uuid("Invalid society ID format")
      .optional(),
    societyCode: z
      .string()
      .trim()
      .min(3, "Society code must be at least 3 characters")
      .optional(),
    unitId: z
      .string({
        error: "Unit ID is required",
      })
      .trim()
      .uuid("Invalid unit ID format"),
    fullName: z
      .string({
        error: "Full name is required",
      })
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(150, "Full name cannot exceed 150 characters"),
    phone: z
      .string({
        error: "Phone number is required",
      })
      .trim()
      .regex(/^[0-9+]{10,15}$/, "Invalid phone number format. Must be 10-15 digits"),
    email: z
      .string()
      .trim()
      .email("Invalid email address format")
      .optional()
      .nullable()
      .or(z.literal("")),
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "OTP must be a 6-digit numeric code")
      .optional(),
    memberType: z.enum(["OWNER", "TENANT"] as const, {
      error: "memberType must be either OWNER or TENANT",
    }),
    familyMembers: z.array(familyMemberSchema).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (!data.societyId && !data.societyCode) {
      ctx.addIssue({
        code: "custom",
        path: ["societyId"],
        message: "Either societyId or societyCode must be provided to join a society",
      });
    }
  });

export const approvalDecisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"] as const, {
    error: "status must be either APPROVED or REJECTED",
  }),
  rejectionReason: z
    .string()
    .trim()
    .max(255, "Rejection reason cannot exceed 255 characters")
    .optional()
    .nullable(),
});

export const membershipIdParamSchema = z.object({
  membershipId: z
    .string({
      error: "Membership ID parameter is required",
    })
    .trim()
    .uuid("Invalid membership ID format"),
});

export const updateOccupancySchema = z.object({
  occupancyStatus: z
    .enum(["OCCUPIED_OWNER", "OCCUPIED_TENANT", "VACANT"] as const, {
      error: "Invalid occupancy status",
    })
    .optional(),
  isPrimaryHead: z.boolean().optional(),
});

export const unitIdParamSchema = z.object({
  unitId: z
    .string({
      error: "Unit ID parameter is required",
    })
    .trim()
    .uuid("Invalid unit ID format"),
});

/**
 * Self-service profile update schema (PUT /api/v1/users/me)
 * SECURITY: Strictly forbids role or status modifications to prevent privilege escalation.
 */
export const updateMyProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(150, "Name cannot exceed 150 characters")
      .optional(),
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(150, "Full name cannot exceed 150 characters")
      .optional(),
    residentType: z
      .enum(["OWNER", "TENANT"] as const, {
        error: "residentType must be either OWNER or TENANT",
      })
      .optional()
      .nullable(),
    emergencyContact: z
      .string()
      .trim()
      .max(30, "Emergency contact cannot exceed 30 characters")
      .optional()
      .nullable()
      .or(z.literal("")),
    avatarUrl: z
      .string()
      .trim()
      .max(2048, "Avatar URL cannot exceed 2048 characters")
      .optional()
      .nullable()
      .or(z.literal("")),
    avatar: z
      .string()
      .trim()
      .max(2048, "Avatar URL cannot exceed 2048 characters")
      .optional()
      .nullable()
      .or(z.literal("")),
    email: z
      .string()
      .trim()
      .email("Invalid email address format")
      .optional()
      .nullable()
      .or(z.literal("")),
    // Explicitly capture forbidden fields to return a clear security error if supplied
    role: z.any().optional(),
    status: z.any().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["role"],
        message: "Forbidden: You cannot modify your own role.",
      });
    }
    if (data.status !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "Forbidden: You cannot modify your own approval status.",
      });
    }
  });

export const adminUserIdParamSchema = z.object({
  id: z
    .string({
      error: "User or Request ID parameter is required",
    })
    .trim()
    .uuid("Invalid ID format"),
});

export const adminUpdateUserStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "PENDING"] as const, {
    error: "status must be APPROVED, REJECTED, or PENDING",
  }),
  role: z
    .enum([
      "SUPER_ADMIN",
      "SOCIETY_ADMIN",
      "SUB_ADMIN",
      "RESIDENT",
      "GUARD",
    ] as const)
    .optional(),
  residentType: z.enum(["OWNER", "TENANT"] as const).optional().nullable(),
  rejectionReason: z
    .string()
    .trim()
    .max(255, "Rejection reason cannot exceed 255 characters")
    .optional()
    .nullable(),
  unitId: z.string().trim().uuid("Invalid unit ID format").optional().nullable(),
});

export type JoinSocietyInput = z.infer<typeof joinSocietySchema>;
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;
export type UpdateOccupancyInput = z.infer<typeof updateOccupancySchema>;
export type FamilyMemberInput = z.infer<typeof familyMemberSchema>;
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;
export type AdminUpdateUserStatusInput = z.infer<typeof adminUpdateUserStatusSchema>;
