export const MAX_FILES_PER_MESSAGE = 3;

export const MAX_MEDIA_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const CLOUDINARY_CHAT_MEDIA_FOLDER = "bondera/chat-media";

export const CLOUDINARY_PROFILE_PICTURES_FOLDER = "bondera/profile-pictures";

export const ALLOWED_CLOUDINARY_FOLDERS = [
  CLOUDINARY_CHAT_MEDIA_FOLDER,
  CLOUDINARY_PROFILE_PICTURES_FOLDER
] as const;

export type CloudinaryFolder = (typeof ALLOWED_CLOUDINARY_FOLDERS)[number];

export const ALLOWED_CHAT_MEDIA_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain"
]);

export const ALLOWED_PROFILE_PICTURE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);
