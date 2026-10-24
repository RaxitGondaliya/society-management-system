import { Request, Response, NextFunction } from "express";
import { AppError, successResponse } from "../../utils/apiResponse";
import * as authService from "./auth.service";
import { LoginInput } from "./auth.validation";

/**
 * Handle user login
 * POST /api/v1/auth/login
 */
export const login = async (
  req: Request<unknown, unknown, LoginInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await authService.loginUser(req.body);
    successResponse(res, "Login successful", result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated user profile
 * GET /api/v1/auth/me
 */
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError(401, "Authentication token missing or invalid");
    }

    const profile = await authService.getCurrentUser(req.user.id);
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
