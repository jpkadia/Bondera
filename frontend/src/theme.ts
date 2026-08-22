export const colors = {
  canvas: "#F4F6F3",
  surface: "#FFFFFF",
  surfaceMuted: "#E9EEEA",
  ink: "#18211D",
  inkMuted: "#637069",
  border: "#D7DED9",
  brand: "#176B4D",
  brandDark: "#0F4E38",
  brandSoft: "#DDECE5",
  amber: "#B97912",
  amberSoft: "#FFF2D6",
  coral: "#C94D45",
  coralSoft: "#FBE6E3",
  blue: "#286D91",
  blueSoft: "#E1EFF5",
  black: "#101512",
  white: "#FFFFFF",
  overlay: "rgba(16, 21, 18, 0.46)",
};

export const theme = {
  colors,
  radius: { small: 4, medium: 8 },
  spacing: { xsmall: 4, small: 8, medium: 16, large: 24, xlarge: 32 },
};

export type AppTheme = typeof theme;
