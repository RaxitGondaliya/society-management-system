import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middlewares/rbac.middleware";
import * as userController from "../users/user.controller";
import {
  adminUserIdParamSchema,
  adminUpdateUserStatusSchema,
  adminUpdateUserRoleSchema,
} from "../users/user.validation";

const router = Router();

/**
 * @route   GET /api/v1/admin/pending-approvals
 * @desc    (Admin only) List all pending resident onboarding & unit join requests for the society
 * @access  Protected (SUPER_ADMIN, SOCIETY_ADMIN, SUB_ADMIN)
 */
router.get(
  "/pending-approvals",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SOCIETY_ADMIN", "SUB_ADMIN"),
  userController.listPending
);

/**
 * @route   PATCH /api/v1/admin/users/:id/status
 * @desc    (Admin only) Approve or reject a resident onboarding request
 * @access  Protected (SUPER_ADMIN, SOCIETY_ADMIN, SUB_ADMIN)
 */
router.patch(
  "/users/:id/status",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SOCIETY_ADMIN", "SUB_ADMIN"),
  validate({
    params: adminUserIdParamSchema,
    body: adminUpdateUserStatusSchema,
  }),
  userController.updateResidentStatus
);

/**
 * @route   PATCH /api/v1/admin/users/:id/role
 * @desc    (Super Admin only) Change or delegate member role (RESIDENT, SUB_ADMIN, GUARD)
 * @access  Protected (SUPER_ADMIN)
 */
router.patch(
  "/users/:id/role",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  validate({
    params: adminUserIdParamSchema,
    body: adminUpdateUserRoleSchema,
  }),
  userController.updateUserRole
);

export default router;

