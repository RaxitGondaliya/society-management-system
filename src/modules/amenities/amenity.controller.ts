import { Request, Response, NextFunction } from "express";
import { AmenityService } from "./amenity.service";
import { successResponse } from "../../utils/apiResponse";

export class AmenityController {
  /**
   * POST /amenities
   * Admin registers a new facility / amenity
   */
  static async createAmenity(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AmenityService.createAmenity(req.user!, req.body);
      return successResponse(
        res,
        "Amenity facility registered successfully.",
        result,
        201
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /amenities
   * Public / resident list of all active facilities
   */
  static async getAmenities(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AmenityService.listSocietyAmenities(req.user!);
      return successResponse(
        res,
        "Society amenities retrieved successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /amenities/book
   * Resident reserves a slot or full day
   */
  static async bookAmenity(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AmenityService.bookFacility(req.user!, req.body);
      return successResponse(
        res,
        "Amenity booked successfully.",
        result,
        201
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /amenities/my-bookings
   * Resident fetches their booking history
   */
  static async getMyBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AmenityService.getMyBookings(req.user!);
      return successResponse(
        res,
        "My amenity bookings retrieved successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PATCH /amenities/bookings/:bookingId/decision
   * Resident cancels or admin updates booking status
   */
  static async cancelBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const bookingId = req.params.bookingId as string;
      const result = await AmenityService.cancelOrUpdateBooking(req.user!, bookingId, req.body);
      return successResponse(
        res,
        "Amenity booking updated successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /amenities/:amenityId/schedule
   * View reserved vs available time slots on a calendar date
   */
  static async getAmenityCalendar(req: Request, res: Response, next: NextFunction) {
    try {
      const amenityId = req.params.amenityId as string;
      const result = await AmenityService.getAmenitySchedule(req.user!, amenityId, req.query as any);
      return successResponse(
        res,
        "Amenity schedule and slot availability retrieved successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }
}
