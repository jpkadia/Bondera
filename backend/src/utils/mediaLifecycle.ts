interface MediaTypeInput {
  resourceType: "image" | "video" | "raw" | "auto";
  mimeType: string;
}

export const cleanupResourceType = (
  asset: MediaTypeInput
): "image" | "video" | "raw" => {
  if (asset.resourceType !== "auto") return asset.resourceType;
  if (asset.mimeType.startsWith("video/") || asset.mimeType.startsWith("audio/")) {
    return "video";
  }
  return asset.mimeType.startsWith("image/") ? "image" : "raw";
};

export const cleanupRetryDelayMs = (attempts: number): number =>
  Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 6 * 60 * 60 * 1000);

export const isGoogleProfilePictureUrl = (value: string | undefined): boolean => {
  if (!value) return false;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (hostname === "googleusercontent.com" ||
        hostname.endsWith(".googleusercontent.com"))
    );
  } catch {
    return false;
  }
};

export const shouldHydrateGoogleProfilePicture = (
  profilePictureDisabled: boolean,
  currentUrl: string | undefined,
  googleUrl: string | undefined,
  currentSource?: "google" | "upload",
  currentSourceUrl?: string
): boolean => {
  if (
    profilePictureDisabled ||
    !isGoogleProfilePictureUrl(googleUrl)
  ) {
    return false;
  }

  if (!currentUrl) return true;
  if (currentSource === "google") return currentSourceUrl !== googleUrl;
  if (currentSource === "upload") return false;
  return isGoogleProfilePictureUrl(currentUrl);
};
