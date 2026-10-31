import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { authenticate, authenticateToken } from "../../middleware/auth.middleware";
import { authorizeRoles, isAdmin } from "../../middlewares/rbac.middleware";
import * as userController from "./user.controller";
import {
  joinSocietySchema,
  approvalDecisionSchema,
  membershipIdParamSchema,
  updateOccupancySchema,
  unitIdParamSchema,
  updateMyProfileSchema,
  adminUserIdParamSchema,
  adminUpdateUserStatusSchema,
} from "./user.validation";

const router = Router();

/**
 * @route   GET /api/v1/users/me
 * @desc    Fetch current logged-in user profile, role, status, society details, and associated unit
 * @access  Protected
 */
router.get("/me", authenticateToken, userController.getCurrentUser);

/**
 * @route   PUT /api/v1/users/me
 * @desc    Update personal profile info (name, residentType, emergencyContact, avatarUrl)
 * @access  Protected
 */
router.put(
  "/me",
  authenticateToken,
  validate({ body: updateMyProfileSchema }),
  userController.updateCurrentUser
);

/**
 * @route   PATCH /api/v1/users/me
 * @desc    Alias for PUT /api/v1/users/me
 * @access  Protected
 */
router.patch(
  "/me",
  authenticateToken,
  validate({ body: updateMyProfileSchema }),
  userController.updateCurrentUser
);

/**
 * @route   PATCH /api/v1/users/:id/status
 * @desc    Admin approve or reject a resident onboarding request
 * @access  Protected (SUPER_ADMIN, SOCIETY_ADMIN, SUB_ADMIN)
 */
router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SOCIETY_ADMIN", "SUB_ADMIN"),
  validate({
    params: adminUserIdParamSchema,
    body: adminUpdateUserStatusSchema,
  }),
  userController.updateResidentStatus
);

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
