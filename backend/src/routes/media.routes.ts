import { Router } from "express";
import {
  uploadChatMessage,
  uploadProfilePicture
} from "../controllers/message.controller";
import { authenticate } from "../middleware/authenticate";
import {
  chatMediaUpload,
  profilePictureUpload
} from "../middleware/upload";
import { validateBody } from "../middleware/validateRequest";
import { asyncHandler } from "../utils/asyncHandler";
import { chatMediaMessageSchema } from "../validation/message.validation";

export const mediaRouter = Router();

mediaRouter.use(asyncHandler(authenticate));
mediaRouter.post(
  "/chat",
  chatMediaUpload.array("files", 3),
  validateBody(chatMediaMessageSchema),
  asyncHandler(uploadChatMessage)
);
mediaRouter.post(
  "/profile-picture",
  profilePictureUpload.single("file"),
  asyncHandler(uploadProfilePicture)
);
