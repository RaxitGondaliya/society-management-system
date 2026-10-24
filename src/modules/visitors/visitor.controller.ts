import { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/prisma";
import { AppError, successResponse } from "../../utils/apiResponse";
import * as visitorService from "./visitor.service";
import {
  CreateVisitorEntryInput,
  PreApproveGuestInput,
  VisitorDecisionInput,
  VisitorQueryParams,
} from "./visitor.validation";

/**
 * Log new visitor entry at the gate
 * POST /api/v1/visitors/entry
 */
export const createEntry = async (
  req: Request<unknown, unknown, CreateVisitorEntryInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError(401, "Authentication required");
    }

    const result = await visitorService.logVisitorAtGate(req.body, {
      id: req.user.id,
      societyId: req.user.societyId,
    });
    successResponse(res, result.message, result, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Pre-approve expected visitor by resident
 * POST /api/v1/visitors/pre-approve
 */
export const preApprove = async (
  req: Request<unknown, unknown, PreApproveGuestInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError(401, "Authentication required");
    }

    const result = await visitorService.preApproveVisitor(req.body, {
      id: req.user.id,
      societyId: req.user.societyId,
      unitId: req.user.unitId,
    });
    successResponse(res, result.message, result, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Resident approves or denies pending visitor entry
 * PATCH /api/v1/visitors/:visitorId/decision
 */
export const respondToVisitor = async (
  req: Request<{ visitorId: string }, unknown, VisitorDecisionInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError(401, "Authentication required");
    }

    const { visitorId } = req.params;
    const result = await visitorService.residentDecisionOnVisitor(
      visitorId,
      req.body,
      {
        id: req.user.id,
        role: req.user.role,
      }
    );
    successResponse(res, result.message, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Guard marks visitor checkout when leaving premises
 * POST /api/v1/visitors/:visitorId/checkout
 */
export const checkout = async (
  req: Request<{ visitorId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError(401, "Authentication required");
    }

    const { visitorId } = req.params;
    const result = await visitorService.checkoutVisitor(visitorId, {
      id: req.user.id,
      societyId: req.user.societyId,
    });
    successResponse(res, result.message, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * List all currently on-premises active visitors
 * GET /api/v1/visitors/active
 */
export const getActiveVisitors = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let societyId = (req.query.societyId as string) || req.user?.societyId;

    if (!societyId && req.user?.id) {
      const membership = await prisma.unitMember.findFirst({
        where: { userId: req.user.id, approvalStatus: "APPROVED" },
        include: { unit: true },
      });
      societyId = membership?.unit.societyId;
    }

    if (!societyId) {
      throw new AppError(
        400,
        "Society context missing. Please provide societyId in query parameter."
      );
    }

    const result = await visitorService.listActiveVisitors(societyId);
    successResponse(
      res,
      "Active on-premises visitors retrieved successfully",
      result,
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * List visitor logs with filters and pagination
 * GET /api/v1/visitors/history
 */
export const getVisitorHistory = async (
  req: Request<unknown, unknown, unknown, VisitorQueryParams>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let societyId = req.query.societyId || req.user?.societyId;

    if (!societyId && req.user?.id) {
      const membership = await prisma.unitMember.findFirst({
        where: { userId: req.user.id, approvalStatus: "APPROVED" },
        include: { unit: true },
      });
      societyId = membership?.unit.societyId;
    }

    if (!societyId) {
      throw new AppError(
        400,
        "Society context missing. Please provide societyId in query parameter."
      );
    }

    const result = await visitorService.listAllVisitors(req.query, societyId);
    successResponse(
      res,
      "Visitor log history retrieved successfully",
      result,
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get visitor history for caller's unit (Resident dashboard)
 * GET /api/v1/visitors/my-unit
 */
export const getMyUnitVisitors = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError(401, "Authentication required");
    }

    let unitId = (req.query.unitId as string) || req.user.unitId;
    let societyId = req.user.societyId;

    if (!unitId) {
      const membership = await prisma.unitMember.findFirst({
        where: { userId: req.user.id, approvalStatus: "APPROVED" },
        include: { unit: true },
      });
      unitId = membership?.unitId;
      societyId = membership?.unit.societyId;
    }

    if (!unitId) {
      throw new AppError(
        400,
        "Unit context not found for user. Please specify unitId."
      );
    }

    const result = await visitorService.getUnitVisitorHistory(unitId, societyId);
    successResponse(
      res,
      "Unit visitor history retrieved successfully",
      result,
      200
    );
  } catch (error) {
    next(error);
  }
};
