import { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/prisma";
import { AppError, successResponse } from "../../utils/apiResponse";
import * as userService from "./user.service";
import {
  JoinSocietyInput,
  ApprovalDecisionInput,
  UpdateOccupancyInput,
} from "./user.validation";

/**
 * Submit resident onboarding request to join a society unit
 * POST /api/v1/users/join
 */
export const joinSociety = async (
  req: Request<unknown, unknown, JoinSocietyInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await userService.requestToJoinSociety(req.body);
    res.status(201).json({
      success: true,
      message: "Registration completed successfully.",
      data: {
        token: result.token,
        user: {
          id: result.user.id,
          name: result.user.name,
          fullName: result.user.fullName,
          email: result.user.email,
          phone: result.user.phone,
          role: result.user.role, // 'RESIDENT'
        },
        requestId: result.requestId,
        status: result.status,
        memberType: result.memberType,
        society: result.society,
        unit: result.unit,
        submittedAt: result.submittedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List pending resident join approval requests for admin review
 * GET /api/v1/users/pending-approvals
 */
export const listPending = async (
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

    const pending = await userService.getPendingApprovals(societyId);
    successResponse(
      res,
      "Pending join requests retrieved successfully",
      pending,
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Approve or reject resident join request
 * PATCH /api/v1/users/memberships/:membershipId/decision
 */
export const approveReject = async (
  req: Request<{ membershipId: string }, unknown, ApprovalDecisionInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { membershipId } = req.params;
    const result = await userService.reviewJoinRequest(
      membershipId,
      req.body,
      req.user?.societyId
    );
    successResponse(res, result.message, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get full hierarchical resident directory for the society
 * GET /api/v1/users/directory
 */
export const getDirectory = async (
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

    const directory = await userService.getSocietyDirectory(societyId);
    successResponse(
      res,
      "Society directory retrieved successfully",
      directory,
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update unit occupancy status
 * PATCH /api/v1/users/units/:unitId/occupancy
 */
export const updateOccupancy = async (
  req: Request<{ unitId: string }, unknown, UpdateOccupancyInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { unitId } = req.params;
    const result = await userService.updateUnitOccupancy(
      unitId,
      req.body,
      req.user?.societyId
    );
    successResponse(res, result.message, result, 200);
  } catch (error) {
    next(error);
  }
};
