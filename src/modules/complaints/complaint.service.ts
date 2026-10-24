import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import { AuthUserPayload } from "../../types/express";
import {
  CreateComplaintInput,
  UpdateComplaintStatusInput,
  ComplaintFeedbackInput,
  ComplaintQueryInput,
} from "./complaint.validation";

// Priority SLA definitions in hours
const PRIORITY_SLA_HOURS: Record<string, number> = {
  URGENT: 12,
  HIGH: 24,
  MEDIUM: 48,
  LOW: 72,
};

interface SlaMetrics {
  timeOpenHours: number;
  slaLimitHours: number;
  isOverdue: boolean;
}

const computeSlaMetrics = (
  createdAt: Date,
  resolvedAt: Date | null,
  priority: string,
  status: string
): SlaMetrics => {
  const endTime = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const startTime = new Date(createdAt).getTime();
  const timeOpenHours = Math.max(0, Math.round(((endTime - startTime) / (1000 * 60 * 60)) * 10) / 10);
  const slaLimitHours = PRIORITY_SLA_HOURS[priority] || 48;
  const isOverdue = status !== "RESOLVED" && status !== "CLOSED" && status !== "REJECTED" && timeOpenHours > slaLimitHours;

  return {
    timeOpenHours,
    slaLimitHours,
    isOverdue,
  };
};

