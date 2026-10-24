import { Router } from "express";
import { EmergencyController } from "./emergency.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  triggerSosSchema,
  updateIncidentStatusSchema,
  emergencyContactSchema,
  emergencyQuerySchema,
  incidentIdParamSchema,
} from "./emergency.validation";

const router = Router();

// 1. Trigger Panic SOS Alert (Resident / Guard / Admin)
router.post(
  "/sos",
  authenticate,
  validate({ body: triggerSosSchema }),
  EmergencyController.triggerSos
);

// 2. Update Incident Status (Acknowledge / Responding / Resolve) (Guard / Admin)
router.patch(
  "/incidents/:incidentId/status",
  authenticate,
  authorizeRoles("GUARD", "SUPER_ADMIN", "SUB_ADMIN"),
  validate({
    params: incidentIdParamSchema,
    body: updateIncidentStatusSchema,
  }),
  EmergencyController.updateStatus
);

// 3. Real-time Active Emergencies Monitor (Guard / Admin)
router.get(
  "/active",
  authenticate,
  authorizeRoles("GUARD", "SUPER_ADMIN", "SUB_ADMIN"),
  EmergencyController.getActive
);

// 4. Incident History & Audit Reports (Admin only)
router.get(
  "/history",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  validate({ query: emergencyQuerySchema }),
  EmergencyController.getHistory
);

// 5. Add Emergency Contact to Directory (Admin only)
router.post(
  "/contacts",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  validate({ body: emergencyContactSchema }),
  EmergencyController.addContact
);

// 6. View Emergency Directory (Public / Resident)
router.get(
  "/contacts",
  authenticate,
  EmergencyController.getDirectory
);

export default router;
