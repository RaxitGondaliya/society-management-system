import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/apiResponse";
import { verifyToken } from "../utils/jwt";
import { prisma } from "../config/prisma";
import { isSessionRevoked } from "../modules/auth/auth.service";

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      errorResponse(res, "Authorization token is missing or malformed", 401);
      return;
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      errorResponse(res, "Authorization token is missing", 401);
      return;
    }

    // Check if token was explicitly logged out / revoked
    if (isSessionRevoked(token)) {
      errorResponse(res, "Session has been invalidated. Please log in again.", 401);
      return;
    }

    const decoded = verifyToken(token);

    // Verify user in database to ensure they are active and account exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      errorResponse(res, "User account associated with this token not found", 401);
      return;
    }

    if (!user.isActive) {
      errorResponse(res, "User account is deactivated. Access revoked.", 403);
      return;
    }

    req.user = {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      societyId: decoded.societyId,
      unitId: decoded.unitId,
    };

    next();
  } catch (error) {
    errorResponse(
      res,
      "Invalid or expired token",
      401,
      error instanceof Error ? error.message : undefined
    );
  }
};

export const authenticate = authenticateToken;
