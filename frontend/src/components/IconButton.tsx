import type { ComponentType } from "react";
import { Pressable, type PressableProps } from "react-native";
import type { LucideProps } from "lucide-react-native";
import { styled } from "styled-components/native";

import { colors } from "@/theme";

const Button = styled(Pressable)<{ $tone: "plain" | "soft" | "danger" }>`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  align-items: center;
  justify-content: center;
  background-color: ${({ $tone }) =>
    $tone === "soft" ? colors.surfaceMuted : $tone === "danger" ? colors.coralSoft : "transparent"};
`;

export function IconButton({
  icon: Icon,
  label,
  tone = "plain",
  color,
  ...props
}: PressableProps & {
  icon: ComponentType<LucideProps>;
  label: string;
  tone?: "plain" | "soft" | "danger";
  color?: string;
}) {
  return (
    <Button accessibilityRole="button" accessibilityLabel={label} $tone={tone} {...props}>
      <Icon size={20} strokeWidth={2} color={color ?? (tone === "danger" ? colors.coral : colors.ink)} />
    </Button>
  );
}
