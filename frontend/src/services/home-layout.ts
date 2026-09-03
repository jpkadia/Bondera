export type HomeCircleLayout = "stacked" | "grid" | "tabs";

export function getHomeCircleLayout(width: number): HomeCircleLayout {
  if (width >= 1_200) return "tabs";
  if (width >= 600 && width < 900) return "grid";
  return "stacked";
}

export function showsEveryCircleCategory(layout: HomeCircleLayout): boolean {
  return layout !== "tabs";
}
