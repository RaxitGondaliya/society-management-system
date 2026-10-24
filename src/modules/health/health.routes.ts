import { Router } from "express";
import { HealthController } from "./health.controller";

const router = Router();

// GET /api/v1/health -> System health and diagnostic monitoring
router.get("/health", HealthController.getHealth);

export default router;
