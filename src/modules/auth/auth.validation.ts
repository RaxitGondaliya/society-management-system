import { z } from "zod";
import { sanitizeMobileNumber } from "../../utils/sms.service";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

const isValidIdentifierFormat = (data: {
  identifier?: string;
  email?: string;
  phone?: string;
  type?: "mobile" | "email";
}): boolean => {
  const raw = (data.identifier || data.email || data.phone || "").trim();
  if (!raw) return false;

  const isEmailCandidate = data.type === "email" || raw.includes("@") || Boolean(data.email);
  if (isEmailCandidate) {
    const emailTarget = (data.email || raw).trim();
    return EMAIL_REGEX.test(emailTarget);
  }

  const cleanedMobile = sanitizeMobileNumber(data.phone || raw);
  return INDIAN_MOBILE_REGEX.test(cleanedMobile);
};

/**
 * Dispatch OTP request schema (supports email or mobile phone)
 */
export const sendOtpSchema = z
  .object({
    identifier: z.string().trim().optional(),
    email: z
      .string()
      .trim()
      .email("Invalid email address format")
      .optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s]{10,15}$/, "Invalid phone number format. Must be 10-15 digits")
      .optional(),
    type: z.enum(["mobile", "email"]).optional(),
  })
  .refine((data) => Boolean(data.identifier || data.email || data.phone), {
    message: "Either identifier, email address, or phone number is required to dispatch OTP",
  })
  .refine((data) => isValidIdentifierFormat(data), {
    message:
      "Identifier must be a valid email address or a valid 10-digit Indian mobile number starting with 6-9",
  });

export type SendOtpInput = z.infer<typeof sendOtpSchema>;

/**
 * OTP Verification schema
 */
export const verifyOtpSchema = z
  .object({
    identifier: z.string().trim().optional(),
    email: z
      .string()
      .trim()
      .email("Invalid email address format")
      .optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s]{10,15}$/, "Invalid phone number format. Must be 10-15 digits")
      .optional(),
    otp: z
      .string({
        error: "Verification code is required",
      })
      .trim()
      .length(6, "Verification code must be exactly 6 digits")
      .regex(/^\d{6}$/, "Verification code must consist of 6 numeric digits"),
    type: z.enum(["mobile", "email"]).optional(),
  })
  .refine((data) => Boolean(data.identifier || data.email || data.phone), {
    message: "Either identifier, email address, or phone number is required to verify OTP",
  })
  .refine((data) => isValidIdentifierFormat(data), {
    message:
      "Identifier must be a valid email address or a valid 10-digit Indian mobile number starting with 6-9",
  });

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/**
 * Universal Login schema (requires Phone/Email/Identifier and 6-digit OTP)
 */
export const loginSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s]{10,15}$/, "Invalid phone number format. Must be 10-15 digits")
      .optional(),
    email: z
      .string()
      .trim()
      .email("Invalid email address format")
      .optional(),
    identifier: z.string().trim().optional(),
    otp: z
      .string({
        error: "Verification code is required",
      })
      .trim()
      .length(6, "Verification code must be exactly 6 digits")
      .regex(/^\d{6}$/, "Verification code must consist of 6 numeric digits"),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .optional(),
    type: z.enum(["mobile", "email"]).optional(),
  })
  .refine((data) => Boolean(data.phone || data.email || data.identifier), {
    message: "Phone number or email address is required for authentication",
  })
  .refine((data) => isValidIdentifierFormat(data), {
    message:
      "Identifier must be a valid email address or a valid 10-digit Indian mobile number starting with 6-9",
  });

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Registration Mobile OTP Dispatch schema
 * POST /api/v1/auth/register-otp
 */
