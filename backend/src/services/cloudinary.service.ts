import type { UploadApiOptions, UploadApiResponse } from "cloudinary";
import { cloudinary } from "../config/cloudinary";
import type { CloudinaryFolder } from "../constants/media";
import { AppError } from "../utils/errors";

export interface StoredCloudinaryMedia {
  url: string;
  secureUrl: string;
  publicId: string;
  folder: CloudinaryFolder;
  resourceType: "image" | "video" | "raw";
  format?: string;
  originalName: string;
  mimeType: string;
  bytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

const uploadBuffer = (
  file: Express.Multer.File,
  folder: CloudinaryFolder,
  resourceType: UploadApiOptions["resource_type"]
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        use_filename: false,
        unique_filename: true,
        overwrite: false
      },
      (error, result) => {
        if (error || !result) {
          reject(
            new AppError(
              502,
              "CLOUDINARY_UPLOAD_FAILED",
              "Media could not be uploaded. Please try again."
            )
          );
          return;
        }

        resolve(result);
      }
    );

    stream.end(file.buffer);
  });
};

const normalizeUpload = (
  result: UploadApiResponse,
  file: Express.Multer.File,
  folder: CloudinaryFolder
): StoredCloudinaryMedia => ({
  url: result.url,
  secureUrl: result.secure_url,
  publicId: result.public_id,
  folder,
  resourceType:
    result.resource_type === "video" || result.resource_type === "raw"
      ? result.resource_type
      : "image",
  format: result.format,
  originalName: file.originalname,
  mimeType: file.mimetype,
  bytes: result.bytes,
  width: result.width,
  height: result.height,
  durationSeconds:
    typeof result.duration === "number" ? result.duration : undefined
});

export const uploadCloudinaryFile = async (
  file: Express.Multer.File,
  folder: CloudinaryFolder,
  resourceType: UploadApiOptions["resource_type"] = "auto"
): Promise<StoredCloudinaryMedia> => {
  const result = await uploadBuffer(file, folder, resourceType);

  if (!result.public_id.startsWith(`${folder}/`)) {
    await cloudinary.uploader.destroy(result.public_id, {
      resource_type: result.resource_type,
      invalidate: true
    });
    throw new AppError(502, "CLOUDINARY_FOLDER_INVALID", "Media folder validation failed.");
  }

  return normalizeUpload(result, file, folder);
};

export const destroyCloudinaryAsset = async (
  publicId: string,
  resourceType: "image" | "video" | "raw"
): Promise<void> => {
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true
  });

  if (result.result !== "ok" && result.result !== "not found") {
    throw new AppError(502, "CLOUDINARY_DELETE_FAILED", "Media cleanup is pending.");
  }
};

export const uploadCloudinaryFiles = async (
  files: Express.Multer.File[],
  folder: CloudinaryFolder,
  resourceType: UploadApiOptions["resource_type"] = "auto"
): Promise<StoredCloudinaryMedia[]> => {
  const uploaded: StoredCloudinaryMedia[] = [];

  try {
    for (const file of files) {
      uploaded.push(await uploadCloudinaryFile(file, folder, resourceType));
    }

    return uploaded;
  } catch (error) {
    await Promise.allSettled(
      uploaded.map((asset) =>
        destroyCloudinaryAsset(asset.publicId, asset.resourceType)
      )
    );
    throw error;
  }
};
