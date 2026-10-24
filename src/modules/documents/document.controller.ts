import { Request, Response, NextFunction } from "express";
import { DocumentService } from "./document.service";
import { successResponse } from "../../utils/apiResponse";

export class DocumentController {
  /**
   * POST /documents
   * Upload / register document metadata record
   */
  static async uploadDoc(req: Request, res: Response, next: NextFunction) {
    try {
      const document = await DocumentService.uploadDocumentRecord(
        req.user!,
        req.body
      );
      return successResponse(
        res,
        "Document uploaded and registered successfully.",
        document,
        201
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /documents
   * Fetch accessible documents feed
   */
  static async listDocs(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DocumentService.listAccessibleDocuments(
        req.user!,
        req.query as any
      );
      return successResponse(
        res,
        "Documents retrieved successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /documents/expiring-alerts
   * Query compliance expiry dashboard (NOCs, Insurances, AMCs)
   */
  static async getExpiringAlerts(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const alerts = await DocumentService.getExpiringDocumentsAlert(req.user!);
      return successResponse(
        res,
        "Expiring compliance documents retrieved successfully.",
        alerts,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /documents/:documentId
   * Retrieve specific document detail
   */
  static async getDocById(req: Request, res: Response, next: NextFunction) {
    try {
      const documentId = req.params.documentId as string;
      const document = await DocumentService.getDocumentDetails(
        req.user!,
        documentId
      );
      return successResponse(
        res,
        "Document details retrieved successfully.",
        document,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * DELETE /documents/:documentId
   * Archive / remove document
   */
  static async deleteDoc(req: Request, res: Response, next: NextFunction) {
    try {
      const documentId = req.params.documentId as string;
      const result = await DocumentService.archiveOrDeleteDocument(
        req.user!,
        documentId
      );
      return successResponse(res, result.message, result, 200);
    } catch (error) {
      return next(error);
    }
  }
}
