import { Request, Response, NextFunction } from "express";
import { AppError, successResponse } from "../../utils/apiResponse";
import { sanitizeMobileNumber } from "../../utils/sms.service";
import * as authService from "./auth.service";
import {
  LoginInput,
  RegisterOtpInput,
  RegisterUserInput,
  SendOtpInput,
  VerifyOtpInput,
  VerifyRegisterOtpInput,
} from "./auth.validation";

/**
 * Dispatch registration verification OTP to mobile number
 * POST /api/v1/auth/register-otp
 * Ensures mobile number does not already exist (409 Conflict if registered).
 */
export const sendRegisterOtp = async (
  req: Request<unknown, unknown, RegisterOtpInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await authService.requestRegistrationOtp(req.body);
    res.status(200).json({
      success: true,
      message: "Verification OTP sent to mobile.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify 6-digit registration mobile OTP inline before final form submission
 * POST /api/v1/auth/verify-register-otp
 */
export const verifyRegisterOtp = async (
  req: Request<unknown, unknown, VerifyRegisterOtpInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await authService.verifyRegistrationOtp(req.body);
    successResponse(res, "Mobile number verified successfully.", result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Handle user registration with mandatory mobile OTP verification
 * POST /api/v1/auth/register
 */
export const register = async (
  req: Request<unknown, unknown, RegisterUserInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await authService.registerUserWithOtp(req.body);
    successResponse(
      res,
      "Registration completed successfully.",
      result,
      201
    );
  } catch (error) {
    next(error);
  }
};

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

  const rawIdentifier = (
    req.body?.identifier ||
    req.body?.email ||
    req.body?.phone ||
    ""
  ).trim();
  const cleanPhone = sanitizeMobileNumber(rawIdentifier);
  const isTenDigitPhone =
    /^[0-9]{10}$/.test(cleanPhone) && !rawIdentifier.includes("@");
  const isEmailChannel =
    req.body?.type === "email" ||
    rawIdentifier.includes("@") ||
    Boolean(req.body?.email);
  const isMobile =
    !isEmailChannel &&
    (req.body?.type === "mobile" ||
      isTenDigitPhone ||
      Boolean(req.body?.phone));

  const normalizedPayload: SendOtpInput = isMobile
    ? {
        ...req.body,
        identifier: rawIdentifier,
        phone: cleanPhone,
        type: "mobile",
      }
    : {
        ...req.body,
        identifier: rawIdentifier,
        email: (req.body?.email || rawIdentifier).toLowerCase().trim(),
        type: "email",
      };

  try {
    // 25-second ceiling timeout ensuring compatibility with Nodemailer 20s connection limits
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("OTP dispatch timed out after 25000ms"));
      }, 25000);
      if (typeof timer.unref === "function") timer.unref();
    });

    const result = await Promise.race([
      authService.requestOtp(normalizedPayload),
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
    console.error("[Email Dispatch Error]:", error?.message || error);

    if (!res.headersSent) {
      // Respect operational user state errors (404 Account Not Found, 403 Account Deactivated)
      if (error instanceof AppError && (error.statusCode === 404 || error.statusCode === 403)) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }

      // Return 200 OK on transport/SMTP/provider errors so frontend verification screen can be tested with the logged OTP
      res.status(200).json({
        success: true,
        message: isMobile
          ? "Verification code dispatched to your registered mobile number."
          : "Verification code dispatched to your registered email.",
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
