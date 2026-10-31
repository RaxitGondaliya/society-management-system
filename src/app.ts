import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import { apiLimiter, authLimiter } from "./middleware/rateLimiter.middleware";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware";

// Route Imports
import healthRoutes from "./modules/health/health.routes";
import { HealthController } from "./modules/health/health.controller";
import societyRoutes from "./modules/societies/society.routes";
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/user.routes";
import adminRoutes from "./modules/admin/admin.routes";
import billingRoutes from "./modules/billing/billing.routes";
import visitorRoutes from "./modules/visitors/visitor.routes";
import complaintRoutes from "./modules/complaints/complaint.routes";
import amenityRoutes from "./modules/amenities/amenity.routes";
import noticeRoutes from "./modules/notices/notice.routes";
import staffRoutes from "./modules/staff/staff.routes";
import assetRoutes from "./modules/assets/asset.routes";
import parkingRoutes from "./modules/parking/parking.routes";
import documentRoutes from "./modules/documents/document.routes";
import emergencyRoutes from "./modules/emergency/emergency.routes";

const app: Application = express();

// Enable Express trust proxy for cloud deployment (e.g. Render, AWS behind reverse proxy)
app.set("trust proxy", 1);

// 1. Enterprise Security Headers (Helmet)
app.use(helmet());

// 2. Cross-Origin Resource Sharing (CORS) Policy
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// 3. Request Payload Size Limits (Mitigates payload memory starvation)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 4. Rate Limiting (DDoS & Brute-Force Mitigation)
app.use("/api", apiLimiter);
app.use("/api/v1/auth", authLimiter);

// 5. System Health Endpoints
app.get("/api/health", HealthController.getHealth);
app.use("/api/v1", healthRoutes);

// 6. Business Modules (Modules 1 through 11)
app.use("/api/v1/societies", societyRoutes);
app.use("/api/societies", societyRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/users", userRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/v1/billing", billingRoutes);
app.use("/api/v1/visitors", visitorRoutes);
app.use("/api/v1/complaints", complaintRoutes);
app.use("/api/v1/amenities", amenityRoutes);
app.use("/api/v1/notices", noticeRoutes);
app.use("/api/v1/staff", staffRoutes);
app.use("/api/v1/assets", assetRoutes);
app.use("/api/v1/parking", parkingRoutes);
app.use("/api/v1/documents", documentRoutes);
app.use("/api/v1/emergency", emergencyRoutes);

// 7. Centralized 404 Route Handler
app.use(notFoundHandler);

// 8. Global Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
