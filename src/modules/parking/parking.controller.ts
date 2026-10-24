import { Request, Response, NextFunction } from "express";
import { ParkingService } from "./parking.service";
import { successResponse } from "../../utils/apiResponse";

export class ParkingController {
  /**
   * POST /parking/slots
   * Admin defines parking bay
   */
  static async createSlot(req: Request, res: Response, next: NextFunction) {
    try {
      const slot = await ParkingService.createParkingSlot(req.user!, req.body);
      return successResponse(
        res,
        "Parking slot created successfully.",
        slot,
        201
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /parking/allocate
   * Admin assigns slot to flat
   */
  static async allocateSlot(req: Request, res: Response, next: NextFunction) {
    try {
      const slot = await ParkingService.allocateSlotToUnit(req.user!, req.body);
      return successResponse(
        res,
        "Parking slot allocated to unit successfully.",
        slot,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /parking/vehicles
   * Add resident car or two-wheeler
   */
  static async registerVehicle(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const vehicle = await ParkingService.registerResidentVehicle(
        req.user!,
        req.body
      );
      return successResponse(
        res,
        "Vehicle registered successfully.",
        vehicle,
        201
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /parking/gate-movement
   * Gate sensor or guard logs vehicle entry / exit
   */
  static async logMovement(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ParkingService.logVehicleGateMovement(
        req.user!,
        req.body
      );
      return successResponse(
        res,
        "Vehicle gate movement logged successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /parking/violations
   * Log illegal / unauthorized parking incident
   */
  static async reportViolation(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const violation = await ParkingService.reportParkingViolation(
        req.user!,
        req.body
      );
      return successResponse(
        res,
        "Parking violation reported successfully.",
        violation,
        201
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /parking/overview
   * Real-time parking capacity & zone dashboard
   */
  static async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const overview = await ParkingService.getSocietyParkingOverview(req.user!);
      return successResponse(
        res,
        "Parking overview retrieved successfully.",
        overview,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /parking/my-parking
   * Resident views vehicles, assigned bays, and violation history
   */
  static async getMyParking(req: Request, res: Response, next: NextFunction) {
    try {
      const myParking = await ParkingService.getUnitVehiclesAndSlots(req.user!);
      return successResponse(
        res,
        "Resident parking details retrieved successfully.",
        myParking,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /parking/slots
   * Filtered search of all society parking bays
   */
  static async listSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ParkingService.listSocietySlots(
        req.user!,
        req.query as any
      );
      return successResponse(
        res,
        "Parking slots retrieved successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }
}
