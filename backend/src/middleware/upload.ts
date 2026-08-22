import multer from "multer";
import {
  ALLOWED_CHAT_MEDIA_MIME_TYPES,
  ALLOWED_PROFILE_PICTURE_MIME_TYPES,
  MAX_FILES_PER_MESSAGE,
  MAX_MEDIA_FILE_SIZE_BYTES
} from "../constants/media";
import { AppError } from "../utils/errors";

const createFileFilter = (allowedMimeTypes: Set<string>): multer.Options["fileFilter"] => {
  return (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(
        new AppError(
          415,
          "MEDIA_TYPE_NOT_ALLOWED",
          `The file type ${file.mimetype || "unknown"} is not supported.`
        )
      );
      return;
    }

    callback(null, true);
  };
};

const storage = multer.memoryStorage();

export const chatMediaUpload = multer({
  storage,
  limits: {
    fileSize: MAX_MEDIA_FILE_SIZE_BYTES,
    files: MAX_FILES_PER_MESSAGE
  },
  fileFilter: createFileFilter(ALLOWED_CHAT_MEDIA_MIME_TYPES)
});

export const profilePictureUpload = multer({
  storage,
  limits: {
    fileSize: MAX_MEDIA_FILE_SIZE_BYTES,
    files: 1
  },
  fileFilter: createFileFilter(ALLOWED_PROFILE_PICTURE_MIME_TYPES)
});