export class ComplaintService {
  /**
   * Resolve societyId for caller
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
      throw new AppError(404, "No society found in system");
    }
    return society.id;
  }

  /**
   * 1. Lodge Complaint / Raise Helpdesk Ticket
   */
  static async lodgeComplaint(user: AuthUserPayload, input: CreateComplaintInput) {
    const societyId = await this.resolveSocietyId(user);

    // If scope is PERSONAL, validate unit exists and caller is authorized
    if (input.scope === "PERSONAL") {
      if (!input.unitId) {
        throw new AppError(400, "unitId is required for personal unit complaints.");
      }

      const unit = await prisma.unit.findUnique({
        where: { id: input.unitId },
      });

      if (!unit || unit.societyId !== societyId) {
        throw new AppError(404, "Target unit not found in this society.");
      }

      if (user.role === "RESIDENT") {
        const isMember = await prisma.unitMember.findFirst({
          where: {
            unitId: input.unitId,
            userId: user.id,
            approvalStatus: "APPROVED",
          },
        });

        if (!isMember) {
          throw new AppError(403, "You can only raise personal complaints for your own unit.");
        }
      }
    }

    // Duplicate Prevention for Community Issues (elevators, water pumps, etc.)
    let activeExistingIssue: { ticketNumber: string | null; title: string; createdAt: Date } | null = null;
    if (input.scope === "COMMUNITY") {
      const existing = await prisma.complaint.findFirst({
        where: {
          societyId,
          scope: "COMMUNITY",
          category: input.category,
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
        select: {
          ticketNumber: true,
          title: true,
          createdAt: true,
        },
      });

      if (existing) {
        activeExistingIssue = existing;
      }
    }

    // Generate unique Ticket ID: TKT-YYYYMM-XXXX
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const totalComplaintsInMonth = await prisma.complaint.count({
      where: {
        societyId,
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
        },
      },
    });

    const sequenceNum = String(totalComplaintsInMonth + 1).padStart(4, "0");
    const randomSuffix = Math.floor(100 + Math.random() * 900); // 3-digit salt
    const ticketNumber = `TKT-${yearMonth}-${sequenceNum}-${randomSuffix}`;

    const photoUrl =
      input.photoUrl || (input.images && input.images.length > 0 ? input.images[0] : null);

    const complaint = await prisma.complaint.create({
      data: {
        ticketNumber,
        societyId,
        unitId: input.unitId || null,
        raisedByUserId: user.id,
        scope: input.scope,
        category: input.category,
        priority: input.priority || "MEDIUM",
        title: input.title,
        description: input.description,
        photoUrl,
        status: "OPEN",
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            sectionWing: { select: { id: true, name: true } },
          },
        },
        raisedByUser: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    const sla = computeSlaMetrics(complaint.createdAt, complaint.resolvedAt, complaint.priority, complaint.status);

    return {
      complaint: {
        ...complaint,
        sla,
      },
      duplicateWarning: activeExistingIssue
        ? {
            notice: "A common issue in this category is already active in your society.",
            activeTicketNumber: activeExistingIssue.ticketNumber,
            activeTitle: activeExistingIssue.title,
          }
        : null,
    };
  }

  /**
   * 2. Update Ticket Status & Assign Staff
   */
  static async updateTicketStatus(
    user: AuthUserPayload,
    ticketId: string,
    input: UpdateComplaintStatusInput
  ) {
    const societyId = await this.resolveSocietyId(user);

    const complaint = await prisma.complaint.findFirst({
      where: {
        OR: [{ id: ticketId }, { ticketNumber: ticketId }],
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            sectionWing: { select: { id: true, name: true } },
          },
        },
        raisedByUser: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    if (!complaint) {
      throw new AppError(404, "Complaint ticket not found.");
    }

    if (complaint.societyId !== societyId && user.role !== "SUPER_ADMIN") {
      throw new AppError(403, "Unauthorized access to ticket outside your society.");
    }

    // Validate staff user if assigned
    if (input.assignedToStaffId) {
      const staffUser = await prisma.user.findUnique({
        where: { id: input.assignedToStaffId },
      });
      if (!staffUser) {
        throw new AppError(404, "Assigned staff user was not found.");
      }
    }

    const isMarkingResolved = input.status === "RESOLVED" && complaint.status !== "RESOLVED";
    const resolvedAt = isMarkingResolved ? new Date() : complaint.resolvedAt;

    const updatedComplaint = await prisma.complaint.update({
      where: { id: complaint.id },
      data: {
        status: input.status,
        assignedStaffId: input.assignedToStaffId !== undefined ? input.assignedToStaffId : complaint.assignedStaffId,
        resolutionNotes: input.resolutionNotes !== undefined ? input.resolutionNotes : complaint.resolutionNotes,
        resolutionProofUrl: input.resolutionProofUrl !== undefined ? input.resolutionProofUrl : complaint.resolutionProofUrl,
        resolvedAt,
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            sectionWing: { select: { id: true, name: true } },
          },
        },
        raisedByUser: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        assignedStaff: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    const sla = computeSlaMetrics(
      updatedComplaint.createdAt,
      updatedComplaint.resolvedAt,
      updatedComplaint.priority,
      updatedComplaint.status
    );

    return {
      ...updatedComplaint,
      sla,
    };
  }

  /**
   * 3. Submit Feedback & Rating (Auto-closes ticket)
   */
  static async addFeedback(
    user: AuthUserPayload,
    ticketId: string,
    input: ComplaintFeedbackInput
  ) {
    const complaint = await prisma.complaint.findFirst({
      where: {
        OR: [{ id: ticketId }, { ticketNumber: ticketId }],
      },
      include: {
        unit: true,
      },
    });

    if (!complaint) {
      throw new AppError(404, "Complaint ticket not found.");
    }

    // Check authorization: must be complainant or resident of unit, or admin
    if (user.role === "RESIDENT") {
      let isAuthorized = complaint.raisedByUserId === user.id;

      if (!isAuthorized && complaint.unitId) {
        const member = await prisma.unitMember.findFirst({
          where: {
            unitId: complaint.unitId,
            userId: user.id,
            approvalStatus: "APPROVED",
          },
        });
        if (member) isAuthorized = true;
      }

      if (!isAuthorized) {
        throw new AppError(403, "Only the complainant or unit resident can provide feedback on this ticket.");
      }
    }

    // Validate that ticket has been resolved or closed
    if (complaint.status !== "RESOLVED" && complaint.status !== "CLOSED") {
      throw new AppError(
        400,
        `Feedback can only be submitted for resolved or closed tickets (current status: ${complaint.status}).`
      );
    }

    const updated = await prisma.complaint.update({
      where: { id: complaint.id },
      data: {
        rating: input.rating,
        feedback: input.feedback || null,
        status: "CLOSED", // Auto-transitions to CLOSED on resident confirmation
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            sectionWing: { select: { id: true, name: true } },
          },
        },
        assignedStaff: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * 4. Get My Complaints (Resident view)
   */
  static async getMyComplaints(user: AuthUserPayload) {
    // Find all units the user belongs to
    const memberships = await prisma.unitMember.findMany({
      where: { userId: user.id, approvalStatus: "APPROVED" },
      select: { unitId: true },
    });
    const userUnitIds = memberships.map((m) => m.unitId);

    const complaints = await prisma.complaint.findMany({
      where: {
        OR: [
          { raisedByUserId: user.id },
          ...(userUnitIds.length > 0 ? [{ unitId: { in: userUnitIds } }] : []),
        ],
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            sectionWing: { select: { id: true, name: true } },
          },
        },
        assignedStaff: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return complaints.map((c) => {
      const sla = computeSlaMetrics(c.createdAt, c.resolvedAt, c.priority, c.status);
      return {
        ...c,
        sla,
      };
    });
  }

  /**
   * 5. List Society Complaints with Multi-Filter & SLA Tracking (Admin view)
   */
  static async listSocietyComplaints(user: AuthUserPayload, query: ComplaintQueryInput) {
    const societyId = await this.resolveSocietyId(user);
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      societyId,
    };

    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.priority) where.priority = query.priority;
    if (query.scope) where.scope = query.scope;
    if (query.unitId) where.unitId = query.unitId;
    if (query.assignedTo) where.assignedStaffId = query.assignedTo;

    if (query.startDate || query.endDate) {
      const createdAtFilter: { gte?: Date; lte?: Date } = {};
      if (query.startDate) createdAtFilter.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        createdAtFilter.lte = end;
      }
      where.createdAt = createdAtFilter;
    }

    const [total, complaints] = await Promise.all([
      prisma.complaint.count({ where }),
      prisma.complaint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          unit: {
            select: {
              id: true,
              unitNumber: true,
              sectionWing: { select: { id: true, name: true } },
            },
          },
          raisedByUser: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              role: true,
            },
          },
          assignedStaff: {
            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
        },
      }),
    ]);

