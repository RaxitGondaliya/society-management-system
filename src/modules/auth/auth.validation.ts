import { z } from "zod";

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
      .regex(/^[0-9]{6}$/, "Verification code must consist of 6 numeric digits"),
    type: z.enum(["mobile", "email"]).optional(),
  })
  .refine((data) => Boolean(data.identifier || data.email || data.phone), {
    message: "Either identifier, email address, or phone number is required to verify OTP",
  });

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/**
 * Universal Login schema (supports Phone, Email, OTP, and Password)
 */
export const loginSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+]{10,15}$/, "Invalid phone number format. Must be 10-15 digits")
      .optional(),
    email: z
      .string()
      .trim()
      .email("Invalid email address format")
      .optional(),
    identifier: z.string().trim().optional(),
    otp: z
      .string()
      .trim()
      .min(4, "OTP must be at least 4 digits")
      .max(8, "OTP cannot exceed 8 digits")
      .optional(),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .optional(),
    type: z.enum(["mobile", "email"]).optional(),
  })
  .refine((data) => Boolean(data.phone || data.email || data.identifier), {
    message: "Phone number or email address is required for authentication",
  });

export type LoginInput = z.infer<typeof loginSchema>;
