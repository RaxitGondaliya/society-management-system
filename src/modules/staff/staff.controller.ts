import { Request, Response, NextFunction } from "express";
import { StaffService } from "./staff.service";
import { successResponse } from "../../utils/apiResponse";

export class StaffController {
  /**
   * POST /staff
   * Admin or resident registers a staff member
   */
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StaffService.registerStaff(req.user!, req.body);
      return successResponse(
        res,
        "Staff member registered successfully.",
        result,
        201
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /staff/assign-flat
   * Link staff member to a specific flat
   */
  static async assignFlat(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StaffService.assignStaffToFlat(req.user!, req.body);
      return successResponse(
        res,
        "Staff assigned to flat successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * DELETE /staff/unassign-flat/:unitStaffId
   * Unlink staff member from a flat
   */
  static async unassignFlat(req: Request, res: Response, next: NextFunction) {
    try {
      const unitStaffId = req.params.unitStaffId as string;
      const result = await StaffService.unassignStaffFromFlat(req.user!, unitStaffId);
      return successResponse(
        res,
        "Staff unassigned from flat successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /staff/attendance
   * Guard or kiosk clocks staff in/out at the gate
   */
  static async recordAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StaffService.logStaffAttendance(req.user!, req.body);
      return successResponse(
        res,
        "Staff attendance recorded successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /staff/active-on-premises
   * Security dashboard view of active staff inside society
   */
  static async getActiveOnPremises(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StaffService.getActiveStaffOnPremises(req.user!);
      return successResponse(
        res,
        "Active staff on premises retrieved successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /staff/:staffId/rating
   * Resident rates and reviews assigned staff
   */
  static async rateStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const staffId = req.params.staffId as string;
      const result = await StaffService.addStaffReview(req.user!, staffId, req.body);
      return successResponse(
        res,
        "Staff review and rating submitted successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /staff
   * Filtered directory of all domestic help and service personnel
   */
  static async listStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StaffService.listSocietyStaff(req.user!, req.query as any);
      return successResponse(
        res,
        "Society staff directory retrieved successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }
}
