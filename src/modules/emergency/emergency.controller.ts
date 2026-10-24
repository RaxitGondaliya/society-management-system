import { Request, Response, NextFunction } from "express";
import { EmergencyService } from "./emergency.service";
import { successResponse } from "../../utils/apiResponse";

export class EmergencyController {
  /**
   * POST /emergency/sos
   * Resident / Guard raises panic alert
   */
  static async triggerSos(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await EmergencyService.triggerSosAlert(
        req.user!,
        req.body
      );
      return successResponse(
        res,
        "Emergency SOS alert broadcasted successfully.",
        result,
        201
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PATCH /emergency/incidents/:incidentId/status
   * Guard / Admin updates incident status (Acknowledge / Responding / Resolve)
   */
  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const incidentId = req.params.incidentId as string;
      const { status } = req.body;

      if (status === "RESOLVED" || status === "FALSE_ALARM") {
        const result = await EmergencyService.resolveIncident(
          req.user!,
          incidentId,
          req.body
        );
        return successResponse(
          res,
          `Emergency incident marked as ${status}.`,
          result,
          200
        );
      } else {
        const result = await EmergencyService.acknowledgeIncident(
          req.user!,
          incidentId,
          req.body
        );
        return successResponse(
          res,
          `Emergency incident transitioned to ${status}.`,
          result,
          200
        );
      }
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /emergency/active
   * Guard / Admin real-time active alerts monitoring
   */
  static async getActive(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await EmergencyService.getActiveEmergencies(req.user!);
      return successResponse(
        res,
        "Active emergency incidents retrieved successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /emergency/history
   * Admin incident post-mortem logs & audit history
   */
  static async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await EmergencyService.getIncidentHistory(
        req.user!,
        req.query as any
      );
      return successResponse(
        res,
        "Emergency incident history retrieved successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /emergency/contacts
   * Admin registers statutory emergency contact
   */
  static async addContact(req: Request, res: Response, next: NextFunction) {
    try {
      const contact = await EmergencyService.createEmergencyContact(
        req.user!,
        req.body
      );
      return successResponse(
        res,
        "Emergency contact added to directory successfully.",
        contact,
        201
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /emergency/contacts
   * Public / Resident emergency helpline directory
   */
  static async getDirectory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = req.query.category as string | undefined;
      const directory = await EmergencyService.getEmergencyDirectory(
        req.user!,
        category
      );
      return successResponse(
        res,
        "Emergency directory retrieved successfully.",
        directory,
        200
      );
    } catch (error) {
      return next(error);
    }
  }
}
