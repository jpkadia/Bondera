import { CheckCircle2, CircleAlert, X } from "lucide-react-native";
import { styled } from "styled-components/native";

import { IconButton } from "@/components/IconButton";
import { colors } from "@/theme";

const Wrap = styled.View<{ $error: boolean }>`
  min-height: 48px;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 8px 10px 8px 12px;
  border-width: 1px;
  border-color: ${({ $error }) => $error ? colors.coral : colors.brand};
  border-radius: 8px;
  background-color: ${({ $error }) => $error ? colors.coralSoft : colors.brandSoft};
`;

const Message = styled.Text`
  flex: 1;
  color: ${colors.ink};
  font-size: 14px;
  line-height: 20px;
`;

export function Notice({ message, error = false, onClose }: {
  message: string;
  error?: boolean;
  onClose(): void;
}) {
  const StatusIcon = error ? CircleAlert : CheckCircle2;
  return (
    <Wrap $error={error} accessibilityRole="alert">
      <StatusIcon size={19} color={error ? colors.coral : colors.brand} />
      <Message>{message}</Message>
      <IconButton icon={X} label="Dismiss" onPress={onClose} />
    </Wrap>
  );
}
