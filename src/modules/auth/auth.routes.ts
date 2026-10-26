import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import * as authController from "./auth.controller";
import { loginSchema, sendOtpSchema, verifyOtpSchema } from "./auth.validation";

const router = Router();

/**
 * @route   POST /api/v1/auth/send-otp
 * @desc    Generate secure 6-digit OTP and dispatch via Nodemailer email (enforces registered user check)
 * @access  Public
 */
router.post(
  "/send-otp",
  validate({ body: sendOtpSchema }),
  authController.sendOtp
);

/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    Verify 6-digit cryptographic OTP and issue JWT access token
 * @access  Public
 */
router.post(
  "/verify-otp",
  validate({ body: verifyOtpSchema }),
  authController.verifyOtp
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user by phone or email + OTP/password
 * @access  Public
 */
router.post(
  "/login",
  validate({ body: loginSchema }),
  authController.login
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Invalidate active session token and clear cookies
 * @access  Public / Authenticated
 */
router.post(
  "/logout",
  authController.logout
);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Fetch active profile of the authenticated user
 * @access  Protected
 */
router.get(
  "/me",
  authenticate,
  authController.getMe
);

export default router;
