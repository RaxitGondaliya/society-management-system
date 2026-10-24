import { z } from "zod";

export const AMENITY_BOOKING_TYPES = ["SLOT_BASED", "FULL_DAY"] as const;
export const BOOKING_DECISION_STATUSES = ["CONFIRMED", "CANCELLED", "REJECTED"] as const;
export const ALL_BOOKING_STATUSES = ["CONFIRMED", "CANCELLED", "PENDING", "REJECTED"] as const;

const timeFormatRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createAmenitySchema = z.object({
  name: z
    .string()
    .min(3, "Amenity name must be at least 3 characters long")
    .max(100, "Amenity name must not exceed 100 characters"),
  description: z.string().max(1000).optional().nullable(),
  bookingType: z.enum(AMENITY_BOOKING_TYPES),
  capacity: z
    .number()
    .int("Capacity must be an integer")
    .min(1, "Capacity must be at least 1 person"),
  feePerHour: z.number().min(0, "Fee per hour cannot be negative").default(0),
  feePerDay: z.number().min(0, "Fee per day cannot be negative").default(0),
  securityDeposit: z.number().min(0, "Security deposit cannot be negative").default(0),
  openTime: z
    .string()
    .regex(timeFormatRegex, "openTime must be in HH:mm 24-hour format (e.g. '06:00')")
    .default("06:00"),
  closeTime: z
    .string()
    .regex(timeFormatRegex, "closeTime must be in HH:mm 24-hour format (e.g. '22:00')")
    .default("22:00"),
  rules: z.array(z.string()).optional(),
});

export const bookAmenitySchema = z
  .object({
    amenityId: z.string().uuid("Invalid amenityId format. Must be a valid UUID"),
    unitId: z.string().uuid("Invalid unitId format. Must be a valid UUID"),
    bookingDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}/, "bookingDate must be in YYYY-MM-DD or ISO date format"),
    startTime: z
      .string()
      .regex(timeFormatRegex, "startTime must be in HH:mm 24-hour format (e.g. '10:00')")
      .optional(),
    endTime: z
      .string()
      .regex(timeFormatRegex, "endTime must be in HH:mm 24-hour format (e.g. '12:00')")
      .optional(),
    purpose: z.string().max(255).optional().nullable(),
    attendeesCount: z
      .number()
      .int()
      .min(1, "Attendees count must be at least 1")
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      // Validate bookingDate is not in the past (comparing date strings in YYYY-MM-DD)
      const datePart = data.bookingDate.slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      return datePart >= today;
    },
    {
      message: "bookingDate cannot be in the past",
      path: ["bookingDate"],
    }
  )
  .refine(
    (data) => {
      // If both startTime and endTime are supplied, startTime must be strictly before endTime
      if (data.startTime && data.endTime) {
        return data.startTime < data.endTime;
      }
      return true;
    },
    {
      message: "startTime must be earlier than endTime",
      path: ["endTime"],
    }
  );

export const amenityBookingDecisionSchema = z.object({
  status: z.enum(BOOKING_DECISION_STATUSES),
  notes: z.string().max(500).optional().nullable(),
  cancellationReason: z.string().max(500).optional().nullable(),
});

export const amenityQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, "date must be in YYYY-MM-DD format")
    .optional(),
  amenityId: z.string().uuid().optional(),
  status: z.enum(ALL_BOOKING_STATUSES).optional(),
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

export type CreateAmenityInput = z.infer<typeof createAmenitySchema>;
export type BookAmenityInput = z.infer<typeof bookAmenitySchema>;
export type AmenityBookingDecisionInput = z.infer<typeof amenityBookingDecisionSchema>;
export type AmenityQueryInput = z.infer<typeof amenityQuerySchema>;
