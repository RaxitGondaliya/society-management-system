import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { authenticateToken } from "../../middleware/auth.middleware";
import { isAdmin } from "../../middlewares/rbac.middleware";
import * as societyController from "./society.controller";
import {
  registerSocietySchema,
  getSocietyByCodeSchema,
  createWingSchema,
  updateWingSchema,
  wingIdParamSchema,
  createUnitSchema,
  updateUnitSchema,
  societyUnitIdParamSchema,
} from "./society.validation";

const router = Router();

/**
 * @route   GET /api/v1/societies
 * @desc    List all registered societies with wings and units (Public for Join My Society dropdown)
 * @access  Public
 */
router.get("/", societyController.listSocieties);

/**
 * @route   GET /api/v1/societies/list
 * @desc    Alias to list all registered societies with wings and units
 * @access  Public
 */
router.get("/list", societyController.listSocieties);

/**
 * @route   POST /api/v1/societies
 * @desc    Register society, create super admin, auto-generate layout, and return auth session token
 * @access  Public
 */
router.post(
  "/",
  validate({ body: registerSocietySchema }),
  societyController.registerSociety
);

/**
 * @route   POST /api/v1/societies/register
 * @desc    Register society alias endpoint
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

/**
 * @route   GET /api/v1/societies/my-structure
 * @desc    Fetch complete society structure (wings & units) for Admin management
 * @access  Protected (Admin)
 */
router.get(
  "/my-structure",
  authenticateToken,
  isAdmin,
  societyController.getMyStructure
);

/**
 * @route   POST /api/v1/societies/wings
 * @desc    Create a new Wing / Tower / Block
 * @access  Protected (Admin)
 */
router.post(
  "/wings",
  authenticateToken,
  isAdmin,
  validate({ body: createWingSchema }),
  societyController.createWing
);

/**
 * @route   PUT /api/v1/societies/wings/:wingId
 * @desc    Update an existing Wing / Tower / Block
 * @access  Protected (Admin)
 */
router.put(
  "/wings/:wingId",
  authenticateToken,
  isAdmin,
  validate({ params: wingIdParamSchema, body: updateWingSchema }),
  societyController.updateWing
);

/**
 * @route   PATCH /api/v1/societies/wings/:wingId
 * @desc    Update an existing Wing / Tower / Block (PATCH alias)
 * @access  Protected (Admin)
 */
router.patch(
  "/wings/:wingId",
  authenticateToken,
  isAdmin,
  validate({ params: wingIdParamSchema, body: updateWingSchema }),
  societyController.updateWing
);

/**
 * @route   DELETE /api/v1/societies/wings/:wingId
 * @desc    Delete a Wing / Tower / Block and its units
 * @access  Protected (Admin)
 */
router.delete(
  "/wings/:wingId",
  authenticateToken,
  isAdmin,
  validate({ params: wingIdParamSchema }),
  societyController.deleteWing
);

/**
 * @route   POST /api/v1/societies/units
 * @desc    Create a new Unit / Flat / House
 * @access  Protected (Admin)
 */
router.post(
  "/units",
  authenticateToken,
  isAdmin,
  validate({ body: createUnitSchema }),
  societyController.createUnit
);

/**
 * @route   PUT /api/v1/societies/units/:unitId
 * @desc    Update an existing Unit / Flat / House
 * @access  Protected (Admin)
 */
router.put(
  "/units/:unitId",
  authenticateToken,
  isAdmin,
  validate({ params: societyUnitIdParamSchema, body: updateUnitSchema }),
  societyController.updateUnit
);

/**
 * @route   PATCH /api/v1/societies/units/:unitId
 * @desc    Update an existing Unit / Flat / House (PATCH alias)
 * @access  Protected (Admin)
 */
router.patch(
  "/units/:unitId",
  authenticateToken,
  isAdmin,
  validate({ params: societyUnitIdParamSchema, body: updateUnitSchema }),
  societyController.updateUnit
);

/**
 * @route   DELETE /api/v1/societies/units/:unitId
 * @desc    Delete a Unit / Flat / House
 * @access  Protected (Admin)
 */
router.delete(
  "/units/:unitId",
  authenticateToken,
  isAdmin,
  validate({ params: societyUnitIdParamSchema }),
  societyController.deleteUnit
);

export default router;
