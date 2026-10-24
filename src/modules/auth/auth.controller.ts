import { Request, Response, NextFunction } from "express";
import { AppError, successResponse } from "../../utils/apiResponse";
import * as authService from "./auth.service";
import { LoginInput, SendOtpInput, VerifyOtpInput } from "./auth.validation";

/**
 * Dispatch verification OTP code
 * POST /api/v1/auth/send-otp
 * SECURITY: OTP is dispatched via email and is NEVER returned in the API response.
 */
export const sendOtp = async (
  req: Request<unknown, unknown, SendOtpInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await authService.requestOtp(req.body);
    const successMsg =
      result.channel === "email"
        ? "Verification code has been dispatched to your email address."
        : "Verification code has been dispatched to your mobile number.";

    // Strict Security Rule: NEVER return the OTP or internal state in the API response
    res.status(200).json({
      success: true,
      message: successMsg,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify 6-digit OTP code and complete authentication
 * POST /api/v1/auth/verify-otp
 */
export const verifyOtp = async (
  req: Request<unknown, unknown, VerifyOtpInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await authService.verifyOtpAndAuthenticate(req.body);
    successResponse(res, "Identity verified successfully. Welcome to AURA.", result, 200);
  } catch (error) {
    next(error);
  }
};

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
