import { z } from "zod";

export const DOCUMENT_TYPES = [
  "SOCIETY_BYELAWS",
  "AGM_MOM",
  "FIRE_SAFETY_NOC",
  "BUILDING_INSURANCE",
  "FINANCIAL_AUDIT",
  "SALE_DEED",
  "RENT_AGREEMENT",
  "POSSESSION_LETTER",
  "IDENTITY_PROOF",
  "OTHER",
] as const;

export const ACCESS_LEVELS = [
  "PUBLIC_RESIDENTS",
  "ADMIN_ONLY",
  "UNIT_PRIVATE",
] as const;

const isIsoDate = (val: string) => !isNaN(Date.parse(val));

export const uploadDocumentSchema = z
  .object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters long")
      .max(200, "Title must not exceed 200 characters"),
    documentType: z.enum(DOCUMENT_TYPES),
    accessLevel: z.enum(ACCESS_LEVELS),
    fileUrl: z
      .string()
      .min(3, "File URL or path must be at least 3 characters long"),
    fileSizeBytes: z
      .number()
      .positive("File size in bytes must be positive")
      .optional()
      .nullable(),
    mimeType: z.string().max(100).optional().nullable(),
    unitId: z.string().uuid("Invalid unitId format. Must be a valid UUID").optional().nullable(),
    expiryDate: z
      .string()
      .refine(isIsoDate, "expiryDate must be a valid ISO date string")
      .optional()
      .nullable(),
    description: z.string().max(1000).optional().nullable(),
    tags: z.array(z.string().max(50)).optional().default([]),
  })
  .refine(
    (data) => {
      if (data.accessLevel === "UNIT_PRIVATE" && !data.unitId) {
        return false;
      }
      return true;
    },
    {
      message: "unitId is required when accessLevel is 'UNIT_PRIVATE'",
      path: ["unitId"],
    }
  );

export const documentQuerySchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  accessLevel: z.enum(ACCESS_LEVELS).optional(),
  unitId: z.string().uuid().optional(),
  expiringSoon: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === "true")
    .optional(),
  search: z.string().optional(),
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

export const documentIdParamSchema = z.object({
  documentId: z.string().uuid("Invalid documentId format. Must be a valid UUID"),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type DocumentQueryInput = z.infer<typeof documentQuerySchema>;
export type DocumentIdParamInput = z.infer<typeof documentIdParamSchema>;
