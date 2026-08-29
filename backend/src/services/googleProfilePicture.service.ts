import { Readable } from "node:stream";
import {
  ALLOWED_PROFILE_PICTURE_MIME_TYPES,
  CLOUDINARY_PROFILE_PICTURES_FOLDER,
  MAX_MEDIA_FILE_SIZE_BYTES
} from "../constants/media";
import { UserModel, type UserDocument } from "../models/User";
import { isGoogleProfilePictureUrl } from "../utils/mediaLifecycle";
import { uploadCloudinaryFile } from "./cloudinary.service";
import { destroyCloudinaryAssetOrQueue } from "./cloudinaryCleanup.service";

export interface MirroredGoogleProfilePicture {
  url: string;
  publicId: string;
  source: "google";
  sourceUrl: string;
}

const toUploadFile = (
  buffer: Buffer,
  mimeType: string
): Express.Multer.File => ({
  fieldname: "profilePicture",
  originalname: "google-profile-picture",
  encoding: "7bit",
  mimetype: mimeType,
  size: buffer.byteLength,
  buffer,
  stream: Readable.from(buffer),
  destination: "",
  filename: "",
  path: ""
});

export const mirrorGoogleProfilePicture = async (
  sourceUrl: string
): Promise<MirroredGoogleProfilePicture | undefined> => {
  if (!isGoogleProfilePictureUrl(sourceUrl)) return undefined;

  try {
    const response = await fetch(sourceUrl, {
      headers: { accept: "image/jpeg,image/png,image/webp" },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok || !isGoogleProfilePictureUrl(response.url)) {
      return undefined;
    }

    const mimeType = response.headers.get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (
      !mimeType ||
      !ALLOWED_PROFILE_PICTURE_MIME_TYPES.has(mimeType) ||
      (declaredSize > 0 && declaredSize > MAX_MEDIA_FILE_SIZE_BYTES)
    ) {
      return undefined;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_MEDIA_FILE_SIZE_BYTES) {
      return undefined;
    }

    const uploaded = await uploadCloudinaryFile(
      toUploadFile(buffer, mimeType),
      CLOUDINARY_PROFILE_PICTURES_FOLDER,
      "image"
    );
    return {
      url: uploaded.secureUrl,
      publicId: uploaded.publicId,
      source: "google",
      sourceUrl
    };
  } catch {
    return undefined;
  }
};

export const migrateStoredGoogleProfilePicture = async (
  user: UserDocument
): Promise<boolean> => {
  const sourceUrl = user.profilePicture?.url;
  if (
    user.profilePictureDisabled ||
    user.profilePicture?.source ||
    !sourceUrl ||
    !isGoogleProfilePictureUrl(sourceUrl)
  ) {
    return false;
  }

  const mirroredPicture = await mirrorGoogleProfilePicture(sourceUrl);
  if (!mirroredPicture) return false;

  try {
    const result = await UserModel.updateOne(
      {
        _id: user._id,
        profilePictureDisabled: false,
        "profilePicture.url": sourceUrl,
        "profilePicture.source": { $exists: false }
      },
      { $set: { profilePicture: mirroredPicture } },
      { runValidators: true }
    );

    if (result.modifiedCount === 1) {
      user.profilePicture = mirroredPicture;
      return true;
    }
  } catch {
    // The mirrored asset is cleaned below and the legacy URL stays untouched.
  }

  await destroyCloudinaryAssetOrQueue(
    mirroredPicture.publicId,
    "image",
    "unused-google-profile-picture-mirror"
  ).catch(() => undefined);
  return false;
};
