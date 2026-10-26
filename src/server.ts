import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { prisma } from "./config/prisma";
import { verifyTransporterConnection } from "./utils/email.service";

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

    // Diagnostic Check: Verify SMTP connection on startup (non-blocking, fails gracefully without crashing)
    verifyTransporterConnection().catch((err) => {
      console.warn("[Server Warning] SMTP verification check warning:", err?.message || err);
    });

    const server = app.listen(PORT, () => {
      console.log(`🚀 SocietySphere Backend Server listening on http://localhost:${PORT}`);
      console.log(`📡 Health Check URL: http://localhost:${PORT}/api/health`);
    });

    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        try {
          await prisma.$disconnect();
        } catch {}
        console.log("🔒 Prisma database connection closed.");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("💥 Failed to start the server:", error);
    try {
      await prisma.$disconnect();
    } catch {}
    process.exit(1);
  }
}

bootstrap();
