import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/apiResponse";
import { AuthUserPayload } from "../../types/express";
import {
  CreateNoticeInput,
  CreatePollInput,
  CastVoteInput,
  NoticeQueryInput,
} from "./notice.validation";

export class NoticeService {
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
      throw new AppError(404, "No society found in system");
    }
    return society.id;
  }

  /**
   * 1. Publish Notice / Announcement (Admin only)
   */
  static async publishNotice(user: AuthUserPayload, input: CreateNoticeInput) {
    const societyId = await this.resolveSocietyId(user);

    const targetWingsJson =
      input.targetWings && input.targetWings.length > 0
        ? JSON.stringify(input.targetWings)
        : null;

    const attachmentsJson =
      input.attachments && input.attachments.length > 0
        ? JSON.stringify(input.attachments)
        : null;

    const attachmentUrl =
      input.attachments && input.attachments.length > 0 ? input.attachments[0] : null;

    const targetAudience =
      input.targetWings && input.targetWings.length > 0 ? "SECTION_SPECIFIC" : "ALL";

    const notice = await prisma.notice.create({
      data: {
        societyId,
        title: input.title,
        content: input.content,
        category: input.category,
        priority: input.priority,
        targetAudience,
        targetWings: targetWingsJson,
        attachmentUrl,
        attachments: attachmentsJson,
        expiresAt: input.expiryDate ? new Date(`${input.expiryDate}T23:59:59.999Z`) : null,
        publishedByUserId: user.id,
        isActive: true,
      },
    });

    const isEmergency = notice.priority === "EMERGENCY" || notice.priority === "URGENT";

    return {
      ...notice,
      targetWings: notice.targetWings ? JSON.parse(notice.targetWings) : [],
      attachments: notice.attachments ? JSON.parse(notice.attachments) : [],
      isEmergency,
      isPinned: isEmergency,
    };
  }

  /**
   * 2. List Notices Feed (Filtered by active status, category & wing)
   */
  static async listNotices(user: AuthUserPayload, query: NoticeQueryInput) {
    const societyId = await this.resolveSocietyId(user);
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    // Discover user's wings if resident
    let residentWingNames: string[] = [];
    if (user.role === "RESIDENT") {
      const units = await prisma.unitMember.findMany({
        where: { userId: user.id, approvalStatus: "APPROVED" },
        include: { unit: { include: { sectionWing: true } } },
      });
      residentWingNames = units
        .map((u) => u.unit?.sectionWing?.name)
        .filter((w): w is string => !!w);
    }

    const where: Record<string, unknown> = {
      societyId,
      isActive: true,
    };

    if (query.activeOnly) {
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ];
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    const [total, rawNotices] = await Promise.all([
      prisma.notice.count({ where }),
      prisma.notice.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      }),
    ]);

    // Filter by wing if resident
    const filtered = rawNotices.filter((n) => {
      if (user.role !== "RESIDENT" || n.targetAudience === "ALL" || !n.targetWings) {
        return true;
      }
      try {
        const targetWings: string[] = JSON.parse(n.targetWings);
        return targetWings.some((tw) => residentWingNames.includes(tw));
      } catch {
        return true;
      }
    });

    const formattedNotices = filtered.map((n) => {
      const isEmergency = n.priority === "EMERGENCY" || n.priority === "URGENT";
      return {
        ...n,
        targetWings: n.targetWings ? JSON.parse(n.targetWings) : [],
        attachments: n.attachments ? JSON.parse(n.attachments) : [],
        isEmergency,
        isPinned: isEmergency,
      };
    });

    return {
      notices: formattedNotices,
      pagination: {
        totalRecords: total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 3. Delete / Unpublish Notice (Admin only)
   */
  static async deleteNotice(user: AuthUserPayload, noticeId: string) {
    const notice = await prisma.notice.findUnique({
      where: { id: noticeId },
    });

    if (!notice) {
      throw new AppError(404, "Notice not found.");
    }

    if (notice.societyId !== user.societyId && user.role !== "SUPER_ADMIN") {
      throw new AppError(403, "Unauthorized to delete notice outside your society.");
    }

    await prisma.notice.update({
      where: { id: noticeId },
      data: { isActive: false },
    });

    return {
      id: noticeId,
      message: "Notice unpublished successfully.",
    };
  }

  /**
   * 4. Create Community Poll (Admin only)
   */
  static async createCommunityPoll(user: AuthUserPayload, input: CreatePollInput) {
    const societyId = await this.resolveSocietyId(user);

    const startDate = input.startDate ? new Date(input.startDate) : new Date();
    const endDate = new Date(input.endDate);
    const pollPrivacyType = input.isSecret ? "ANONYMOUS_SECRET_BALLOT" : "PUBLIC_TRANSPARENT";

    const poll = await prisma.poll.create({
      data: {
        societyId,
        question: input.question,
        description: input.description || null,
        pollPrivacyType,
        isSecret: input.isSecret,
        votingScope: input.votingScope,
        startDate,
        endDate,
        cutoffTimestamp: endDate,
        status: "ACTIVE",
        options: {
          create: input.options.map((optionText) => ({
            optionText,
            voteCount: 0,
          })),
        },
      },
      include: {
        options: {
          select: {
            id: true,
            optionText: true,
            voteCount: true,
          },
        },
      },
    });

    return {
      ...poll,
      totalVotes: 0,
      remainingHours: Math.max(0, Math.round(((endDate.getTime() - Date.now()) / 3600000) * 10) / 10),
    };
  }

  /**
   * 5. Cast Vote on a Community Poll (ACID Transaction with Anti-Duplicate Protection)
   */
  static async castVote(user: AuthUserPayload, pollId: string, input: CastVoteInput) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch Poll
      const poll = await tx.poll.findUnique({
        where: { id: pollId },
        include: { options: true },
      });

      if (!poll) {
        throw new AppError(404, "Community poll not found.");
      }

      // 2. Validate Active Window
      const now = new Date();
      if (now < poll.startDate) {
        throw new AppError(400, "Voting for this poll has not opened yet.");
      }
      if (now > poll.cutoffTimestamp || poll.status === "CLOSED") {
        throw new AppError(400, "Voting for this poll is closed.");
      }

      // 3. Verify Unit & Resident Access
      const member = await tx.unitMember.findFirst({
        where: {
          unitId: input.unitId,
          userId: user.id,
          approvalStatus: "APPROVED",
        },
      });

      if (!member && user.role === "RESIDENT") {
        throw new AppError(403, "You can only cast a ballot on behalf of your own registered flat.");
      }

      // 4. Strict Anti-Duplicate Voting Protection
      if (poll.votingScope === "ONE_VOTE_PER_UNIT") {
        const existingUnitVote = await tx.pollVote.findFirst({
          where: { pollId: poll.id, unitId: input.unitId },
        });

        if (existingUnitVote) {
          throw new AppError(409, "Your flat has already participated in this poll.");
        }
      } else {
        const existingMemberVote = await tx.pollVote.findFirst({
          where: { pollId: poll.id, votedByUserId: user.id },
        });

        if (existingMemberVote) {
          throw new AppError(409, "You have already cast your ballot in this poll.");
        }
      }

      // 5. Resolve Selected Option
      let selectedOption = poll.options.find((opt) => opt.id === input.pollOptionId);
      if (!selectedOption && input.optionIndex !== undefined) {
        selectedOption = poll.options[input.optionIndex];
      }

      if (!selectedOption) {
        throw new AppError(404, "The selected poll option is invalid or was not found.");
      }

      // 6. Record Ballot (Mask voter identity if secret)
      await tx.pollVote.create({
        data: {
          pollId: poll.id,
          unitId: input.unitId,
          pollOptionId: selectedOption.id,
          votedByUserId: poll.isSecret ? null : user.id,
        },
      });

      // 7. Atomically increment option counter
      const updatedOption = await tx.pollOption.update({
        where: { id: selectedOption.id },
        data: { voteCount: { increment: 1 } },
      });

      // 8. Tally totals
      const allUpdatedOptions = await tx.pollOption.findMany({
        where: { pollId: poll.id },
      });
      const totalVotes = allUpdatedOptions.reduce((acc, o) => acc + o.voteCount, 0);

      const optionsWithPercentages = allUpdatedOptions.map((opt) => ({
        id: opt.id,
        optionText: opt.optionText,
        voteCount: opt.voteCount,
        percentage: totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 1000) / 10 : 0,
      }));

      return {
        pollId: poll.id,
        question: poll.question,
        votedOption: {
          id: updatedOption.id,
          optionText: updatedOption.optionText,
        },
        totalVotes,
        options: optionsWithPercentages,
      };
    });
  }

  /**
   * 6. Get Poll Details & Live Results
   */
  static async getPollResults(user: AuthUserPayload, pollId: string) {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: true,
        votes: {
          include: {
            unit: { select: { unitNumber: true, sectionWing: { select: { name: true } } } },
            votedByUser: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    if (!poll) {
      throw new AppError(404, "Community poll not found.");
    }

    const now = new Date();
    const isClosed = now > poll.cutoffTimestamp || poll.status === "CLOSED";
    const remainingHours = isClosed
      ? 0
      : Math.max(0, Math.round(((poll.cutoffTimestamp.getTime() - now.getTime()) / 3600000) * 10) / 10);

    const totalVotes = poll.options.reduce((acc, opt) => acc + opt.voteCount, 0);

    const options = poll.options.map((opt) => ({
      id: opt.id,
      optionText: opt.optionText,
      voteCount: opt.voteCount,
      percentage: totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 1000) / 10 : 0,
    }));

    // If secret ballot, mask individual voter records completely
    const publicBallots = poll.isSecret
      ? []
      : poll.votes.map((v) => ({
          unit: `${v.unit?.sectionWing?.name || ""} - ${v.unit?.unitNumber || ""}`.trim(),
          voter: v.votedByUser?.fullName || "Resident",
          optionId: v.pollOptionId,
        }));

    return {
      id: poll.id,
      question: poll.question,
      description: poll.description,
      isSecret: poll.isSecret,
      pollPrivacyType: poll.pollPrivacyType,
      votingScope: poll.votingScope,
      startDate: poll.startDate,
      endDate: poll.cutoffTimestamp,
      isClosed,
      remainingHours,
      totalVotes,
      options,
      publicBallots,
    };
  }

  /**
   * 7. List All Community Polls
   */
  static async listPolls(user: AuthUserPayload) {
    const societyId = await this.resolveSocietyId(user);

    const polls = await prisma.poll.findMany({
      where: { societyId },
      include: {
        options: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();

    return polls.map((p) => {
      const isClosed = now > p.cutoffTimestamp || p.status === "CLOSED";
      const totalVotes = p.options.reduce((acc, opt) => acc + opt.voteCount, 0);
      const remainingHours = isClosed
        ? 0
        : Math.max(0, Math.round(((p.cutoffTimestamp.getTime() - now.getTime()) / 3600000) * 10) / 10);

      const options = p.options.map((opt) => ({
        id: opt.id,
        optionText: opt.optionText,
        voteCount: opt.voteCount,
        percentage: totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 1000) / 10 : 0,
      }));

      return {
        id: p.id,
        question: p.question,
        description: p.description,
        isSecret: p.isSecret,
        votingScope: p.votingScope,
        startDate: p.startDate,
        endDate: p.cutoffTimestamp,
        isClosed,
        remainingHours,
        totalVotes,
        options,
      };
    });
  }
}
