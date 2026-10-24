import { Request, Response, NextFunction } from "express";
import { NoticeService } from "./notice.service";
import { successResponse } from "../../utils/apiResponse";

export class NoticeController {
  /**
   * POST /notices
   * Admin publishes a notice / announcement
   */
  static async publishNotice(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await NoticeService.publishNotice(req.user!, req.body);
      return successResponse(
        res,
        "Notice published successfully.",
        result,
        201
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /notices
   * Retrieve active notices feed
   */
  static async getNotices(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await NoticeService.listNotices(req.user!, req.query as any);
      return successResponse(
        res,
        "Notices feed retrieved successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * DELETE /notices/:noticeId
   * Admin unpublishes a notice
   */
  static async deleteNotice(req: Request, res: Response, next: NextFunction) {
    try {
      const noticeId = req.params.noticeId as string;
      const result = await NoticeService.deleteNotice(req.user!, noticeId);
      return successResponse(
        res,
        "Notice unpublished successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /notices/polls
   * Admin launches a new community poll
   */
  static async createPoll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await NoticeService.createCommunityPoll(req.user!, req.body);
      return successResponse(
        res,
        "Community poll launched successfully.",
        result,
        201
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /notices/polls/:pollId/vote
   * Resident casts a vote
   */
  static async castVote(req: Request, res: Response, next: NextFunction) {
    try {
      const pollId = req.params.pollId as string;
      const result = await NoticeService.castVote(req.user!, pollId, req.body);
      return successResponse(
        res,
        "Vote recorded successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /notices/polls
   * List all polls with live totals
   */
  static async getPolls(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await NoticeService.listPolls(req.user!);
      return successResponse(
        res,
        "Community polls retrieved successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /notices/polls/:pollId/results
   * View live or final poll results
   */
  static async getPollResults(req: Request, res: Response, next: NextFunction) {
    try {
      const pollId = req.params.pollId as string;
      const result = await NoticeService.getPollResults(req.user!, pollId);
      return successResponse(
        res,
        "Poll results retrieved successfully.",
        result,
        200
      );
    } catch (error) {
      return next(error);
    }
  }
}
