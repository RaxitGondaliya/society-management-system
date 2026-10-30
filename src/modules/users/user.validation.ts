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

export type JoinSocietyInput = z.infer<typeof joinSocietySchema>;
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;
export type UpdateOccupancyInput = z.infer<typeof updateOccupancySchema>;
export type FamilyMemberInput = z.infer<typeof familyMemberSchema>;
