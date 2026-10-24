import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import * as societyController from "./society.controller";
import {
  registerSocietySchema,
  getSocietyByCodeSchema,
} from "./society.validation";

const router = Router();

/**
 * @route   POST /api/v1/societies/register
 * @desc    Register society, create super admin, and auto-generate layout
 * @access  Public
 */
router.post(
  "/register",
  validate({ body: registerSocietySchema }),
  societyController.registerSociety
);

/**
 * @route   GET /api/v1/societies/code/:code
 * @desc    Fetch public society basic info and units by unique society code
 * @access  Public (for resident onboarding)
 */
router.get(
  "/code/:code",
  validate({ params: getSocietyByCodeSchema }),
  societyController.getSocietyByCode
);

export default router;