export const registerOtpSchema = z
  .object({
    phone: z.string().trim().optional(),
    mobile: z.string().trim().optional(),
    identifier: z.string().trim().optional(),
    allowExisting: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.phone || data.mobile || data.identifier), {
    message: "Mobile phone number is required",
  })
  .refine(
    (data) => {
      const cleaned = sanitizeMobileNumber(
        data.phone || data.mobile || data.identifier || ""
      );
      return INDIAN_MOBILE_REGEX.test(cleaned);
    },
    {
      message: "Please provide a valid 10-digit Indian mobile number starting with 6-9",
    }
  );

export type RegisterOtpInput = z.infer<typeof registerOtpSchema>;

/**
 * Registration Mobile OTP Pre-Verification schema
 * POST /api/v1/auth/verify-register-otp
 */
export const verifyRegisterOtpSchema = z
  .object({
    phone: z.string().trim().optional(),
    mobile: z.string().trim().optional(),
    identifier: z.string().trim().optional(),
    otp: z
      .string({
        error: "Verification code is required",
      })
      .trim()
      .length(6, "Verification code must be exactly 6 digits")
      .regex(/^\d{6}$/, "Verification code must consist of 6 numeric digits"),
  })
  .refine((data) => Boolean(data.phone || data.mobile || data.identifier), {
    message: "Mobile phone number is required",
  })
  .refine(
    (data) => {
      const cleaned = sanitizeMobileNumber(
        data.phone || data.mobile || data.identifier || ""
      );
      return INDIAN_MOBILE_REGEX.test(cleaned);
    },
    {
      message: "Please provide a valid 10-digit Indian mobile number starting with 6-9",
    }
  );

export type VerifyRegisterOtpInput = z.infer<typeof verifyRegisterOtpSchema>;

/**
 * Registration Submission schema (requires Mobile OTP verification; Email is optional)
 * POST /api/v1/auth/register
 */
export const registerUserSchema = z
  .object({
    name: z.string().trim().optional(),
    fullName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    otp: z
      .string({
        error: "6-digit mobile verification OTP is required",
      })
      .trim()
      .length(6, "Verification code must be exactly 6 digits")
      .regex(/^\d{6}$/, "Verification code must consist of 6 numeric digits"),
    role: z
      .enum([
        "SUPER_ADMIN",
        "SOCIETY_ADMIN",
        "SUB_ADMIN",
        "COMMITTEE",
        "RESIDENT",
        "GUARD",
        "SECURITY",
      ])
      .optional(),
    societyId: z.string().trim().optional().nullable(),
    societyCode: z.string().trim().optional().nullable(),
    unitId: z.string().trim().optional().nullable(),
    memberType: z.enum(["OWNER", "TENANT"]).optional(),
    residentType: z.enum(["OWNER", "TENANT"]).optional(),
    emergencyContact: z.string().trim().optional().nullable(),
    email: z
      .string()
      .trim()
      .email("Invalid email address format")
      .optional()
      .nullable()
      .or(z.literal("")),
    // Optional society registration fields if registering a society campus via /auth/register
    societyName: z.string().trim().optional(),
    propertyType: z.enum(["FLAT", "ROW_HOUSE", "VILLA"]).optional(),
    address: z.string().trim().optional(),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
    layout: z.any().optional(),
    admin: z
      .object({
        fullName: z.string().trim().optional(),
        phone: z.string().trim().optional(),
        email: z
          .string()
          .trim()
          .email("Invalid email address format")
          .optional()
          .nullable()
          .or(z.literal("")),
      })
      .optional(),
    plan: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      const resolvedName = (data.name || data.fullName || data.admin?.fullName || "").trim();
      return resolvedName.length >= 2;
    },
    {
      message: "Full name is required (minimum 2 characters)",
      path: ["name"],
    }
  )
  .refine(
    (data) => {
      const rawPhone = data.phone || data.admin?.phone || "";
      const cleaned = sanitizeMobileNumber(rawPhone);
      return INDIAN_MOBILE_REGEX.test(cleaned);
    },
    {
      message: "Valid 10-digit Indian mobile number (starting with 6-9) is required",
      path: ["phone"],
    }
  );

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
