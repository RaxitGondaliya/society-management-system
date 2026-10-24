import { Response } from "express";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export interface ApiResponseData<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: unknown;
}

export const successResponse = <T>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = 200
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...(data !== undefined ? { data } : {}),
  });
};

export const errorResponse = (
  res: Response,
  message: string,
  statusCode: number = 400,
  error?: unknown
): Response => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(error !== undefined ? { error } : {}),
  });
};
