import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { authorizeRoles, isResident } from "../../middleware/role.middleware";
import * as visitorController from "./visitor.controller";
import {
  createVisitorEntrySchema,
  preApproveGuestSchema,
  visitorDecisionSchema,
  visitorIdParamSchema,
  visitorQuerySchema,
} from "./visitor.validation";

const router = Router();

const isGuardOrAdmin = authorizeRoles("GUARD", "SUPER_ADMIN", "SUB_ADMIN");

/**
 * @route   POST /api/v1/visitors/entry
 * @desc    Log visitor entry at the gate
 * @access  Protected (Guard, Super Admin, Sub Admin)
 */
router.post(
  "/entry",
  authenticate,
  isGuardOrAdmin,
  validate({ body: createVisitorEntrySchema }),
  visitorController.createEntry
);

/**
 * @route   POST /api/v1/visitors/pre-approve
 * @desc    Resident pre-approves expected guest or delivery
 * @access  Protected (Authenticated Residents)
 */
router.post(
  "/pre-approve",
  authenticate,
  isResident,
  validate({ body: preApproveGuestSchema }),
  visitorController.preApprove
);

/**
 * @route   PATCH /api/v1/visitors/:visitorId/decision
 * @desc    Resident approves or denies pending visitor entry
 * @access  Protected (Resident of target unit, Admin)
 */
router.patch(
  "/:visitorId/decision",
  authenticate,
  validate({
    params: visitorIdParamSchema,
    body: visitorDecisionSchema,
  }),
  visitorController.respondToVisitor
);

/**
 * @route   POST /api/v1/visitors/:visitorId/checkout
 * @desc    Record visitor checkout when leaving society
 * @access  Protected (Guard, Super Admin, Sub Admin)
 */
router.post(
  "/:visitorId/checkout",
  authenticate,
  isGuardOrAdmin,
  validate({ params: visitorIdParamSchema }),
  visitorController.checkout
);

/**
 * @route   GET /api/v1/visitors/active
 * @desc    List all currently active on-premises visitors
 * @access  Protected (Guard, Super Admin, Sub Admin)
 */
router.get(
  "/active",
  authenticate,
  isGuardOrAdmin,
  visitorController.getActiveVisitors
);

/**
 * @route   GET /api/v1/visitors/my-unit
 * @desc    Get visitor logs for resident's unit
 * @access  Protected (Authenticated Residents)
 */
router.get(
  "/my-unit",
  authenticate,
  isResident,
  visitorController.getMyUnitVisitors
);

/**
 * @route   GET /api/v1/visitors/history
 * @desc    List all visitor logs with filters and pagination
 * @access  Protected (Guard, Super Admin, Sub Admin)
 */
router.get(
  "/history",
  authenticate,
  validate({ query: visitorQuerySchema }),
  visitorController.getVisitorHistory
);

export default router;
