import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { isAdmin } from "../../middleware/role.middleware";
import * as userController from "./user.controller";
import {
  joinSocietySchema,
  approvalDecisionSchema,
  membershipIdParamSchema,
  updateOccupancySchema,
  unitIdParamSchema,
} from "./user.validation";

const router = Router();

/**
 * @route   POST /api/v1/users/join
 * @desc    Submit resident onboarding request to join a society unit
 * @access  Public
 */
router.post(
  "/join",
  validate({ body: joinSocietySchema }),
  userController.joinSociety
);

/**
 * @route   GET /api/v1/users/pending-approvals
 * @desc    Fetch list of pending join requests awaiting admin review
 * @access  Protected (Super Admin, Sub Admin)
 */
router.get(
  "/pending-approvals",
  authenticate,
  isAdmin,
  userController.listPending
);

/**
 * @route   PATCH /api/v1/users/memberships/:membershipId/decision
 * @desc    Approve or reject a resident join request
 * @access  Protected (Super Admin, Sub Admin)
 */
router.patch(
  "/memberships/:membershipId/decision",
  authenticate,
  isAdmin,
  validate({
    params: membershipIdParamSchema,
    body: approvalDecisionSchema,
  }),
  userController.approveReject
);

/**
 * @route   GET /api/v1/users/directory
 * @desc    Fetch approved resident directory grouped by Wings and Units
 * @access  Protected (Authenticated Residents & Admins)
 */
router.get(
  "/directory",
  authenticate,
  userController.getDirectory
);

/**
 * @route   PATCH /api/v1/users/units/:unitId/occupancy
 * @desc    Update unit occupancy status directly
 * @access  Protected (Super Admin, Sub Admin)
 */
router.patch(
  "/units/:unitId/occupancy",
  authenticate,
  isAdmin,
  validate({
    params: unitIdParamSchema,
    body: updateOccupancySchema,
  }),
  userController.updateOccupancy
);

export default router;
