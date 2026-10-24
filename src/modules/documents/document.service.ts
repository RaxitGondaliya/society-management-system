import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import { AuthUserPayload } from "../../types/express";
import {
  UploadDocumentInput,
  DocumentQueryInput,
} from "./document.validation";

export class DocumentService {
  /**
   * Helper to resolve societyId for caller
   */
  private static async resolveSocietyId(user: AuthUserPayload): Promise<string> {
    if (user.societyId) {
      return user.societyId;
    }

    const membership = await prisma.unitMember.findFirst({
      where: { userId: user.id, approvalStatus: "APPROVED" },
      include: { unit: true },
    });

    if (membership?.unit?.societyId) {
      return membership.unit.societyId;
    }

    const society = await prisma.society.findFirst();
    if (!society) {
      throw new AppError(404, "No society found in the system");
    }
    return society.id;
  }

  /**
   * 1. Upload / Record Document Metadata
   */
  static async uploadDocumentRecord(
    user: AuthUserPayload,
    input: UploadDocumentInput
  ) {
    const societyId = await this.resolveSocietyId(user);

    // Permission checks based on access level
    if (input.accessLevel === "ADMIN_ONLY") {
      if (user.role !== "SUPER_ADMIN" && user.role !== "SUB_ADMIN") {
        throw new AppError(
          403,
          "Only society administrators can upload 'ADMIN_ONLY' documents."
        );
      }
    }

    if (input.accessLevel === "UNIT_PRIVATE") {
      if (!input.unitId) {
        throw new AppError(
          400,
          "unitId is required when accessLevel is 'UNIT_PRIVATE'."
        );
      }

      const unit = await prisma.unit.findFirst({
        where: { id: input.unitId, societyId },
      });

      if (!unit) {
        throw new AppError(404, "Target unit not found in this society.");
      }

      // If caller is resident, verify they belong to this unit
      if (user.role === "RESIDENT") {
        const membership = await prisma.unitMember.findFirst({
          where: {
            userId: user.id,
            unitId: input.unitId,
            approvalStatus: "APPROVED",
          },
        });

        if (!membership) {
          throw new AppError(
            403,
            "You can only upload private documents for your own approved unit."
          );
        }
      }
    }

    const document = await prisma.societyDocument.create({
      data: {
        societyId,
        title: input.title.trim(),
        documentType: input.documentType,
        accessLevel: input.accessLevel,
        fileUrl: input.fileUrl.trim(),
        fileSizeBytes: input.fileSizeBytes ?? null,
        mimeType: input.mimeType?.trim() || null,
        unitId: input.unitId || null,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        description: input.description?.trim() || null,
        tags: input.tags || [],
        uploadedByUserId: user.id,
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            sectionWing: { select: { name: true } },
          },
        },
        uploadedByUser: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    return document;
  }

  /**
   * 2. List Accessible Documents with Scoped Privacy
   */
  static async listAccessibleDocuments(
    user: AuthUserPayload,
    query: DocumentQueryInput
  ) {
    const societyId = await this.resolveSocietyId(user);

    const where: Prisma.SocietyDocumentWhereInput = {
      societyId,
      isArchived: false,
    };

    // Role-based visibility scoping
    if (user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN") {
      if (query.accessLevel) {
        where.accessLevel = query.accessLevel;
      }
      if (query.unitId) {
        where.unitId = query.unitId;
      }
    } else if (user.role === "RESIDENT") {
      // Find all approved units for this resident
      const userMemberships = await prisma.unitMember.findMany({
        where: { userId: user.id, approvalStatus: "APPROVED" },
        select: { unitId: true },
      });
      const approvedUnitIds = userMemberships.map((m) => m.unitId);

      if (query.accessLevel === "ADMIN_ONLY") {
        throw new AppError(
          403,
          "Residents cannot view or query 'ADMIN_ONLY' documents."
        );
      } else if (query.accessLevel === "UNIT_PRIVATE") {
        where.accessLevel = "UNIT_PRIVATE";
        if (query.unitId) {
          if (!approvedUnitIds.includes(query.unitId)) {
            throw new AppError(
              403,
              "You cannot view private documents of a flat you do not belong to."
            );
          }
          where.unitId = query.unitId;
        } else {
          where.unitId = { in: approvedUnitIds };
        }
      } else if (query.accessLevel === "PUBLIC_RESIDENTS") {
        where.accessLevel = "PUBLIC_RESIDENTS";
      } else {
        // Default resident view: Public documents OR private documents of their own units
        where.OR = [
          { accessLevel: "PUBLIC_RESIDENTS" },
          { accessLevel: "UNIT_PRIVATE", unitId: { in: approvedUnitIds } },
        ];
      }
    } else {
      // Other roles (e.g. Guard): Public only
      where.accessLevel = "PUBLIC_RESIDENTS";
    }

    if (query.documentType) {
      where.documentType = query.documentType;
    }

    const now = new Date();
    if (query.expiringSoon) {
      const sixtyDaysAhead = new Date(
        now.getTime() + 60 * 24 * 60 * 60 * 1000
      );
      where.expiryDate = {
        gte: now,
        lte: sixtyDaysAhead,
      };
    }

    if (query.search && query.search.trim() !== "") {
      const term = query.search.trim();
      where.AND = [
        {
          OR: [
            { title: { contains: term, mode: "insensitive" } },
            { description: { contains: term, mode: "insensitive" } },
            { tags: { has: term } },
          ],
        },
      ];
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;

    const totalRecords = await prisma.societyDocument.count({ where });

    const documents = await prisma.societyDocument.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            sectionWing: { select: { name: true } },
          },
        },
        uploadedByUser: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    return {
      documents,
      pagination: {
        totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit),
      },
    };
  }

  /**
   * 3. Get Document Details & Permission Validation
   */
  static async getDocumentDetails(
    user: AuthUserPayload,
    documentId: string
  ) {
    const societyId = await this.resolveSocietyId(user);

    const document = await prisma.societyDocument.findFirst({
      where: {
        id: documentId,
        societyId,
        isArchived: false,
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            sectionWing: { select: { name: true } },
          },
        },
        uploadedByUser: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    if (!document) {
      throw new AppError(404, "Document not found in this society.");
    }

    // Enforce privacy restrictions
    if (document.accessLevel === "ADMIN_ONLY") {
      if (user.role !== "SUPER_ADMIN" && user.role !== "SUB_ADMIN") {
        throw new AppError(
          403,
          "You do not have permission to access this administrator document."
        );
      }
    }

    if (document.accessLevel === "UNIT_PRIVATE") {
      if (user.role !== "SUPER_ADMIN" && user.role !== "SUB_ADMIN") {
        const membership = await prisma.unitMember.findFirst({
          where: {
            userId: user.id,
            unitId: document.unitId!,
            approvalStatus: "APPROVED",
          },
        });

        if (!membership) {
          throw new AppError(
            403,
            "You do not have permission to access this private unit document."
          );
        }
      }
    }

    return document;
  }

  /**
   * 4. Query Expiring Documents Alerts (NOCs, Insurances, AMCs)
   */
  static async getExpiringDocumentsAlert(user: AuthUserPayload) {
    const societyId = await this.resolveSocietyId(user);

    const now = new Date();
    const sixtyDaysAhead = new Date(
      now.getTime() + 60 * 24 * 60 * 60 * 1000
    );

    const expiringDocs = await prisma.societyDocument.findMany({
      where: {
        societyId,
        isArchived: false,
        expiryDate: {
          lte: sixtyDaysAhead,
        },
      },
      orderBy: { expiryDate: "asc" },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            sectionWing: { select: { name: true } },
          },
        },
        uploadedByUser: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    const formatDaysRemaining = (targetDate: Date) => {
      const diff = new Date(targetDate).getTime() - now.getTime();
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    const alerts = expiringDocs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      documentType: doc.documentType,
      accessLevel: doc.accessLevel,
      expiryDate: doc.expiryDate,
      isExpired: new Date(doc.expiryDate!) < now,
      daysRemaining: formatDaysRemaining(doc.expiryDate!),
      fileUrl: doc.fileUrl,
      unit: doc.unit,
      uploadedBy: doc.uploadedByUser,
    }));

    return {
      totalAlerts: alerts.length,
      alerts,
    };
  }

  /**
   * 5. Archive / Soft Delete Document
   */
  static async archiveOrDeleteDocument(
    user: AuthUserPayload,
    documentId: string
  ) {
    const societyId = await this.resolveSocietyId(user);

    const doc = await prisma.societyDocument.findFirst({
      where: { id: documentId, societyId, isArchived: false },
    });

    if (!doc) {
      throw new AppError(404, "Document not found in this society.");
    }

    // Permission enforcement:
    // Residents can only delete their own uploads
    if (user.role === "RESIDENT") {
      if (doc.uploadedByUserId !== user.id) {
        throw new AppError(
          403,
          "You can only archive or delete documents uploaded by your account."
        );
      }
    }

    const archived = await prisma.societyDocument.update({
      where: { id: doc.id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
    });

    return {
      message: `Document '${doc.title}' archived successfully.`,
      documentId: archived.id,
    };
  }
}
