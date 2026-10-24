import { Router } from "express";
import { DocumentController } from "./document.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  uploadDocumentSchema,
  documentQuerySchema,
  documentIdParamSchema,
} from "./document.validation";

const router = Router();

// 1. Upload / register document metadata record
router.post(
  "/",
  authenticate,
  validate({ body: uploadDocumentSchema }),
  DocumentController.uploadDoc
);

// 2. Fetch accessible documents feed
router.get(
  "/",
  authenticate,
  validate({ query: documentQuerySchema }),
  DocumentController.listDocs
);

// 3. Query compliance expiry dashboard (NOCs, Insurances) - Placed before :documentId
router.get(
  "/expiring-alerts",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  DocumentController.getExpiringAlerts
);

// 4. Retrieve specific document detail
router.get(
  "/:documentId",
  authenticate,
  validate({ params: documentIdParamSchema }),
  DocumentController.getDocById
);

// 5. Archive / soft-delete document
router.delete(
  "/:documentId",
  authenticate,
  validate({ params: documentIdParamSchema }),
  DocumentController.deleteDoc
);

export default router;
