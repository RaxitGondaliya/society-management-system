import { Request, Response, NextFunction } from "express";
import { AppError, successResponse } from "../../utils/apiResponse";
import * as authService from "./auth.service";
import { LoginInput, SendOtpInput, VerifyOtpInput } from "./auth.validation";
import { registerSociety } from "../societies/society.controller";

/**
 * Handle user/society registration
 * POST /api/v1/auth/register
 */
export const register = registerSociety;

/**
 * Dispatch verification OTP code
 * POST /api/v1/auth/send-otp
 * SECURITY: Enforces pre-login registered user existence validation.
 * If user does not exist, returns 404 immediately without generating OTP or calling Nodemailer.
 */
export const sendOtp = async (
  req: Request<unknown, unknown, SendOtpInput>,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  if (res.headersSent) return;

  try {
    // Fail-safe ceiling timeout to guarantee explicit response under 5 seconds
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("OTP generation and dispatch timed out (exceeded 4800ms limit)."));
      }, 4800);
      if (typeof timer.unref === "function") timer.unref();
    });

    const result = await Promise.race([
      authService.requestOtp(req.body),
      timeoutPromise,
    ]);

    const successMsg =
      result.channel === "email"
        ? "Verification code dispatched to your registered email."
        : "Verification code dispatched to your registered mobile number.";

    if (!res.headersSent) {
      res.status(200).json({
        success: true,
        message: successMsg,
      });
    }
  } catch (error: any) {
    console.error("[AuthController] Failed to dispatch OTP:", error?.message || error);

    if (!res.headersSent) {
      // Respect operational application errors (e.g., 404 User Not Found, 403 Deactivated)
      if (error instanceof AppError || error?.statusCode) {
        const statusCode = error.statusCode || 400;
        res.status(statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Failed to dispatch email. Please verify SMTP settings.",
      });
    }
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
 * Invalidate active session and log out
 * POST /api/v1/auth/logout
 */
export const logout = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      authService.invalidateSession(token);
    }

    res.clearCookie("token");
    res.clearCookie("refreshToken");

    res.status(200).json({
      success: true,
      message: "Logged out successfully. Active session ended.",
    });
  } catch (error: any) {
    console.error("[AuthController] Logout error:", error?.message || error);
    res.status(200).json({
      success: true,
      message: "Logged out successfully. Active session ended.",
    });
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
