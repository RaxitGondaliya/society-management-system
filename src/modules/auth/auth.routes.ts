import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import * as authController from "./auth.controller";
import { loginSchema } from "./auth.validation";

const router = Router();

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user by phone number and return JWT token
 * @access  Public
 */
router.post(
  "/login",
  validate({ body: loginSchema }),
  authController.login
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
