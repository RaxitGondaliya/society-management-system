import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var prismaShutdownRegistered: boolean | undefined;
}

/**
 * Helper to detect transient PostgreSQL / Neon pooler connection drop errors
 */
export const isPrismaConnectionClosedError = (error: any): boolean => {
  if (!error) return false;
  const code = String(error?.code || "");
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    code === "P1001" ||
    code === "P1002" ||
    code === "P1008" ||
    code === "P1017" ||
    msg.includes("closed") ||
    msg.includes("connection terminated") ||
    msg.includes("can't reach database server") ||
    msg.includes("server has closed the connection") ||
    msg.includes("connection reset")
  );
};

const createPrismaSingleton = (): PrismaClient => {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  // Resilient query middleware: auto-reconnects if Neon/PostgreSQL idle socket was closed
  if (typeof (client as any).$use === "function") {
    (client as any).$use(async (params: any, next: (params: any) => Promise<any>) => {
      try {
        return await next(params);
      } catch (error: any) {
        if (isPrismaConnectionClosedError(error)) {
          console.error(
            "[Prisma Connection Warning]: Database connection was temporarily closed, handling gracefully."
          );
          try {
            await client.$connect();
            return await next(params);
          } catch (retryError: any) {
            if (isPrismaConnectionClosedError(retryError)) {
              console.error(
                "[Prisma Connection Warning]: Database connection was temporarily closed, handling gracefully."
              );
            }
            throw retryError;
          }
        }
        throw error;
      }
    });
  }

  return client;
};

// Strict singleton pattern across all environments
export const prisma: PrismaClient = globalThis.prisma ?? createPrismaSingleton();
globalThis.prisma = prisma;

/**
 * Resilient wrapper for OTP and authentication database operations
 */
export async function executeResilientPrismaQuery<T>(
  operation: () => Promise<T>,
  fallbackValue?: T
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error: any) {
    if (isPrismaConnectionClosedError(error)) {
      console.error(
        "[Prisma Connection Warning]: Database connection was temporarily closed, handling gracefully."
      );
      try {
        await prisma.$connect();
        return await operation();
      } catch {
        return fallbackValue;
      }
    }
    throw error;
  }
}

export default prisma;
