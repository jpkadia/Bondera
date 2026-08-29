export const colors = {
  canvas: "#F5F8FA",
  surface: "#FFFFFF",
  surfaceMuted: "#ECF2F4",
  ink: "#101C33",
  inkMuted: "#607086",
  border: "#D7E1E8",
  brand: "#041C4A",
  brandDark: "#02132F",
  brandSoft: "#DDF7F5",
  accent: "#04B9B4",
  accentDark: "#027A76",
  accentSoft: "#E5FAF9",
  amber: "#B97912",
  amberSoft: "#FFF2D6",
  coral: "#C94D45",
  coralSoft: "#FBE6E3",
  blue: "#286D91",
  blueSoft: "#E1EFF5",
  black: "#07111F",
  white: "#FFFFFF",
  overlay: "rgba(4, 28, 74, 0.46)",
};

export const theme = {
  colors,
  radius: { small: 4, medium: 8 },
  spacing: { xsmall: 4, small: 8, medium: 16, large: 24, xlarge: 32 },
};

export type AppTheme = typeof theme;
