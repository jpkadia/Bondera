import { Image } from "expo-image";

const symbol = require("../../assets/brand/brand-symbol.png");

type BrandSymbolProps = {
  size?: number;
};

export function BrandSymbol({ size = 48 }: BrandSymbolProps) {
  return (
    <Image
      accessibilityLabel="Bondera"
      contentFit="contain"
      source={symbol}
      style={{ width: size, height: size }}
    />
  );
}
