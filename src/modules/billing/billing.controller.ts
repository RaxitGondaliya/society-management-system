import { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/prisma";
import { AppError, successResponse } from "../../utils/apiResponse";
import * as billingService from "./billing.service";
import {
  GenerateBillsInput,
  RecordPaymentInput,
  BillQueryParams,
} from "./billing.validation";

/**
 * Generate maintenance bills for all units in a society
 * POST /api/v1/billing/generate
 */
export const generateBills = async (
  req: Request<unknown, unknown, GenerateBillsInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let societyId = req.body.societyId || req.user?.societyId;

    if (!societyId && req.user?.id) {
      const membership = await prisma.unitMember.findFirst({
        where: { userId: req.user.id, approvalStatus: "APPROVED" },
        include: { unit: true },
      });
      societyId = membership?.unit.societyId;
    }

    const result = await billingService.generateSocietyBills(
      req.body,
      societyId
    );
    successResponse(res, result.message, result, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Record payment for a maintenance bill
 * POST /api/v1/billing/:billId/pay
 */
export const recordPayment = async (
  req: Request<{ billId: string }, unknown, RecordPaymentInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError(401, "Authentication required");
    }

    const { billId } = req.params;
    const result = await billingService.recordBillPayment(
      billId,
      req.body,
      {
        id: req.user.id,
        societyId: req.user.societyId,
      }
    );
    successResponse(res, result.message, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get personal unit maintenance bills for authenticated resident
 * GET /api/v1/billing/my-bills
 */
export const getMyBills = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError(401, "Authentication required");
    }

    const result = await billingService.getCallerUnitBills(req.user.id);
    successResponse(
      res,
      "Personal unit billing history retrieved successfully",
      result,
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * List all maintenance bills with status filter and pagination
 * GET /api/v1/billing/all
 */
export const listAllBills = async (
  req: Request<unknown, unknown, unknown, BillQueryParams>,
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
        "Society context missing. Provide societyId query parameter or login with active society."
      );
    }

    const result = await billingService.listAllBills(req.query, societyId);
    successResponse(
      res,
      "Maintenance bills retrieved successfully",
      result,
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get society-level financial revenue summary and defaulters list
 * GET /api/v1/billing/summary
 */
export const getFinancialSummary = async (
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
        "Society context missing. Provide societyId query parameter or login with active society."
      );
    }

    const summary = await billingService.getSocietyFinancialSummary(societyId);
    successResponse(
      res,
      "Society financial overview and defaulter list retrieved successfully",
      summary,
      200
    );
  } catch (error) {
    next(error);
  }
};
