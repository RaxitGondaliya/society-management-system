import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../utils/apiResponse";
import * as societyService from "./society.service";
import { RegisterSocietyInput } from "./society.validation";

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
  try {
    const result = await societyService.registerSociety(req.body);
    res.status(201).json({
      success: true,
      message: "Registration completed successfully.",
      data: {
        token: result.token,
        user: {
          id: result.admin.id,
          name: result.admin.fullName,
          fullName: result.admin.fullName,
          email: result.admin.email,
          phone: result.admin.phone,
          role: result.admin.role, // 'SUPER_ADMIN'
        },
        society: result.society,
        admin: result.admin,
        assignedUnit: result.assignedUnit,
        layoutSummary: result.layoutSummary,
      },
    });
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
