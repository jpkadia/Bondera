export type HomeCircleLayout = "cards" | "stacked" | "grid" | "tabs";

export function getHomeCircleLayout(width: number): HomeCircleLayout {
  if (width >= 1_200) return "tabs";
  if (width >= 600 && width < 900) return "grid";
  if (width < 600) return "cards";
  return "stacked";
}

export function showsEveryCircleCategory(layout: HomeCircleLayout): boolean {
  return layout === "stacked" || layout === "grid";
}

export function usesCircleCategoryCards(layout: HomeCircleLayout): boolean {
  return layout === "cards";
}
