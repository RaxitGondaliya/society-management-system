import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { authenticate, authenticateToken } from "../../middleware/auth.middleware";
import * as authController from "./auth.controller";
import * as userController from "../users/user.controller";
import { updateMyProfileSchema } from "../users/user.validation";
import {
  loginSchema,
  registerOtpSchema,
  registerUserSchema,
  sendOtpSchema,
  verifyOtpSchema,
  verifyRegisterOtpSchema,
} from "./auth.validation";

const router = Router();

/**
 * @route   POST /api/v1/auth/register-otp
 * @desc    Generate 6-digit OTP and dispatch to unregistered mobile via Fast2SMS Quick Route (route=q)
 * @access  Public
 */
router.post(
  "/register-otp",
  validate({ body: registerOtpSchema }),
  authController.sendRegisterOtp
);

/**
 * @route   POST /api/v1/auth/verify-register-otp
 * @desc    Pre-verify 6-digit registration mobile OTP for inline form verification UX
 * @access  Public
 */
router.post(
  "/verify-register-otp",
  validate({ body: verifyRegisterOtpSchema }),
  authController.verifyRegisterOtp
);

/**
 * @route   POST /api/v1/auth/send-otp
 * @desc    Generate secure 6-digit OTP and dispatch via Nodemailer/Fast2SMS (enforces registered user check)
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
 * @desc    Authenticate user by phone or email + mandatory 6-digit OTP
 * @access  Public
 */
router.post(
  "/login",
  validate({ body: loginSchema }),
  authController.login
);

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register user in PostgreSQL after unconditional mobile OTP verification (email optional)
 * @access  Public
 */
router.post(
  "/register",
  validate({ body: registerUserSchema }),
  authController.register
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
  authenticateToken,
  authController.getMe
);

/**
 * @route   PUT /api/v1/auth/me
 * @desc    Update active profile of the authenticated user (alias for PUT /api/v1/users/me)
 * @access  Protected
 */
router.put(
  "/me",
  authenticateToken,
  validate({ body: updateMyProfileSchema }),
  userController.updateCurrentUser
);

/**
 * @route   PATCH /api/v1/auth/me
 * @desc    Update active profile of the authenticated user (alias for PATCH /api/v1/users/me)
 * @access  Protected
 */
router.patch(
  "/me",
  authenticateToken,
  validate({ body: updateMyProfileSchema }),
  userController.updateCurrentUser
);

export default router;
