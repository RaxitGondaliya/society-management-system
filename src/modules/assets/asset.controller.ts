import { Request, Response, NextFunction } from "express";
import { AssetService } from "./asset.service";
import { successResponse } from "../../utils/apiResponse";

export class AssetController {
  /**
   * POST /assets
   * Admin registers physical equipment
   */
  static async createAsset(req: Request, res: Response, next: NextFunction) {
    try {
      const asset = await AssetService.registerAsset(req.user!, req.body);
      return successResponse(
        res,
        "Asset registered successfully.",
        asset,
        201
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /assets
   * Fetch filtered assets and equipment
   */
  static async getAssets(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AssetService.listSocietyAssets(
        req.user!,
        req.query as any
      );
      return successResponse(
        res,
        "Society assets retrieved successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /assets/:assetId/maintenance
   * Record repair/AMC service event
   */
  static async logService(req: Request, res: Response, next: NextFunction) {
    try {
      const assetId = (req.params.assetId || req.body.assetId) as string;
      const result = await AssetService.logAssetServiceRecord(
        req.user!,
        assetId,
        req.body
      );
      return successResponse(
        res,
        "Maintenance record logged successfully.",
        result,
        201
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /assets/maintenance/alerts
   * View expiring AMCs and upcoming services
   */
  static async getMaintenanceAlerts(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const alerts = await AssetService.getUpcomingMaintenanceAlerts(req.user!);
      return successResponse(
        res,
        "Maintenance and warranty alerts retrieved successfully.",
        alerts,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /assets/inventory
   * Admin adds/updates consumable item
   */
  static async upsertInventory(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await AssetService.manageInventoryItem(req.user!, req.body);
      const statusCode = result.isNew ? 201 : 200;
      const message = result.isNew
        ? "Inventory item created successfully."
        : "Inventory item updated successfully.";
      return successResponse(res, message, result.item, statusCode);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PATCH /assets/inventory/:itemId/adjust
   * Adjust stock for usage or replenishment
   */
  static async updateStock(req: Request, res: Response, next: NextFunction) {
    try {
      const itemId = req.params.itemId as string;
      const result = await AssetService.adjustInventoryStock(
        req.user!,
        itemId,
        req.body
      );
      return successResponse(
        res,
        "Inventory stock adjusted successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /assets/inventory
   * List stock inventory with threshold alerts
   */
  static async getInventory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AssetService.getInventoryStatus(
        req.user!,
        req.query as any
      );
      return successResponse(
        res,
        "Inventory status retrieved successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }
}
