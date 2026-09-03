const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getHomeCircleLayout,
  showsEveryCircleCategory,
} = require("../node_modules/.cache/bondera-tests/services/home-layout.js");

test("mobile and tablet layouts render every circle category", () => {
  for (const width of [320, 390, 599, 600, 768, 899, 900, 1024, 1199]) {
    const layout = getHomeCircleLayout(width);
    assert.equal(showsEveryCircleCategory(layout), true, `${width}px`);
  }
});

test("desktop retains the space-efficient tab layout", () => {
  for (const width of [1200, 1280, 1920]) {
    const layout = getHomeCircleLayout(width);
    assert.equal(layout, "tabs", `${width}px`);
    assert.equal(showsEveryCircleCategory(layout), false, `${width}px`);
  }
});
