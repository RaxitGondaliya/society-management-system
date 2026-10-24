import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { prisma } from "./config/prisma";

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log("✅ Successfully connected to PostgreSQL (society_db) via Prisma.");

    const server = app.listen(PORT, () => {
      console.log(`🚀 SocietySphere Backend Server listening on http://localhost:${PORT}`);
      console.log(`📡 Health Check URL: http://localhost:${PORT}/api/health`);
    });

    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log("🔒 Prisma database connection closed.");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("❌ Failed to start the server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

bootstrap();
