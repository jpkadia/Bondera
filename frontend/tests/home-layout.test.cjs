const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getHomeCircleLayout,
  showsEveryCircleCategory,
  usesCircleCategoryCards,
} = require("../node_modules/.cache/bondera-tests/services/home-layout.js");

test("mobile renders three selectable category cards", () => {
  for (const width of [320, 390, 599]) {
    const layout = getHomeCircleLayout(width);
    assert.equal(layout, "cards", `${width}px`);
    assert.equal(usesCircleCategoryCards(layout), true, `${width}px`);
    assert.equal(showsEveryCircleCategory(layout), false, `${width}px`);
  }
});

test("tablet and intermediate desktop widths keep all categories visible", () => {
  for (const width of [600, 768, 899, 900, 1024, 1199]) {
    const layout = getHomeCircleLayout(width);
    assert.equal(showsEveryCircleCategory(layout), true, `${width}px`);
    assert.equal(usesCircleCategoryCards(layout), false, `${width}px`);
  }
});

test("desktop retains the space-efficient tab layout", () => {
  for (const width of [1200, 1280, 1920]) {
    const layout = getHomeCircleLayout(width);
    assert.equal(layout, "tabs", `${width}px`);
    assert.equal(showsEveryCircleCategory(layout), false, `${width}px`);
  }
});
