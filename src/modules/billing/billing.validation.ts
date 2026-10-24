import { z } from "zod";

export const generateBillsSchema = z.object({
  societyId: z
    .string()
    .trim()
    .uuid("Invalid society ID format")
    .optional(),
  billingMonth: z
    .number({
      error: "billingMonth is required",
    })
    .int("Billing month must be an integer")
    .min(1, "Billing month must be between 1 and 12")
    .max(12, "Billing month must be between 1 and 12"),
  billingYear: z
    .number({
      error: "billingYear is required",
    })
    .int("Billing year must be an integer")
    .min(2020, "Billing year must be 2020 or later")
    .max(2100, "Billing year cannot exceed 2100"),
  dueDate: z
    .string()
    .trim()
    .optional(),
  billingMode: z
    .enum(["FLAT_RATE", "PER_SQFT"] as const, {
      error: "billingMode must be FLAT_RATE or PER_SQFT",
    })
    .default("FLAT_RATE"),
  amount: z
    .number({
      error: "amount is required",
    })
    .positive("Amount must be greater than 0"),
  numberOfMonths: z
    .number()
    .int("numberOfMonths must be an integer")
    .positive("numberOfMonths must be greater than 0")
    .max(36, "numberOfMonths cannot exceed 36")
    .optional()
    .default(1),
  description: z
    .string()
    .trim()
    .max(255, "Description cannot exceed 255 characters")
    .optional()
    .nullable(),
  penaltyGraceDays: z
    .number()
    .int("penaltyGraceDays must be an integer")
    .nonnegative("penaltyGraceDays cannot be negative")
    .optional()
    .default(15),
});

export const recordPaymentSchema = z.object({
  amountPaid: z
    .number({
      error: "amountPaid is required",
    })
    .positive("amountPaid must be greater than 0"),
  paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"] as const, {
    error: "paymentMethod must be CASH, UPI, BANK_TRANSFER, or CHEQUE",
  }),
  transactionReference: z
    .string()
    .trim()
    .max(100, "Transaction reference cannot exceed 100 characters")
    .optional()
    .nullable(),
  chequeNumber: z
    .string()
    .trim()
    .max(50, "Cheque number cannot exceed 50 characters")
    .optional()
    .nullable(),
  paymentDate: z
    .string()
    .trim()
    .optional(),
  paidByUserId: z
    .string()
    .trim()
    .uuid("Invalid paidByUserId UUID")
    .optional()
    .nullable(),
  cashCollectorId: z
    .string()
    .trim()
    .uuid("Invalid cashCollectorId UUID")
    .optional()
    .nullable(),
});

export const billIdParamSchema = z.object({
  billId: z
    .string({
      error: "billId parameter is required",
    })
    .trim()
    .uuid("Invalid bill ID format"),
});

export const billQuerySchema = z.object({
  status: z
    .enum(["PAID", "PENDING", "OVERDUE"] as const)
    .optional(),
  unitId: z
    .string()
    .trim()
    .uuid("Invalid unitId UUID")
    .optional(),
  month: z
    .string()
    .trim()
    .optional(),
  year: z
    .string()
    .trim()
    .optional(),
  societyId: z
    .string()
    .trim()
    .uuid("Invalid societyId UUID")
    .optional(),
  page: z
    .string()
    .optional()
    .default("1"),
  limit: z
    .string()
    .optional()
    .default("20"),
});

export type GenerateBillsInput = z.infer<typeof generateBillsSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type BillQueryParams = z.infer<typeof billQuerySchema>;
