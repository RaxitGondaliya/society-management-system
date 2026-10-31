import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/apiResponse";

export type Role =
  | "SUPER_ADMIN"
  | "SOCIETY_ADMIN"
  | "SUB_ADMIN"
  | "RESIDENT"
  | "GUARD";

export type ResidentType = "OWNER" | "TENANT";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

/**
 * Normalize role aliases (e.g. SUB_ADMIN / COMMITTEE -> SOCIETY_ADMIN, SECURITY -> GUARD)
 * while preserving exact matches.
 */
const matchesAllowedRole = (
  userRole: string,
  allowedRoles: readonly string[]
): boolean => {
  const normalizedUserRole = (userRole || "").toUpperCase();
  if (allowedRoles.includes(normalizedUserRole)) {
    return true;
  }

  // Treat SOCIETY_ADMIN, SUB_ADMIN, and COMMITTEE as equivalent society-level admin roles
  const adminEquivalents = ["SOCIETY_ADMIN", "SUB_ADMIN", "COMMITTEE"];
  if (
    adminEquivalents.includes(normalizedUserRole) &&
    allowedRoles.some((r) => adminEquivalents.includes(r.toUpperCase()))
  ) {
    return true;
  }

  // Treat GUARD and SECURITY as equivalent gate security roles
  const guardEquivalents = ["GUARD", "SECURITY"];
  if (
    guardEquivalents.includes(normalizedUserRole) &&
    allowedRoles.some((r) => guardEquivalents.includes(r.toUpperCase()))
  ) {
    return true;
  }

  return false;
};

/**
 * Paths that a user with status === 'PENDING' is still allowed to access
 * (viewing/updating own profile, checking auth session, claiming residence, logging out).
 */
const isAllowedForPendingStatus = (req: Request): boolean => {
  const path = (req.originalUrl || req.baseUrl + req.path || "").toLowerCase();
  if (
    path.includes("/users/me") ||
    path.includes("/auth/me") ||
    path.includes("/auth/logout") ||
    path.includes("/users/join") ||
    path.includes("/users/claim-residence")
  ) {
    return true;
  }
  return false;
};

/**
 * Reusable Role-Based Access Control (RBAC) Middleware
 * - Rejects unauthenticated requests with 401 Unauthorized
 * - Rejects authenticated users lacking required role with 403 Forbidden
 * - Blocks RESIDENT users whose onboarding status is 'PENDING' or 'REJECTED' from protected resident features
 */
export const authorizeRoles = (...allowedRoles: (Role | string)[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.id) {
      errorResponse(res, "Unauthorized: Authentication required", 401);
      return;
    }

    if (
      allowedRoles.length > 0 &&
      !matchesAllowedRole(req.user.role, allowedRoles)
    ) {
      errorResponse(
        res,
        "You do not have permission to access this resource",
        403
      );
      return;
    }

    // Enforce approval status check for residents accessing protected features
    const normalizedRole = (req.user.role || "").toUpperCase();
    const isAdminOrGuard = [
      "SUPER_ADMIN",
      "SOCIETY_ADMIN",
      "SUB_ADMIN",
      "COMMITTEE",
      "GUARD",
      "SECURITY",
    ].includes(normalizedRole);

    if (!isAdminOrGuard && !isAllowedForPendingStatus(req)) {
      if (req.user.status === "PENDING") {
        errorResponse(
          res,
          "Your account is awaiting approval from the Society Admin",
          403
        );
        return;
      }
      if (req.user.status === "REJECTED") {
        errorResponse(
          res,
          "Your account onboarding request was rejected by the Society Admin",
          403
        );
        return;
      }
    }

    next();
  };
};

/**
 * Explicit middleware to block access if user.status === 'PENDING' or 'REJECTED'
 */
export const requireApprovedStatus = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || !req.user.id) {
    errorResponse(res, "Unauthorized: Authentication required", 401);
    return;
  }

  const normalizedRole = (req.user.role || "").toUpperCase();
  const isAdminRule = [
    "SUPER_ADMIN",
    "SOCIETY_ADMIN",
    "SUB_ADMIN",
    "COMMITTEE",
  ].includes(normalizedRole);

  if (!isAdminRule) {
    if (req.user.status === "PENDING") {
      errorResponse(
        res,
        "Your account is awaiting approval from the Society Admin",
        403
      );
      return;
    }
    if (req.user.status === "REJECTED") {
      errorResponse(
        res,
        "Your account onboarding request was rejected by the Society Admin",
        403
      );
      return;
    }
  }

  next();
};

export const isSuperAdmin = authorizeRoles("SUPER_ADMIN");
export const isSocietyAdmin = authorizeRoles("SUPER_ADMIN", "SOCIETY_ADMIN", "SUB_ADMIN");
export const isSubAdmin = authorizeRoles("SOCIETY_ADMIN", "SUB_ADMIN");
export const isAdmin = authorizeRoles("SUPER_ADMIN", "SOCIETY_ADMIN", "SUB_ADMIN");
export const isResident = authorizeRoles("RESIDENT", "SUPER_ADMIN", "SOCIETY_ADMIN", "SUB_ADMIN");
export const isGuard = authorizeRoles("GUARD", "SUPER_ADMIN", "SOCIETY_ADMIN");

