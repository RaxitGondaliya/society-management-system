import { Request, Response, NextFunction } from "express";
import { prisma, executeResilientPrismaQuery } from "../../config/prisma";
import { AppError, successResponse } from "../../utils/apiResponse";
import * as societyService from "./society.service";
import {
  RegisterSocietyInput,
  CreateWingInput,
  UpdateWingInput,
  CreateUnitInput,
  UpdateUnitInput,
} from "./society.validation";

/**
 * Resolve the authenticated admin's societyId
 */
const resolveAdminSocietyId = async (req: Request<any, any, any, any>): Promise<string> => {
  const fromQueryOrBody =
    (req.query?.societyId as string) ||
    (req.body as any)?.societyId ||
    req.user?.societyId;

  if (fromQueryOrBody) {
    return fromQueryOrBody;
  }

  if (req.user?.id) {
    const membership = await executeResilientPrismaQuery(() =>
      prisma.unitMember.findFirst({
        where: { userId: req.user!.id, approvalStatus: "APPROVED" },
        include: { unit: true },
      })
    );
    if (membership?.unit?.societyId) {
      return membership.unit.societyId;
    }
  }

  throw new AppError(400, "Society context not found for this administrator.");
};

/**
 * Handle society onboarding, layout generation, and session creation
 * POST /api/v1/societies
 * POST /api/v1/societies/register
 */
export const registerSociety = async (
  req: Request<unknown, unknown, RegisterSocietyInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const payload: any = req.body || {};
  const email = payload.email || payload.admin?.email;
  const societyName = payload.name || payload.societyName;

  console.log("[Register] Incoming payload:", {
    email,
    societyName: societyName || payload.name,
  });
  console.log("[Register] Attempting Prisma insert into Neon DB...");

  try {
    const result = await societyService.registerSociety(req.body);

    console.log(
      "[Register] Successfully committed to Neon DB with ID:",
      result.admin.id
    );

    res.status(201).json({
      success: true,
      message: "Society and admin registered successfully in database.",
      data: {
        userId: result.admin.id,
        societyId: result.society.id,
        email: result.admin.email,
        token: result.token,
        user: {
          id: result.admin.id,
          name: result.admin.fullName,
          fullName: result.admin.fullName,
          email: result.admin.email,
          phone: result.admin.phone,
          role: "SUPER_ADMIN",
          status: "APPROVED",
          residentType: "OWNER",
          societyId: result.society.id,
          unitId: result.assignedUnit.id,
          profileLocked: true,
        },
        society: result.society,
        admin: result.admin,
        assignedUnit: result.assignedUnit,
        layoutSummary: result.layoutSummary,
      },
    });
  } catch (error: any) {
    console.error("[REGISTRATION_DB_ERROR]:", error);
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Database transaction failed",
    });
  }
};

/**
 * List all registered societies with wings and units (Public for Join My Society dropdown)
 * GET /api/v1/societies
 * GET /api/v1/societies/list
 */
export const listSocieties = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const societies = await societyService.listAllSocieties();
    successResponse(res, "Societies retrieved successfully", societies, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch public society basic info and layout by unique society code
 * GET /api/v1/societies/code/:code
 */
export const getSocietyByCode = async (
  req: Request<{ code: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { code } = req.params;
    const society = await societyService.getSocietyByCode(code);
    successResponse(res, "Society retrieved successfully", society, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch complete society structure (wings & units) for Admin management
 * GET /api/v1/societies/my-structure
 */
export const getMyStructure = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const societyId = await resolveAdminSocietyId(req);
    const structure = await societyService.getSocietyStructure(societyId);
    successResponse(
      res,
      "Society structure retrieved successfully",
      structure,
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new Wing / Tower / Block
 * POST /api/v1/societies/wings
 */
export const createWing = async (
  req: Request<unknown, unknown, CreateWingInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const societyId = await resolveAdminSocietyId(req);
    const wing = await societyService.createWing(societyId, req.body);
    successResponse(
      res,
      "Wing / Tower created successfully",
      wing,
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing Wing / Tower / Block
 * PUT /api/v1/societies/wings/:wingId
 */
export const updateWing = async (
  req: Request<{ wingId: string }, unknown, UpdateWingInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const societyId = await resolveAdminSocietyId(req);
    const updated = await societyService.updateWing(
      societyId,
      req.params.wingId,
      req.body
    );
    successResponse(
      res,
      "Wing / Tower updated successfully",
      updated,
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a Wing / Tower / Block
 * DELETE /api/v1/societies/wings/:wingId
 */
export const deleteWing = async (
  req: Request<{ wingId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const societyId = await resolveAdminSocietyId(req);
    const result = await societyService.deleteWing(
      societyId,
      req.params.wingId
    );
    successResponse(
      res,
      "Wing / Tower and its units deleted successfully",
      result,
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new Unit / Flat / House
 * POST /api/v1/societies/units
 */
export const createUnit = async (
  req: Request<unknown, unknown, CreateUnitInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const societyId = await resolveAdminSocietyId(req);
    const unit = await societyService.createUnit(societyId, req.body);
    successResponse(
      res,
      "Unit / Flat created successfully",
      unit,
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing Unit / Flat / House
 * PUT /api/v1/societies/units/:unitId
 */
export const updateUnit = async (
  req: Request<{ unitId: string }, unknown, UpdateUnitInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const societyId = await resolveAdminSocietyId(req);
    const updated = await societyService.updateUnit(
      societyId,
      req.params.unitId,
      req.body
    );
    successResponse(
      res,
      "Unit / Flat updated successfully",
      updated,
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a Unit / Flat / House
 * DELETE /api/v1/societies/units/:unitId
 */
export const deleteUnit = async (
  req: Request<{ unitId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const societyId = await resolveAdminSocietyId(req);
    const result = await societyService.deleteUnit(
      societyId,
      req.params.unitId
    );
    successResponse(
      res,
      "Unit / Flat deleted successfully",
      result,
      200
    );
  } catch (error) {
    next(error);
  }
};
