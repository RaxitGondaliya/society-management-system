import { z } from "zod";

export const NOTICE_CATEGORIES = [
  "GENERAL",
  "MAINTENANCE",
  "EVENT",
  "EMERGENCY",
  "FINANCIAL",
  "RULES",
] as const;

export const NOTICE_PRIORITIES = ["NORMAL", "URGENT", "EMERGENCY"] as const;

export const VOTING_SCOPES = ["ONE_VOTE_PER_UNIT", "ONE_VOTE_PER_MEMBER"] as const;

export const createNoticeSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters long")
    .max(200, "Title must not exceed 200 characters"),
  content: z
    .string()
    .min(10, "Content must be at least 10 characters long"),
  category: z.enum(NOTICE_CATEGORIES).default("GENERAL"),
  priority: z.enum(NOTICE_PRIORITIES).default("NORMAL"),
  targetWings: z.array(z.string()).optional(),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, "expiryDate must be in valid ISO Date format (YYYY-MM-DD)")
    .optional()
    .nullable(),
  attachments: z.array(z.string()).optional(),
});

export const createPollSchema = z
  .object({
    question: z
      .string()
      .min(10, "Poll question must be at least 10 characters long")
      .max(300, "Poll question must not exceed 300 characters"),
    description: z.string().max(1000).optional().nullable(),
    options: z
      .array(z.string().min(1, "Option choice cannot be empty"))
      .min(2, "Poll must have at least 2 choices")
      .max(6, "Poll cannot have more than 6 choices"),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}/, "startDate must be in valid ISO Date format")
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}/, "endDate must be in valid ISO Date format"),
    isSecret: z.boolean().default(false),
    votingScope: z.enum(VOTING_SCOPES).default("ONE_VOTE_PER_UNIT"),
  })
  .refine(
    (data) => {
      const start = data.startDate ? new Date(data.startDate).getTime() : Date.now();
      const end = new Date(data.endDate).getTime();
      return end > start;
    },
    {
      message: "endDate must be strictly after startDate",
      path: ["endDate"],
    }
  );

export const castVoteSchema = z
  .object({
    pollOptionId: z.string().uuid("Invalid pollOptionId format").optional(),
    optionIndex: z.number().int().min(0, "optionIndex must be >= 0").optional(),
    unitId: z.string().uuid("Invalid unitId format. Must be a valid UUID"),
  })
  .refine(
    (data) => data.pollOptionId !== undefined || data.optionIndex !== undefined,
    {
      message: "Either pollOptionId or optionIndex must be provided",
      path: ["pollOptionId"],
    }
  );

export const noticeQuerySchema = z.object({
  category: z.enum(NOTICE_CATEGORIES).optional(),
  priority: z.enum(NOTICE_PRIORITIES).optional(),
  activeOnly: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === "true")
    .optional()
    .default(true),
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

export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;
export type CreatePollInput = z.infer<typeof createPollSchema>;
export type CastVoteInput = z.infer<typeof castVoteSchema>;
export type NoticeQueryInput = z.infer<typeof noticeQuerySchema>;
