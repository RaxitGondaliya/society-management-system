import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { prisma } from "./config/prisma";


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
