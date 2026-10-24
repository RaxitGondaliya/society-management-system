import { z } from "zod";

export const EMERGENCY_TYPES = [
  "MEDICAL_EMERGENCY",
  "FIRE_HAZARD",
  "LIFT_ENTRAPMENT",
  "THEFT_SECURITY_BREACH",
  "GAS_LEAK",
  "OTHER",
] as const;

export const EMERGENCY_SEVERITIES = ["HIGH", "CRITICAL"] as const;

export const INCIDENT_STATUSES = [
  "TRIGGERED",
  "ACKNOWLEDGED",
  "RESPONDING",
  "RESOLVED",
  "FALSE_ALARM",
] as const;

export const INCIDENT_UPDATE_STATUSES = [
  "ACKNOWLEDGED",
  "RESPONDING",
  "RESOLVED",
  "FALSE_ALARM",
] as const;

export const CONTACT_CATEGORIES = [
  "HOSPITAL",
  "AMBULANCE",
  "POLICE",
  "FIRE_STATION",
  "LIFT_AGENCY",
  "SECURITY_CHIEF",
  "OTHER",
] as const;

const phoneRegex = /^\+?[0-9]{3,15}$/;
const isIsoDate = (val: string) => !isNaN(Date.parse(val));

export const triggerSosSchema = z.object({
  emergencyType: z.enum(EMERGENCY_TYPES),
  unitId: z.string().uuid("Invalid unitId format. Must be a valid UUID"),
  notes: z.string().max(1000).optional().nullable(),
  severity: z.enum(EMERGENCY_SEVERITIES).default("CRITICAL"),
});

export const updateIncidentStatusSchema = z.object({
  status: z.enum(INCIDENT_UPDATE_STATUSES),
  resolutionNotes: z.string().max(1000).optional().nullable(),
  responderActionTaken: z.string().max(1000).optional().nullable(),
});

export const emergencyContactSchema = z.object({
  serviceName: z
    .string()
    .min(3, "Service name must be at least 3 characters long")
    .max(150),
  category: z.enum(CONTACT_CATEGORIES),
  phone: z
    .string()
    .regex(phoneRegex, "Phone must be between 3 and 15 digits"),
  alternatePhone: z
    .string()
    .regex(phoneRegex, "Alternate phone must be between 3 and 15 digits")
    .optional()
    .nullable(),
  address: z.string().max(255).optional().nullable(),
  contactPerson: z.string().max(100).optional().nullable(),
});

export const emergencyQuerySchema = z.object({
  status: z.enum(INCIDENT_STATUSES).optional(),
  emergencyType: z.enum(EMERGENCY_TYPES).optional(),
  unitId: z.string().uuid().optional(),
  startDate: z.string().refine(isIsoDate, "Invalid startDate format").optional(),
  endDate: z.string().refine(isIsoDate, "Invalid endDate format").optional(),
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

export const incidentIdParamSchema = z.object({
  incidentId: z.string().uuid("Invalid incidentId format. Must be a valid UUID"),
});

export type TriggerSosInput = z.infer<typeof triggerSosSchema>;
export type UpdateIncidentStatusInput = z.infer<typeof updateIncidentStatusSchema>;
export type EmergencyContactInput = z.infer<typeof emergencyContactSchema>;
export type EmergencyQueryInput = z.infer<typeof emergencyQuerySchema>;
export type IncidentIdParamInput = z.infer<typeof incidentIdParamSchema>;
