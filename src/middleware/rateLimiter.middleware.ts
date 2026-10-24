import rateLimit from "express-rate-limit";
import { errorResponse } from "../utils/apiResponse";

/**
 * General API Rate Limiter
 * Applied across all API routes to mitigate high-frequency scanning and DDoS attacks.
 * Window: 15 minutes | Max: 300 requests per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    errorResponse(
      res,
      "Too many requests from this IP address. Please try again after 15 minutes.",
      429
    );
  },
});

/**
 * Strict Rate Limiter for Authentication & Security-Critical Endpoints
 * Prevents brute-force phone/OTP credential stuffing.
 * Window: 15 minutes | Max: 30 requests per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    errorResponse(
      res,
      "Too many authentication attempts from this IP address. Please try again after 15 minutes.",
      429
    );
  },
});
