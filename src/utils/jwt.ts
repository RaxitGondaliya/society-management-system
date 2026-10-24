import jwt, { SignOptions } from "jsonwebtoken";
import { AuthUserPayload } from "../types/express";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_society_key_123";
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];

export const generateToken = (payload: AuthUserPayload): string => {
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN,
  };
  return jwt.sign(payload, JWT_SECRET, options);
};

export const verifyToken = (token: string): AuthUserPayload => {
  return jwt.verify(token, JWT_SECRET) as AuthUserPayload;
};
