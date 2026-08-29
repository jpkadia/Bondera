export interface ImageDimensions {
  width: number;
  height: number;
}

export interface CropOffset {
  x: number;
  y: number;
}

export interface CropRectangle {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export const clampCropZoom = (zoom: number): number =>
  Math.min(4, Math.max(1, zoom));

export const coverScale = (
  source: ImageDimensions,
  viewportSize: number,
): number => Math.max(viewportSize / source.width, viewportSize / source.height);

export const clampCropOffset = (
  source: ImageDimensions,
  viewportSize: number,
  zoom: number,
  offset: CropOffset,
): CropOffset => {
  const scale = coverScale(source, viewportSize) * clampCropZoom(zoom);
  const maxX = Math.max((source.width * scale - viewportSize) / 2, 0);
  const maxY = Math.max((source.height * scale - viewportSize) / 2, 0);

  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
};

export const calculateCropRectangle = (
  source: ImageDimensions,
  viewportSize: number,
  zoom: number,
  requestedOffset: CropOffset,
): CropRectangle => {
  const safeZoom = clampCropZoom(zoom);
  const scale = coverScale(source, viewportSize) * safeZoom;
  const offset = clampCropOffset(
    source,
    viewportSize,
    safeZoom,
    requestedOffset,
  );
  const cropSize = Math.max(
    1,
    Math.min(
      source.width,
      source.height,
      Math.floor(viewportSize / scale),
    ),
  );
  const displayedWidth = source.width * scale;
  const displayedHeight = source.height * scale;
  const imageLeft = (viewportSize - displayedWidth) / 2 + offset.x;
  const imageTop = (viewportSize - displayedHeight) / 2 + offset.y;
  const rawOriginX = -imageLeft / scale;
  const rawOriginY = -imageTop / scale;

  return {
    originX: Math.min(
      source.width - cropSize,
      Math.max(0, Math.round(rawOriginX)),
    ),
    originY: Math.min(
      source.height - cropSize,
      Math.max(0, Math.round(rawOriginY)),
    ),
    width: cropSize,
    height: cropSize,
  };
};
