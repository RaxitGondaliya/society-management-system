import { z } from "zod";

export const registerSocietySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Society name must be at least 3 characters")
      .max(255, "Society name cannot exceed 255 characters"),
    propertyType: z.enum(["FLAT", "ROW_HOUSE", "VILLA"] as const, {
      error: "propertyType must be FLAT, ROW_HOUSE, or VILLA",
    }),
    address: z
      .string()
      .trim()
      .min(5, "Address must be at least 5 characters"),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
    bankAccountNo: z.string().trim().optional().nullable(),
    bankIfsc: z.string().trim().optional().nullable(),
    bankBeneficiaryName: z.string().trim().optional().nullable(),
    upiId: z.string().trim().optional().nullable(),
    layout: z.object({
      // Flat properties layout
      wings: z.array(z.string().trim().min(1, "Wing name cannot be empty")).optional(),
      floorsPerWing: z.number().int().positive("Floors per wing must be greater than 0").max(100).optional(),
      unitsPerFloor: z.number().int().positive("Units per floor must be greater than 0").max(50).optional(),

      // Row House / Villa properties layout
      totalUnits: z.number().int().positive("Total units must be greater than 0").max(2000).optional(),
      unitPrefix: z.string().trim().optional(),
      sections: z.array(z.string().trim().min(1, "Section name cannot be empty")).optional(),
    }),
    admin: z.object({
      fullName: z
        .string()
        .trim()
        .min(2, "Admin full name must be at least 2 characters")
        .max(150, "Admin full name cannot exceed 150 characters"),
      phone: z
        .string()
        .trim()
        .regex(/^[0-9+]{10,15}$/, "Invalid phone number format. Must be 10-15 digits"),
      email: z
        .string()
        .trim()
        .email("Invalid email address format")
        .optional()
        .nullable(),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.propertyType === "FLAT") {
      if (!data.layout.wings || data.layout.wings.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["layout", "wings"],
          message: "Wings list is required for FLAT property type (e.g. ['A', 'B'])",
        });
      }
      if (!data.layout.floorsPerWing || data.layout.floorsPerWing <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["layout", "floorsPerWing"],
          message: "floorsPerWing must be a positive number for FLAT property type",
        });
      }
      if (!data.layout.unitsPerFloor || data.layout.unitsPerFloor <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["layout", "unitsPerFloor"],
          message: "unitsPerFloor must be a positive number for FLAT property type",
        });
      }
    } else if (data.propertyType === "ROW_HOUSE" || data.propertyType === "VILLA") {
      if (!data.layout.totalUnits || data.layout.totalUnits <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["layout", "totalUnits"],
          message: `totalUnits must be a positive integer for ${data.propertyType} property type`,
        });
      }
    }
  });

export const getSocietyByCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Society code must be at least 3 characters"),
});

export type RegisterSocietyInput = z.infer<typeof registerSocietySchema>;
export type GetSocietyByCodeInput = z.infer<typeof getSocietyByCodeSchema>;
