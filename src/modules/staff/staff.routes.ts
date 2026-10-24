import { Router } from "express";
import { StaffController } from "./staff.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createStaffSchema,
  assignFlatSchema,
  staffAttendanceSchema,
  staffRatingSchema,
  staffQuerySchema,
} from "./staff.validation";

const router = Router();

// 1. Register staff member (Admin or resident)
router.post(
  "/",
  authenticate,
  validate({ body: createStaffSchema }),
  StaffController.register
);

// 2. Search staff directory with filters
router.get(
  "/",
  authenticate,
  validate({ query: staffQuerySchema }),
  StaffController.listStaff
);

// 3. Assign staff member to flat
router.post(
  "/assign-flat",
  authenticate,
  validate({ body: assignFlatSchema }),
  StaffController.assignFlat
);

// 4. Unassign staff member from flat
router.delete(
  "/unassign-flat/:unitStaffId",
  authenticate,
  StaffController.unassignFlat
);

// 5. Guard check-in / check-out attendance
router.post(
  "/attendance",
  authenticate,
  authorizeRoles("GUARD", "SUPER_ADMIN", "SUB_ADMIN"),
  validate({ body: staffAttendanceSchema }),
  StaffController.recordAttendance
);

// 6. Security dashboard: active staff on premises
router.get(
  "/active-on-premises",
  authenticate,
  authorizeRoles("GUARD", "SUPER_ADMIN", "SUB_ADMIN"),
  StaffController.getActiveOnPremises
);

// 7. Rate & review assigned staff member
router.post(
  "/:staffId/rating",
  authenticate,
  validate({ body: staffRatingSchema }),
  StaffController.rateStaff
);

export default router;
