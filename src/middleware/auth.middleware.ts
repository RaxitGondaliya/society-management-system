import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/apiResponse";
import { verifyToken } from "../utils/jwt";
import { prisma, executeResilientPrismaQuery } from "../config/prisma";
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

    // Verify user in database with resilient fallback if optional columns are still migrating
    let user: any = null;
    try {
      user = await executeResilientPrismaQuery(() =>
        prisma.user.findUnique({
          where: { id: decoded.id },
          select: {
            id: true,
            phone: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            residentType: true,
            societyId: true,
            unitId: true,
            avatarUrl: true,
            emergencyContact: true,
            isActive: true,
            unitMembers: {
              orderBy: [{ isPrimaryHead: "desc" }, { createdAt: "desc" }],
              select: {
                id: true,
                unitId: true,
                memberType: true,
                approvalStatus: true,
                unit: {
                  select: {
                    id: true,
                    societyId: true,
                  },
                },
              },
            },
          },
        })
      );
    } catch {
      user = await executeResilientPrismaQuery(() =>
        prisma.user.findUnique({
          where: { id: decoded.id },
          select: {
            id: true,
            phone: true,
            email: true,
            fullName: true,
            role: true,
            isActive: true,
            unitMembers: {
              orderBy: [{ isPrimaryHead: "desc" }, { createdAt: "desc" }],
              select: {
                id: true,
                unitId: true,
                memberType: true,
                approvalStatus: true,
                unit: {
                  select: {
                    id: true,
                    societyId: true,
                  },
                },
              },
            },
          },
        })
      );
    }

    if (!user) {
      errorResponse(res, "User account associated with this token not found", 401);
      return;
    }

    if (!user.isActive) {
      errorResponse(res, "User account is deactivated. Access revoked.", 403);
      return;
    }

    const memberships = Array.isArray(user.unitMembers) ? user.unitMembers : [];
    const approvedMembership = memberships.find(
      (m: any) => m.approvalStatus === "APPROVED"
    );
    const primaryMembership = approvedMembership || memberships[0] || null;

    const isAdminOrGuard = [
      "SUPER_ADMIN",
      "SOCIETY_ADMIN",
      "SUB_ADMIN",
      "COMMITTEE",
      "GUARD",
      "SECURITY",
    ].includes((user.role || "").toUpperCase());

    const effectiveStatus = isAdminOrGuard
      ? "APPROVED"
      : approvedMembership
      ? "APPROVED"
      : user.status || primaryMembership?.approvalStatus || "PENDING";

    const effectiveSocietyId =
      user.societyId ||
      primaryMembership?.unit?.societyId ||
      decoded.societyId ||
      null;

    const effectiveUnitId =
      user.unitId || primaryMembership?.unitId || decoded.unitId || null;

    const effectiveResidentType =
      user.residentType || primaryMembership?.memberType || null;

    req.user = {
      id: user.id,
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: effectiveStatus,
      residentType: effectiveResidentType,
      societyId: effectiveSocietyId || undefined,
      unitId: effectiveUnitId || undefined,
      avatarUrl: user.avatarUrl || null,
      emergencyContact: user.emergencyContact || null,
    };

    next();
  } catch {
    errorResponse(res, "Invalid or expired token", 401);
  }
};

export const authenticate = authenticateToken;
