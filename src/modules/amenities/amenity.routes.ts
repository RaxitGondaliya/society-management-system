import { Router } from "express";
import { AmenityController } from "./amenity.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createAmenitySchema,
  bookAmenitySchema,
  amenityBookingDecisionSchema,
  amenityQuerySchema,
} from "./amenity.validation";

const router = Router();

// 1. Admin creates a facility
router.post(
  "/",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  validate({ body: createAmenitySchema }),
  AmenityController.createAmenity
);

// 2. Public / resident list of facilities
router.get(
  "/",
  authenticate,
  AmenityController.getAmenities
);

// 3. Resident books a facility (Slot or Full day)
router.post(
  "/book",
  authenticate,
  validate({ body: bookAmenitySchema }),
  AmenityController.bookAmenity
);

// 4. Resident retrieves their bookings
router.get(
  "/my-bookings",
  authenticate,
  AmenityController.getMyBookings
);

// 5. Cancel or decide on a booking
router.patch(
  "/bookings/:bookingId/decision",
  authenticate,
  validate({ body: amenityBookingDecisionSchema }),
  AmenityController.cancelBooking
);

// 6. View schedule calendar for an amenity
router.get(
  "/:amenityId/schedule",
  authenticate,
  validate({ query: amenityQuerySchema }),
  AmenityController.getAmenityCalendar
);

export default router;
