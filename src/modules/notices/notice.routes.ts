import { Router } from "express";
import { NoticeController } from "./notice.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createNoticeSchema,
  createPollSchema,
  castVoteSchema,
  noticeQuerySchema,
} from "./notice.validation";

const router = Router();

// 1. Publish Notice (Admin only)
router.post(
  "/",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  validate({ body: createNoticeSchema }),
  NoticeController.publishNotice
);

// 2. Notices Feed (Resident and Admin)
router.get(
  "/",
  authenticate,
  validate({ query: noticeQuerySchema }),
  NoticeController.getNotices
);

// 3. Unpublish / Delete Notice (Admin only)
router.delete(
  "/:noticeId",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  NoticeController.deleteNotice
);

// 4. Create Community Poll (Admin only)
router.post(
  "/polls",
  authenticate,
  authorizeRoles("SUPER_ADMIN", "SUB_ADMIN"),
  validate({ body: createPollSchema }),
  NoticeController.createPoll
);

// 5. Cast Vote on a Poll (Resident)
router.post(
  "/polls/:pollId/vote",
  authenticate,
  validate({ body: castVoteSchema }),
  NoticeController.castVote
);

// 6. List Community Polls
router.get(
  "/polls",
  authenticate,
  NoticeController.getPolls
);

// 7. Get Poll Details & Live Breakdown
router.get(
  "/polls/:pollId/results",
  authenticate,
  NoticeController.getPollResults
);

export default router;
