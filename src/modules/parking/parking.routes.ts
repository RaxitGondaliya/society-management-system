import { Router } from "express";
import { ParkingController } from "./parking.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createSlotSchema,
  allocateSlotSchema,
  registerVehicleSchema,
  vehicleGateLogSchema,
  parkingViolationSchema,
  parkingQuerySchema,
} from "./parking.validation";

const router = Router();

// 1. Create parking slot (Admin only)
router.post(
  "/slots",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  validate({ body: createSlotSchema }),
  ParkingController.createSlot
);

// 2. Search / list parking slots with filters
router.get(
  "/slots",
  authenticate,
  validate({ query: parkingQuerySchema }),
  ParkingController.listSlots
);

// 3. Allocate parking slot to a flat (Admin only)
router.post(
  "/allocate",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  validate({ body: allocateSlotSchema }),
  ParkingController.allocateSlot
);

// 4. Register resident vehicle
router.post(
  "/vehicles",
  authenticate,
  validate({ body: registerVehicleSchema }),
  ParkingController.registerVehicle
);

// 5. Resident views their allocated bays & vehicles
router.get(
  "/my-parking",
  authenticate,
  ParkingController.getMyParking
);

// 6. Log vehicle gate movement (Guard / RFID / ANPR)
router.post(
  "/gate-movement",
  authenticate,
  authorizeRoles("GUARD", "SUPER_ADMIN", "SUB_ADMIN"),
  validate({ body: vehicleGateLogSchema }),
  ParkingController.logMovement
);

// 7. Report parking violation
router.post(
  "/violations",
  authenticate,
  validate({ body: parkingViolationSchema }),
  ParkingController.reportViolation
);

// 8. Parking overview metrics & capacity (Admin only)
router.get(
  "/overview",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  ParkingController.getOverview
);

export default router;
