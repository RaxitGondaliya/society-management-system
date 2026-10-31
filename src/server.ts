import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { prisma } from "./config/prisma";
import { flushStdout } from "./utils/sms.service";

// Ensure stdout is unbuffered on Render / container environments
flushStdout();


const PORT = process.env.PORT || 10000;

// Prevent idle database connection pooler drops from terminating the process
process.on("unhandledRejection", (reason: any) => {
  console.warn("[Server Warning] Unhandled Rejection:", reason?.message || reason);
});

process.on("uncaughtException", (error: Error) => {
  console.error("[Server Error] Uncaught Exception:", error?.message || error);
});

async function bootstrap() {
  try {
    // Verify database connection
    await prisma.$connect().catch((err) => {
      console.warn("[Server Warning] Initial DB connection check warning:", err.message);
    });

    // Idempotently ensure RBAC & Profile columns exist on User table in PostgreSQL
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "residentType" TEXT,
        ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS "societyId" TEXT,
        ADD COLUMN IF NOT EXISTS "unitId" TEXT,
        ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT,
        ADD COLUMN IF NOT EXISTS "emergencyContact" TEXT;
      `);
    } catch (schemaErr: any) {
      console.warn("[Server Notice] RBAC column check notice:", schemaErr?.message || schemaErr);
    }

    console.log("✅ Successfully connected to PostgreSQL (society_db) via Prisma.");



    const server = app.listen(PORT, () => {
      console.log(`🚀 SocietySphere Backend Server listening on http://localhost:${PORT}`);
      console.log(`📡 Health Check URL: http://localhost:${PORT}/api/health`);
    });

    let isShuttingDown = false;

    process.on("SIGTERM", async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log("🛑 Received SIGTERM. Gracefully shutting down...");
      await prisma.$disconnect();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log("🛑 Received SIGINT. Gracefully shutting down...");
      await prisma.$disconnect();
      process.exit(0);
    });
  } catch (error) {
    console.error("💥 Failed to start the server:", error);
    try {
      await prisma.$disconnect();
    } catch {}
    process.exit(1);
  }
}

bootstrap();
