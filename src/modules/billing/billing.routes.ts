import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { isAdmin } from "../../middleware/role.middleware";
import * as billingController from "./billing.controller";
import {
  generateBillsSchema,
  recordPaymentSchema,
  billIdParamSchema,
  billQuerySchema,
} from "./billing.validation";

const router = Router();

/**
 * @route   POST /api/v1/billing/generate
 * @desc    Generate maintenance bills for all units in a society
 * @access  Protected (Super Admin, Sub Admin)
 */
router.post(
  "/generate",
  authenticate,
  isAdmin,
  validate({ body: generateBillsSchema }),
  billingController.generateBills
);

/**
 * @route   POST /api/v1/billing/:billId/pay
 * @desc    Record payment for a maintenance bill
 * @access  Protected (Super Admin, Sub Admin)
 */
router.post(
  "/:billId/pay",
  authenticate,
  isAdmin,
  validate({
    params: billIdParamSchema,
    body: recordPaymentSchema,
  }),
  billingController.recordPayment
);

/**
 * @route   GET /api/v1/billing/my-bills
 * @desc    Get personal unit billing history for authenticated resident
 * @access  Protected (Authenticated Residents)
 */
router.get(
  "/my-bills",
  authenticate,
  billingController.getMyBills
);

/**
 * @route   GET /api/v1/billing/all
 * @desc    List all bills with filters and pagination
 * @access  Protected (Super Admin, Sub Admin)
 */
router.get(
  "/all",
  authenticate,
  isAdmin,
  validate({ query: billQuerySchema }),
  billingController.listAllBills
);

/**
 * @route   GET /api/v1/billing/summary
 * @desc    Get society financial summary and defaulters list
 * @access  Protected (Super Admin, Sub Admin)
 */
router.get(
  "/summary",
  authenticate,
  isAdmin,
  billingController.getFinancialSummary
);

export default router;
