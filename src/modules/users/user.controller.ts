import { Request, Response, NextFunction } from "express";
import { prisma, executeResilientPrismaQuery } from "../../config/prisma";
import { AppError, successResponse } from "../../utils/apiResponse";
import * as userService from "./user.service";
import {
  JoinSocietyInput,
  ApprovalDecisionInput,
  UpdateOccupancyInput,
  UpdateMyProfileInput,
  AdminUpdateUserStatusInput,
} from "./user.validation";

/**
 * Fetch current logged-in user profile, role, status, society details, and associated unit
 * GET /api/v1/users/me
 */
export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError(401, "Authentication token missing or invalid");
    }

    const profile = await userService.getMyProfile(req.user.id);
    successResponse(
      res,
      "Current user profile retrieved successfully",
      profile,
      200
    );
  } catch (error) {
    next(error);
  }
};

export const getMeProfile = getCurrentUser;

/**
 * Update personal profile info (name, residentType, emergencyContact, avatarUrl)
 * PUT /api/v1/users/me
 */
export const updateCurrentUser = async (
  req: Request<unknown, unknown, UpdateMyProfileInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError(401, "Authentication token missing or invalid");
    }

    const updated = await userService.updateMyProfile(req.user.id, req.body);
    successResponse(
      res,
      "Profile updated successfully",
      updated,
      200
    );
  } catch (error) {
    next(error);
  }
};

export const updateMeProfile = updateCurrentUser;

/**
 * Admin: Approve or reject a resident onboarding request
 * PATCH /api/v1/admin/users/:id/status
 */
export const updateResidentStatus = async (
  req: Request<{ id: string }, unknown, AdminUpdateUserStatusInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    let societyId = req.user?.societyId || undefined;

    if (!societyId && req.user?.id) {
      const membership = await executeResilientPrismaQuery(() =>
        prisma.unitMember.findFirst({
          where: { userId: req.user!.id, approvalStatus: "APPROVED" },
          include: { unit: true },
        })
      );
      societyId = membership?.unit.societyId;
    }

    const result = await userService.adminUpdateUserStatus(
      id,
      req.body,
      societyId
    );
    successResponse(res, result.message, result, 200);
  } catch (error) {
    next(error);
  }
};

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
          status: result.status, // 'PENDING'
          residentType: result.memberType,
          societyId: result.society.id,
          unitId: result.unit.id,
        },
        requestId: result.requestId,
        status: result.status,
        memberType: result.memberType,
        society: result.society,
        unit: result.unit,
        memberships: [
          {
            id: result.requestId,
            memberType: result.memberType,
            isPrimaryHead: false,
            approvalStatus: result.status,
            unit: {
              id: result.unit.id,
              unitNumber: result.unit.unitNumber,
              sectionWingName: result.unit.wing,
              societyId: result.society.id,
              societyName: result.society.name,
              societyCode: result.society.code,
            },
          },
        ],
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
    let societyId = (req.query.societyId as string) || req.user?.societyId || undefined;

    if (!societyId && req.user?.id) {
      const membership = await executeResilientPrismaQuery(() =>
        prisma.unitMember.findFirst({
          where: { userId: req.user!.id, approvalStatus: "APPROVED" },
          include: { unit: true },
        })
      );
      societyId = membership?.unit.societyId;
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
      const membership = await executeResilientPrismaQuery(() =>
        prisma.unitMember.findFirst({
          where: { userId: req.user!.id },
          orderBy: [{ isPrimaryHead: "desc" }, { createdAt: "desc" }],
          include: { unit: true },
        })
      );
      societyId = membership?.unit.societyId;
    }

    if (!societyId) {
      const firstSociety = await executeResilientPrismaQuery(() =>
        prisma.society.findFirst({
          orderBy: { createdAt: "desc" },
          select: { id: true },
        })
      );
      societyId = firstSociety?.id;
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
