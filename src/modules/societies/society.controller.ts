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
 * Resolve the authenticated admin's societyId across params, query, body, JWT, and DB associations
 */
const resolveAdminSocietyId = async (req: Request<any, any, any, any>): Promise<string> => {
  const isSocietyWingCreationRoute =
    Boolean(req.params?.id) &&
    (req.originalUrl || req.path || "").includes("/societies/") &&
    (req.originalUrl || req.path || "").endsWith("/wings");

  const directCandidate = (
    (isSocietyWingCreationRoute ? req.params?.id : "") ||
    req.params?.societyId ||
    req.query?.societyId ||
    req.body?.societyId ||
    req.user?.societyId ||
    ""
  )
    .toString()
    .trim();

  if (directCandidate) {
    return directCandidate;
  }

  // Try resolving from target wing if wingId is provided
  const candidateWingId = req.params?.wingId || req.body?.sectionWingId || req.body?.wingId;
  if (candidateWingId) {
    const wing = await executeResilientPrismaQuery(() =>
      prisma.sectionWing.findUnique({
        where: { id: String(candidateWingId) },
        select: { societyId: true },
      })
    );
    if (wing?.societyId) {
      return wing.societyId;
    }
  }

  // Try resolving from target unit if unitId is provided
  const candidateUnitId = req.params?.unitId;
  if (candidateUnitId) {
    const unit = await executeResilientPrismaQuery(() =>
      prisma.unit.findUnique({
        where: { id: String(candidateUnitId) },
        select: { societyId: true },
      })
    );
    if (unit?.societyId) {
      return unit.societyId;
    }
  }

  if (req.user?.id) {
    try {
      const dbUser = await executeResilientPrismaQuery(() =>
        prisma.user.findUnique({
          where: { id: req.user!.id },
          select: {
            societyId: true,
            unit: { select: { societyId: true } },
          },
        })
      );
      if (dbUser?.societyId) return dbUser.societyId;
      if (dbUser?.unit?.societyId) return dbUser.unit.societyId;
    } catch {
      // Ignore if optional user columns are migrating
    }

    const membership = await executeResilientPrismaQuery(() =>
      prisma.unitMember.findFirst({
        where: { userId: req.user!.id },
        include: { unit: true },
        orderBy: { createdAt: "desc" },
      })
    );
    if (membership?.unit?.societyId) {
      return membership.unit.societyId;
    }
  }

  // Fallback for Super Admin managing the primary registered society
  const fallbackSociety = await executeResilientPrismaQuery(() =>
    prisma.society.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })
  );
  if (fallbackSociety?.id) {
    return fallbackSociety.id;
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
 * PUT /api/v1/societies/wings/:wingId or PUT /api/v1/wings/:id
 */
export const updateWing = async (
  req: Request<{ wingId?: string; id?: string }, unknown, UpdateWingInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetWingId = (req.params.wingId || req.params.id || "").trim();
    const societyId = await resolveAdminSocietyId({
      ...req,
      params: { ...req.params, wingId: targetWingId },
    } as any);
    const updated = await societyService.updateWing(
      societyId,
      targetWingId,
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
 * DELETE /api/v1/societies/wings/:wingId or DELETE /api/v1/wings/:id
 */
export const deleteWing = async (
  req: Request<{ wingId?: string; id?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetWingId = (req.params.wingId || req.params.id || "").trim();
    const societyId = await resolveAdminSocietyId({
      ...req,
      params: { ...req.params, wingId: targetWingId },
    } as any);
    const result = await societyService.deleteWing(
      societyId,
      targetWingId
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
 * POST /api/v1/wings/:wingId/units or POST /api/v1/societies/units
 */
export const createUnit = async (
  req: Request<{ wingId?: string }, unknown, CreateUnitInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetWingId = (
      req.params?.wingId ||
      req.body?.sectionWingId ||
      req.body?.wingId ||
      ""
    ).trim();
    const societyId = await resolveAdminSocietyId({
      ...req,
      params: { ...req.params, wingId: targetWingId },
    } as any);
    const unit = await societyService.createUnit(societyId, {
      ...req.body,
      sectionWingId: targetWingId,
    });
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
 * PUT /api/v1/societies/units/:unitId or PUT /api/v1/units/:id
 */
export const updateUnit = async (
  req: Request<{ unitId?: string; id?: string }, unknown, UpdateUnitInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUnitId = (req.params.unitId || req.params.id || "").trim();
    const societyId = await resolveAdminSocietyId({
      ...req,
      params: { ...req.params, unitId: targetUnitId },
    } as any);
    const updated = await societyService.updateUnit(
      societyId,
      targetUnitId,
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
 * DELETE /api/v1/societies/units/:unitId or DELETE /api/v1/units/:id
 */
export const deleteUnit = async (
  req: Request<{ unitId?: string; id?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUnitId = (req.params.unitId || req.params.id || "").trim();
    const societyId = await resolveAdminSocietyId({
      ...req,
      params: { ...req.params, unitId: targetUnitId },
    } as any);
    const result = await societyService.deleteUnit(
      societyId,
      targetUnitId
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
