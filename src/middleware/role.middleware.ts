import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/apiResponse";

export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      errorResponse(res, "Unauthorized: Authentication required", 401);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      errorResponse(
        res,
        `Forbidden: Role '${req.user.role}' is not authorized to access this resource`,
        403
      );
      return;
    }

    next();
  };
};

export const isSuperAdmin = authorizeRoles("SUPER_ADMIN");
export const isSubAdmin = authorizeRoles("SUB_ADMIN");
export const isAdmin = authorizeRoles("SUPER_ADMIN", "SUB_ADMIN");
export const isResident = authorizeRoles("RESIDENT", "SUPER_ADMIN", "SUB_ADMIN");
export const isGuard = authorizeRoles("GUARD", "SUPER_ADMIN");
