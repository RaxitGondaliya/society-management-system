import { z } from "zod";

export const loginSchema = z.object({
  phone: z
    .string({
      error: "Phone number is required",
    })
    .trim()
    .regex(/^[0-9+]{10,15}$/, "Invalid phone number format. Must be 10-15 digits"),
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
});

export type LoginInput = z.infer<typeof loginSchema>;
