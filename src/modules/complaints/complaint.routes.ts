import { Router } from "express";
import { ComplaintController } from "./complaint.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createComplaintSchema,
  updateComplaintStatusSchema,
  complaintFeedbackSchema,
  complaintQuerySchema,
} from "./complaint.validation";

const router = Router();

// 1. Lodge Complaint (Resident or Admin)
router.post(
  "/",
  authenticate,
  validate({ body: createComplaintSchema }),
  ComplaintController.createTicket
);

// 2. Update Status & Assign Staff (Admin or Staff)
router.patch(
  "/:ticketId/status",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  validate({ body: updateComplaintStatusSchema }),
  ComplaintController.updateStatus
);

// 3. Submit Rating & Feedback (Resident auto-closes)
router.post(
  "/:ticketId/feedback",
  authenticate,
  validate({ body: complaintFeedbackSchema }),
  ComplaintController.submitFeedback
);

// 4. Resident's Own Complaints
router.get(
  "/my-complaints",
  authenticate,
  ComplaintController.getMyTickets
);

// 5. Admin List All Complaints with Filters & Metrics
router.get(
  "/all",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  validate({ query: complaintQuerySchema }),
  ComplaintController.listTickets
);

// 6. View Single Complaint Details
router.get(
  "/:ticketId",
  authenticate,
  ComplaintController.getTicketById
);

export default router;
