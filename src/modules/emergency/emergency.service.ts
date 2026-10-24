import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import { AuthUserPayload } from "../../types/express";
import {
  TriggerSosInput,
  UpdateIncidentStatusInput,
  EmergencyContactInput,
  EmergencyQueryInput,
} from "./emergency.validation";

export class EmergencyService {
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
   * 1. Trigger Panic / SOS Emergency Alert (ACID Transaction)
   */
  static async triggerSosAlert(user: AuthUserPayload, input: TriggerSosInput) {
    const societyId = await this.resolveSocietyId(user);

    return await prisma.$transaction(async (tx) => {
      const unit = await tx.unit.findFirst({
        where: { id: input.unitId, societyId },
        include: {
          sectionWing: true,
          members: {
            where: { approvalStatus: "APPROVED" },
            include: {
              user: {
                select: { id: true, fullName: true, phone: true },
              },
            },
          },
          familyMembers: true,
        },
      });

      if (!unit) {
        throw new AppError(404, "Target unit not found in this society.");
      }

      // If resident caller, verify tenancy rights on this unit
      if (user.role === "RESIDENT") {
        const isMember = unit.members.some((m) => m.userId === user.id);
        if (!isMember) {
          throw new AppError(
            403,
            "You can only trigger emergency SOS for your own approved unit."
          );
        }
      }

      // Generate unique incident reference code (e.g. SOS-202610-0001)
      const now = new Date();
      const yearMonth = now.toISOString().slice(0, 7).replace("-", "");
      const count = await tx.emergencyIncident.count({ where: { societyId } });
      const incidentNumber = `SOS-${yearMonth}-${String(count + 1).padStart(4, "0")}`;

      const incident = await tx.emergencyIncident.create({
        data: {
          incidentNumber,
          societyId,
          unitId: unit.id,
          reportedByUserId: user.id,
          emergencyType: input.emergencyType,
          severity: input.severity || "CRITICAL",
          status: "TRIGGERED",
          notes: input.notes?.trim() || null,
        },
        include: {
          unit: {
            select: {
              id: true,
              unitNumber: true,
              floorNumber: true,
              sectionWing: { select: { name: true } },
            },
          },
          reportedByUser: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              role: true,
            },
          },
        },
      });

      // Fetch relevant society emergency directory hotlines
      const societyHelplines = await tx.emergencyContact.findMany({
        where: { societyId, isActive: true },
        take: 5,
        orderBy: { createdAt: "asc" },
      });

      return {
        incident,
        dispatchDetails: {
          wing: unit.sectionWing.name,
          floorNumber: unit.floorNumber,
          unitNumber: unit.unitNumber,
          residentName: incident.reportedByUser.fullName,
          residentPhone: incident.reportedByUser.phone,
          unitContacts: [
            ...unit.members.map((m) => ({
              name: m.user.fullName,
              phone: m.user.phone,
              type: m.memberType,
            })),
            ...unit.familyMembers.map((f) => ({
              name: f.fullName,
              phone: f.phone,
              type: f.relation,
            })),
          ],
          societyHelplines,
        },
      };
    });
  }

  /**
   * 2. Acknowledge Active Emergency Incident (Guard / Admin)
   */
  static async acknowledgeIncident(
    user: AuthUserPayload,
    incidentId: string,
    input: UpdateIncidentStatusInput
  ) {
    const societyId = await this.resolveSocietyId(user);

    const incident = await prisma.emergencyIncident.findFirst({
      where: { id: incidentId, societyId },
    });

    if (!incident) {
      throw new AppError(404, "Emergency incident not found in this society.");
    }

    const updated = await prisma.emergencyIncident.update({
      where: { id: incident.id },
      data: {
        status: input.status,
        acknowledgedByUserId: user.id,
        acknowledgedAt: incident.acknowledgedAt || new Date(),
        responderActionTaken:
          input.responderActionTaken?.trim() || incident.responderActionTaken,
        resolutionNotes:
          input.resolutionNotes?.trim() || incident.resolutionNotes,
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            floorNumber: true,
            sectionWing: { select: { name: true } },
          },
        },
        reportedByUser: {
          select: { id: true, fullName: true, phone: true },
        },
        acknowledgedByUser: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    return updated;
  }

  /**
   * 3. Resolve Emergency Incident & Log Resolution Report (Guard / Admin)
   */
  static async resolveIncident(
    user: AuthUserPayload,
    incidentId: string,
    input: UpdateIncidentStatusInput
  ) {
    const societyId = await this.resolveSocietyId(user);

    const incident = await prisma.emergencyIncident.findFirst({
      where: { id: incidentId, societyId },
    });

    if (!incident) {
      throw new AppError(404, "Emergency incident not found in this society.");
    }

    const resolvedAt = new Date();
    const durationMinutes = Math.max(
      1,
      Math.round(
        (resolvedAt.getTime() - new Date(incident.createdAt).getTime()) / 60000
      )
    );

    const updated = await prisma.emergencyIncident.update({
      where: { id: incident.id },
      data: {
        status: input.status, // RESOLVED or FALSE_ALARM
        resolvedByUserId: user.id,
        resolvedAt,
        durationMinutes,
        resolutionNotes:
          input.resolutionNotes?.trim() ||
          "Incident inspected and verified safe by security responder.",
        responderActionTaken:
          input.responderActionTaken?.trim() || incident.responderActionTaken,
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            sectionWing: { select: { name: true } },
          },
        },
        resolvedByUser: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    return updated;
  }

  /**
   * 4. Real-Time Active Emergencies Monitor (Guard / Admin)
   */
  static async getActiveEmergencies(user: AuthUserPayload) {
    const societyId = await this.resolveSocietyId(user);

    const activeIncidents = await prisma.emergencyIncident.findMany({
      where: {
        societyId,
        status: { in: ["TRIGGERED", "ACKNOWLEDGED", "RESPONDING"] },
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            floorNumber: true,
            sectionWing: { select: { name: true } },
          },
        },
        reportedByUser: {
          select: { id: true, fullName: true, phone: true, role: true },
        },
        acknowledgedByUser: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    return {
      totalActive: activeIncidents.length,
      incidents: activeIncidents,
    };
  }

  /**
   * 5. Paginated Incident History & Post-Mortem Audit Logs
   */
  static async getIncidentHistory(
    user: AuthUserPayload,
    query: EmergencyQueryInput
  ) {
    const societyId = await this.resolveSocietyId(user);

    const where: Prisma.EmergencyIncidentWhereInput = { societyId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.emergencyType) {
      where.emergencyType = query.emergencyType;
    }

    if (query.unitId) {
      where.unitId = query.unitId;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;

    const totalRecords = await prisma.emergencyIncident.count({ where });

    const incidents = await prisma.emergencyIncident.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            floorNumber: true,
            sectionWing: { select: { name: true } },
          },
        },
        reportedByUser: {
          select: { id: true, fullName: true, phone: true, role: true },
        },
        acknowledgedByUser: {
          select: { id: true, fullName: true, role: true },
        },
        resolvedByUser: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    return {
      incidents,
      pagination: {
        totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit),
      },
    };
  }

  /**
   * 6. Register Essential Emergency Contact / Statutory Helpline (Admin)
   */
  static async createEmergencyContact(
    user: AuthUserPayload,
    input: EmergencyContactInput
  ) {
    const societyId = await this.resolveSocietyId(user);

    const contact = await prisma.emergencyContact.create({
      data: {
        societyId,
        serviceName: input.serviceName.trim(),
        category: input.category,
        phone: input.phone.trim(),
        alternatePhone: input.alternatePhone?.trim() || null,
        address: input.address?.trim() || null,
        contactPerson: input.contactPerson?.trim() || null,
        isActive: true,
      },
    });

    return contact;
  }

  /**
   * 7. Query Society Emergency Directory & Helplines (Public / Resident)
   */
  static async getEmergencyDirectory(
    user: AuthUserPayload,
    category?: string
  ) {
    const societyId = await this.resolveSocietyId(user);

    const where: Prisma.EmergencyContactWhereInput = {
      societyId,
      isActive: true,
    };

    if (category) {
      where.category = category;
    }

    const contacts = await prisma.emergencyContact.findMany({
      where,
      orderBy: [{ category: "asc" }, { serviceName: "asc" }],
    });

    return {
      totalContacts: contacts.length,
      contacts,
    };
  }
}
