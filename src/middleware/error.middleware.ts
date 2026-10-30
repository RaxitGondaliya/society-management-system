import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError, errorResponse } from "../utils/apiResponse";

/**
 * 404 Not Found Middleware
 * Intercepts requests destined for unmapped routes and delivers a standardized API response envelope.
 */
export const notFoundHandler = (_req: Request, res: Response): void => {
  errorResponse(res, "Requested API route not found", 404);
};

/**
 * Enterprise Centralized Global Error Handler
 * Standardizes errors across AppError, Zod validation, Prisma ORM exceptions, and unexpected server failures.
 */
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 1. Handled Operational Application Errors
  if (err instanceof AppError) {
    errorResponse(res, err.message, err.statusCode, err.details);
    return;
  }

  // 2. Schema Validation Errors (Zod)
  if (err instanceof ZodError) {
    const formattedErrors = (err.issues || []).map((issue) => ({
      field: issue.path.join(".") || "root",
      message: issue.message,
    }));
    errorResponse(res, "Validation Error", 400, formattedErrors);
    return;
  }

  // 3. Prisma Known Database Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        errorResponse(
          res,
          "Conflict: A record with these details already exists.",
          409,
          { code: err.code }
        );
        return;
      }
      case "P2025": {
        errorResponse(
          res,
          "Record not found or already deleted.",
          404,
          { code: err.code }
        );
        return;
      }
      case "P2003": {
        errorResponse(
          res,
          "Foreign key constraint violation. Referenced parent record does not exist.",
          400,
          { code: err.code }
        );
        return;
      }
      case "P2014": {
        errorResponse(
          res,
          "The change would violate the relation constraint between records.",
          400,
          { code: err.code }
        );
        return;
      }
      default: {
        console.error("[Prisma Database Error]:", err.code, err.message);
        errorResponse(
          res,
          "Database operation failed",
          400,
          { code: err.code }
        );
        return;
      }
    }
  }

  // 4. Prisma Unknown / Initialization / Validation Errors
  if (
    err instanceof Prisma.PrismaClientValidationError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    console.error("[Prisma Client Error]:", err.message);
    errorResponse(
      res,
      "Database operation failed",
      500
    );
    return;
  }

  // 5. Malformed JSON Body Parsing Error
  if (err instanceof SyntaxError && "body" in err) {
    errorResponse(res, "Malformed JSON syntax in request payload.", 400);
    return;
  }

  // 6. Fallback Unhandled Internal Server Errors
  console.error("CRITICAL UNHANDLED ERROR:", err);
  const errorMessage =
    process.env.NODE_ENV === "development" && err instanceof Error
      ? err.message
      : "Internal server error. Please contact technical support.";

  errorResponse(res, errorMessage, 500);
};
