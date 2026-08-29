import { CloudinaryCleanupJobModel } from "../models/CloudinaryCleanupJob";
import { destroyCloudinaryAsset } from "./cloudinary.service";
import { cleanupRetryDelayMs } from "../utils/mediaLifecycle";

type ResourceType = "image" | "video" | "raw";

const WORK_INTERVAL_MS = 60_000;
let cleanupTimer: NodeJS.Timeout | undefined;
let cleanupRunning = false;

const enqueueCloudinaryCleanup = async (
  publicId: string,
  resourceType: ResourceType,
  reason: string,
  error: unknown
): Promise<void> => {
  await CloudinaryCleanupJobModel.updateOne(
    { publicId, resourceType },
    {
      $set: {
        resourceType,
        reason,
        nextAttemptAt: new Date(),
        lastError: error instanceof Error ? error.message : String(error)
      },
      $setOnInsert: { attempts: 0 }
    },
    { upsert: true }
  );
};

export const destroyCloudinaryAssetOrQueue = async (
  publicId: string,
  resourceType: ResourceType,
  reason: string
): Promise<boolean> => {
  try {
    await destroyCloudinaryAsset(publicId, resourceType);
    await CloudinaryCleanupJobModel.deleteOne({ publicId, resourceType });
    return true;
  } catch (error) {
    await enqueueCloudinaryCleanup(publicId, resourceType, reason, error);
    return false;
  }
};

export const processPendingCloudinaryCleanup = async (): Promise<void> => {
  if (cleanupRunning) return;
  cleanupRunning = true;

  try {
    const jobs = await CloudinaryCleanupJobModel.find({
      nextAttemptAt: { $lte: new Date() }
    })
      .sort({ nextAttemptAt: 1, attempts: 1 })
      .limit(25);

    for (const job of jobs) {
      try {
        await destroyCloudinaryAsset(job.publicId, job.resourceType);
        await job.deleteOne();
      } catch (error) {
        job.attempts += 1;
        job.lastError = error instanceof Error ? error.message : String(error);
        job.nextAttemptAt = new Date(Date.now() + cleanupRetryDelayMs(job.attempts));
        await job.save();
      }
    }
  } finally {
    cleanupRunning = false;
  }
};

export const startCloudinaryCleanupWorker = (): void => {
  if (cleanupTimer) return;
  void processPendingCloudinaryCleanup();
  cleanupTimer = setInterval(() => {
    void processPendingCloudinaryCleanup();
  }, WORK_INTERVAL_MS);
  cleanupTimer.unref();
};

export const stopCloudinaryCleanupWorker = (): void => {
  if (cleanupTimer) clearInterval(cleanupTimer);
  cleanupTimer = undefined;
};
