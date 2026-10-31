export type UserRole =
  | "SUPER_ADMIN"
  | "SOCIETY_ADMIN"
  | "SUB_ADMIN"
  | "RESIDENT"
  | "GUARD"
  | string;

export type UserApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | string;

export type UserResidentType = "OWNER" | "TENANT" | string;

export interface AuthUserPayload {
  id: string;
  phone: string;
  email?: string | null;
  fullName?: string;
  role: UserRole;
  status?: UserApprovalStatus;
  residentType?: UserResidentType | null;
  societyId?: string;
  unitId?: string;
  avatarUrl?: string | null;
  emergencyContact?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}
