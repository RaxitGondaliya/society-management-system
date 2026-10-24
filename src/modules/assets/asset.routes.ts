import { Router } from "express";
import { AssetController } from "./asset.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createAssetSchema,
  logMaintenanceRecordSchema,
  inventoryItemSchema,
  adjustStockSchema,
  assetQuerySchema,
  inventoryQuerySchema,
} from "./asset.validation";

const router = Router();

// ==========================================
// STATIC / SPECIALIZED ROUTES (Placed before :id params)
// ==========================================

// 1. Get upcoming maintenance & warranty alerts
router.get(
  "/maintenance/alerts",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  AssetController.getMaintenanceAlerts
);

// 2. Add / update inventory item
router.post(
  "/inventory",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  validate({ body: inventoryItemSchema }),
  AssetController.upsertInventory
);

// 3. Get inventory list with threshold alerts
router.get(
  "/inventory",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  validate({ query: inventoryQuerySchema }),
  AssetController.getInventory
);

// 4. Adjust inventory stock level
router.patch(
  "/inventory/:itemId/adjust",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  validate({ body: adjustStockSchema }),
  AssetController.updateStock
);

// ==========================================
// ASSET CRUD & MAINTENANCE ROUTES
// ==========================================

// 5. Register physical equipment / asset
router.post(
  "/",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  validate({ body: createAssetSchema }),
  AssetController.createAsset
);

// 6. Fetch filtered assets and equipment
router.get(
  "/",
  authenticate,
  validate({ query: assetQuerySchema }),
  AssetController.getAssets
);

// 7. Log maintenance or repair service record
router.post(
  "/:assetId/maintenance",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  validate({ body: logMaintenanceRecordSchema }),
  AssetController.logService
);

export default router;
