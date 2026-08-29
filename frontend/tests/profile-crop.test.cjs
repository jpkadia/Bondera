const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateCropRectangle,
  clampCropOffset,
  clampCropZoom,
} = require("../node_modules/.cache/bondera-tests/services/profile-crop.js");

test("centered landscape photo maps to the exact source square", () => {
  assert.deepEqual(
    calculateCropRectangle({ width: 1000, height: 500 }, 250, 1, {
      x: 0,
      y: 0,
    }),
    { originX: 250, originY: 0, width: 500, height: 500 },
  );
});

test("drag offset is clamped and cannot expose an empty viewport area", () => {
  const source = { width: 1000, height: 500 };
  const offset = clampCropOffset(source, 250, 1, { x: 999, y: 999 });

  assert.deepEqual(offset, { x: 125, y: 0 });
  assert.deepEqual(calculateCropRectangle(source, 250, 1, offset), {
    originX: 0,
    originY: 0,
    width: 500,
    height: 500,
  });
});

test("zoom maps preview coordinates back to source pixels", () => {
  assert.deepEqual(
    calculateCropRectangle({ width: 1000, height: 500 }, 250, 2, {
      x: 0,
      y: 0,
    }),
    { originX: 375, originY: 125, width: 250, height: 250 },
  );
  assert.equal(clampCropZoom(0), 1);
  assert.equal(clampCropZoom(10), 4);
});
