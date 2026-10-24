import { Request, Response, NextFunction } from "express";
import { ComplaintService } from "./complaint.service";
import { successResponse } from "../../utils/apiResponse";

export class ComplaintController {
  /**
   * POST /complaints
   * Lodge a new complaint / helpdesk ticket
   */
  static async createTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ComplaintService.lodgeComplaint(req.user!, req.body);
      return successResponse(
        res,
        "Complaint lodged successfully. Ticket ID generated.",
        result,
        201
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PATCH /complaints/:ticketId/status
   * Admin/Staff updates ticket status and assigns staff
   */
  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const ticketId = req.params.ticketId as string;
      const result = await ComplaintService.updateTicketStatus(req.user!, ticketId, req.body);
      return successResponse(
        res,
        "Complaint status and assignment updated successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /complaints/:ticketId/feedback
   * Resident submits satisfaction rating and feedback (auto-closes ticket)
   */
  static async submitFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const ticketId = req.params.ticketId as string;
      const result = await ComplaintService.addFeedback(req.user!, ticketId, req.body);
      return successResponse(
        res,
        "Feedback submitted and complaint ticket closed successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /complaints/my-complaints
   * Resident fetches their own complaints
   */
  static async getMyTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ComplaintService.getMyComplaints(req.user!);
      return successResponse(
        res,
        "My complaints retrieved successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /complaints/all
   * Admin audits all complaints with multi-parameter filters and SLA indicators
   */
  static async listTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ComplaintService.listSocietyComplaints(req.user!, req.query as any);
      return successResponse(
        res,
        "Society complaints retrieved successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /complaints/:ticketId
   * Retrieve single ticket details
   */
  static async getTicketById(req: Request, res: Response, next: NextFunction) {
    try {
      const ticketId = req.params.ticketId as string;
      const result = await ComplaintService.getComplaintDetails(req.user!, ticketId);
      return successResponse(
        res,
        "Complaint details retrieved successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }
}
