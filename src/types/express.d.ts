export interface AuthUserPayload {
  id: string;
  phone: string;
  email?: string | null;
  role: string;
  societyId?: string;
  unitId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}