    const formattedComplaints = complaints.map((c) => {
      const sla = computeSlaMetrics(c.createdAt, c.resolvedAt, c.priority, c.status);
      return {
        ...c,
        sla,
      };
    });

    const overdueCount = formattedComplaints.filter((c) => c.sla.isOverdue).length;

    return {
      complaints: formattedComplaints,
      metrics: {
        totalRecords: total,
        overdueCount,
      },
      pagination: {
        totalRecords: total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 6. Get Complaint Details by ID or Ticket Number
   */
  static async getComplaintDetails(user: AuthUserPayload, ticketId: string) {
    const complaint = await prisma.complaint.findFirst({
      where: {
        OR: [{ id: ticketId }, { ticketNumber: ticketId }],
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            floorNumber: true,
            sectionWing: { select: { id: true, name: true } },
          },
        },
        raisedByUser: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            role: true,
          },
        },
        assignedStaff: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    if (!complaint) {
      throw new AppError(404, "Complaint ticket not found.");
    }

    // Role security check
    if (user.role === "RESIDENT") {
      let isAuthorized = complaint.raisedByUserId === user.id;

      if (!isAuthorized && complaint.unitId) {
        const member = await prisma.unitMember.findFirst({
          where: {
            unitId: complaint.unitId,
            userId: user.id,
            approvalStatus: "APPROVED",
          },
        });
        if (member) isAuthorized = true;
      }

      // Allow residents to view community scope issues
      if (complaint.scope === "COMMUNITY") {
        isAuthorized = true;
      }

      if (!isAuthorized) {
        throw new AppError(403, "Unauthorized access to this ticket.");
      }
    }

    const sla = computeSlaMetrics(
      complaint.createdAt,
      complaint.resolvedAt,
      complaint.priority,
      complaint.status
    );

    return {
      ...complaint,
      sla,
    };
  }
}
