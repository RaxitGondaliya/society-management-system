import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { successResponse } from "../../utils/apiResponse";

export class HealthController {
  /**
   * Health & System Diagnostics Audit
   * Validates database connectivity, reports process uptime and memory telemetry.
   */
  public static async getHealth(_req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    let dbStatus = "CONNECTED";
    let dbLatencyMs = 0;

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - startTime;
    } catch (error) {
      console.error("Database Health Check Failed:", error);
      dbStatus = "DISCONNECTED";
    }

    const mem = process.memoryUsage();
    const isHealthy = dbStatus === "CONNECTED";

    const healthData = {
      status: isHealthy ? "HEALTHY" : "DEGRADED",
      version: "1.0.0",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        client: "PostgreSQL (Prisma ORM)",
      },
      memory: {
        rssMb: Math.round((mem.rss / (1024 * 1024)) * 100) / 100,
        heapTotalMb: Math.round((mem.heapTotal / (1024 * 1024)) * 100) / 100,
        heapUsedMb: Math.round((mem.heapUsed / (1024 * 1024)) * 100) / 100,
        externalMb: Math.round((mem.external / (1024 * 1024)) * 100) / 100,
      },
      environment: process.env.NODE_ENV || "development",
    };

    if (isHealthy) {
      successResponse(res, "System health check passed successfully.", healthData, 200);
    } else {
      res.status(503).json({
        success: false,
        message: "System health check detected degraded database connectivity.",
        data: healthData,
      });
    }
  }
}
