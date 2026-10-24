import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../utils/apiResponse";
import * as societyService from "./society.service";
import { RegisterSocietyInput } from "./society.validation";

/**
 * Handle society onboarding and layout generation
 * POST /api/v1/societies/register
 */
export const registerSociety = async (
  req: Request<unknown, unknown, RegisterSocietyInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await societyService.registerSociety(req.body);
    successResponse(
      res,
      "Society registered and layout generated successfully",
      result,
      201
    );
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
