import fs from "node:fs";
import { Buffer } from "node:buffer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const brandDirectory = path.resolve(scriptDirectory, "../assets/brand");
const publicDirectory = path.resolve(scriptDirectory, "../public");

fs.mkdirSync(publicDirectory, { recursive: true });

const readPng = (name) =>
  PNG.sync.read(fs.readFileSync(path.join(brandDirectory, name)));

const writePng = (name, image) => {
  fs.writeFileSync(
    path.join(brandDirectory, name),
    PNG.sync.write(image, { colorType: 6 }),
  );
};

const writeIcoWithPng = (name, png, size) => {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(size === 256 ? 0 : size, 6);
  header.writeUInt8(size === 256 ? 0 : size, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(header.length, 18);
  fs.writeFileSync(path.join(publicDirectory, name), Buffer.concat([header, png]));
};

const isExteriorWhite = (image, pixelIndex) => {
  const offset = pixelIndex * 4;
  return (
    image.data[offset] >= 235 &&
    image.data[offset + 1] >= 235 &&
    image.data[offset + 2] >= 235
  );
};

const removeExteriorWhite = (source) => {
  const image = PNG.sync.read(PNG.sync.write(source));
  const pixelCount = image.width * image.height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const enqueue = (index) => {
    if (visited[index] || !isExteriorWhite(image, index)) return;
    visited[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < image.width; x += 1) {
    enqueue(x);
    enqueue((image.height - 1) * image.width + x);
  }
  for (let y = 0; y < image.height; y += 1) {
    enqueue(y * image.width);
    enqueue(y * image.width + image.width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % image.width;
    const y = Math.floor(index / image.width);
    const offset = index * 4;
    image.data[offset + 3] = 0;

    if (x > 0) enqueue(index - 1);
    if (x + 1 < image.width) enqueue(index + 1);
    if (y > 0) enqueue(index - image.width);
    if (y + 1 < image.height) enqueue(index + image.width);
  }

  return image;
};

const cropToContent = (source, padding = 0) => {
  let left = source.width;
  let top = source.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (source.data[(y * source.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) {
    throw new Error("Cannot crop an image with no visible pixels.");
  }

  left = Math.max(0, left - padding);
  top = Math.max(0, top - padding);
  right = Math.min(source.width - 1, right + padding);
  bottom = Math.min(source.height - 1, bottom + padding);

  const output = new PNG({ width: right - left + 1, height: bottom - top + 1 });
  PNG.bitblt(source, output, left, top, output.width, output.height, 0, 0);
  return output;
};

const resize = (source, width, height) => {
  const output = new PNG({ width, height });

  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(
      source.height - 1,
      Math.max(0, (y + 0.5) * (source.height / height) - 0.5),
    );
    const y0 = Math.floor(sourceY);
    const y1 = Math.min(source.height - 1, y0 + 1);
    const yWeight = sourceY - y0;

    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(
        source.width - 1,
        Math.max(0, (x + 0.5) * (source.width / width) - 0.5),
      );
      const x0 = Math.floor(sourceX);
      const x1 = Math.min(source.width - 1, x0 + 1);
      const xWeight = sourceX - x0;
      const samples = [
        [x0, y0, (1 - xWeight) * (1 - yWeight)],
        [x1, y0, xWeight * (1 - yWeight)],
        [x0, y1, (1 - xWeight) * yWeight],
        [x1, y1, xWeight * yWeight],
      ];
      let alpha = 0;
      let red = 0;
      let green = 0;
      let blue = 0;

      for (const [sampleX, sampleY, weight] of samples) {
        const offset = (sampleY * source.width + sampleX) * 4;
        const sampleAlpha = source.data[offset + 3] / 255;
        alpha += sampleAlpha * weight;
        red += source.data[offset] * sampleAlpha * weight;
        green += source.data[offset + 1] * sampleAlpha * weight;
        blue += source.data[offset + 2] * sampleAlpha * weight;
      }

      const offset = (y * width + x) * 4;
      if (alpha > 0) {
        output.data[offset] = Math.round(red / alpha);
        output.data[offset + 1] = Math.round(green / alpha);
        output.data[offset + 2] = Math.round(blue / alpha);
      }
      output.data[offset + 3] = Math.round(alpha * 255);
    }
  }

  return output;
};

const contain = (source, size, occupancy) => {
  const maxDimension = Math.round(size * occupancy);
  const scale = Math.min(maxDimension / source.width, maxDimension / source.height);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const resized = resize(source, width, height);
  const output = new PNG({ width: size, height: size });
  PNG.bitblt(
    resized,
    output,
    0,
    0,
    width,
    height,
    Math.floor((size - width) / 2),
    Math.floor((size - height) / 2),
  );
  return output;
};

const monochrome = (source) => {
  const output = PNG.sync.read(PNG.sync.write(source));

  for (let offset = 0; offset < output.data.length; offset += 4) {
    const isWhite =
      output.data[offset] >= 225 &&
      output.data[offset + 1] >= 225 &&
      output.data[offset + 2] >= 225;
    output.data[offset] = 255;
    output.data[offset + 1] = 255;
    output.data[offset + 2] = 255;
    if (isWhite) output.data[offset + 3] = 0;
  }

  return output;
};

const icon = removeExteriorWhite(readPng("app-icon.png"));
const symbol = cropToContent(icon, 16);
const wordmark = cropToContent(
  removeExteriorWhite(readPng("wordmark-source.png")),
  24,
);
const monoSymbol = monochrome(symbol);

writePng("brand-symbol.png", contain(symbol, 512, 0.88));
writePng("wordmark.png", wordmark);
writePng("adaptive-foreground.png", contain(symbol, 1024, 0.62));
writePng("adaptive-monochrome.png", contain(monoSymbol, 1024, 0.62));
writePng("notification-icon.png", contain(monoSymbol, 96, 0.72));
const favicon = contain(symbol, 64, 0.88);
writePng("favicon.png", favicon);
writePng("splash-logo.png", wordmark);
writeIcoWithPng("favicon.ico", PNG.sync.write(favicon), 64);
fs.copyFileSync(
  path.join(brandDirectory, "brand-symbol.png"),
  path.join(publicDirectory, "bondera-icon.png"),
);

console.log("Bondera brand assets generated.");
