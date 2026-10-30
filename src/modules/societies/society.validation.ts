import { z } from "zod";
import { sanitizeMobileNumber } from "../../utils/sms.service";

/**
 * Normalizes registration payloads whether fields are nested (admin, layout)
 * or flattened directly on the root object (e.g. email, phone, fullName, societyName).
 */
export const normalizeRegistrationInput = (raw: any): any => {
  if (!raw || typeof raw !== "object") return raw;

  const societyName = (raw.name || raw.societyName || "").toString().trim();
  const address = (raw.address || `${societyName || "Main"} Society Premises`).toString().trim();
  const propertyType = ["FLAT", "ROW_HOUSE", "VILLA"].includes(raw.propertyType)
    ? raw.propertyType
    : "FLAT";

  // Build admin object with normalized phone and email
  const adminFullName = (raw.admin?.fullName || raw.fullName || raw.adminName || "Administrator").toString().trim();
  const rawPhoneStr = (raw.admin?.phone || raw.phone || "").toString().trim();
  const clean10 = sanitizeMobileNumber(rawPhoneStr);
  const adminPhone = clean10.length === 10 ? `+91${clean10}` : (rawPhoneStr.startsWith("+") ? rawPhoneStr : `+91${rawPhoneStr}`);
  const rawEmail = (raw.admin?.email || raw.email || "").toString().trim().toLowerCase();
  const adminEmail = rawEmail.length > 0 ? rawEmail : null;
  const otp = (raw.otp || raw.admin?.otp || "").toString().trim() || undefined;

  // Build layout object
  let layout = raw.layout;
  if (!layout || typeof layout !== "object") {
    if (propertyType === "FLAT") {
      layout = {
        wings: Array.isArray(raw.wings) && raw.wings.length > 0 ? raw.wings : ["Wing A"],
        floorsPerWing: Number(raw.floorsPerWing) || 2,
        unitsPerFloor: Number(raw.unitsPerFloor) || 2,
      };
    } else {
      layout = {
        totalUnits: Number(raw.totalUnits) || 10,
        unitPrefix: raw.unitPrefix || (propertyType === "VILLA" ? "Villa-" : "RH-"),
        sections: Array.isArray(raw.sections) && raw.sections.length > 0 ? raw.sections : ["Main Section"],
      };
    }
  } else if (propertyType === "VILLA" || propertyType === "ROW_HOUSE") {
    const rawSections = Array.isArray(layout.sections) && layout.sections.length > 0
      ? layout.sections
      : (Array.isArray(layout.wings) && layout.wings.length > 0 ? layout.wings : ["Main Section"]);
    const computedTotal = Number(layout.totalUnits) || (Number(layout.floorsPerWing || 1) * Number(layout.unitsPerFloor || 1) * rawSections.length) || 10;
    layout = {
      ...layout,
      sections: rawSections,
      totalUnits: computedTotal,
      unitPrefix: layout.unitPrefix || (propertyType === "VILLA" ? "Villa-" : "RH-"),
    };
  }

  return {
    ...raw,
    name: societyName,
    propertyType,
    address,
    admin: {
      fullName: adminFullName,
      phone: adminPhone,
      email: adminEmail,
    },
    ...(otp ? { otp } : {}),
    layout,
  };
};

export const baseRegisterSocietySchema = z
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
      .min(3, "Address must be at least 3 characters"),
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
        .nullable()
        .or(z.literal("")),
    }),
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "OTP must be a 6-digit numeric code")
      .optional(),
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

export const registerSocietySchema = z.preprocess(
  normalizeRegistrationInput,
  baseRegisterSocietySchema
);

export const getSocietyByCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Society code must be at least 3 characters"),
});

export type RegisterSocietyInput = z.infer<typeof baseRegisterSocietySchema>;
export type GetSocietyByCodeInput = z.infer<typeof getSocietyByCodeSchema>;
