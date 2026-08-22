import { BriefcaseBusiness, House, UsersRound, X } from "lucide-react-native";
import { Modal, Pressable } from "react-native";
import { styled } from "styled-components/native";

import { IconButton } from "@/components/IconButton";
import { colors } from "@/theme";
import type { Category, Connection } from "@/types/api";
import { displayName } from "@/utils/format";

const Backdrop = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: ${colors.overlay};
`;

const Dialog = styled.View`
  width: 100%;
  max-width: 420px;
  border-radius: 8px;
  background-color: ${colors.surface};
  padding: 20px;
  gap: 16px;
`;

const Header = styled.View`
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const TitleBlock = styled.View`
  flex: 1;
`;

const Title = styled.Text`
  color: ${colors.ink};
  font-size: 20px;
  font-weight: 800;
`;

const Subtitle = styled.Text`
  margin-top: 4px;
  color: ${colors.inkMuted};
  font-size: 14px;
  line-height: 20px;
`;

const Options = styled.View`
  gap: 8px;
`;

const Option = styled(Pressable)<{ $selected: boolean }>`
  min-height: 58px;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-width: 1px;
  border-color: ${({ $selected }) => $selected ? colors.brand : colors.border};
  border-radius: 8px;
  background-color: ${({ $selected }) => $selected ? colors.brandSoft : colors.surface};
`;

const OptionIcon = styled.View`
  width: 34px;
  height: 34px;
  border-radius: 8px;
  align-items: center;
  justify-content: center;
  background-color: ${colors.surfaceMuted};
`;

const OptionText = styled.Text`
  color: ${colors.ink};
  font-size: 15px;
  font-weight: 700;
`;

const categories = [
  { value: "Family" as const, icon: House },
  { value: "Friends" as const, icon: UsersRound },
  { value: "Professional" as const, icon: BriefcaseBusiness },
];

export function CategoryModal({ connection, visible, selected, busy, onSelect, onConfirm, onClose }: {
  connection: Connection | null;
  visible: boolean;
  selected?: Category;
  busy?: boolean;
  onSelect(category: Category): void;
  onConfirm(): void;
  onClose(): void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Backdrop>
        <Dialog accessibilityViewIsModal>
          <Header>
            <TitleBlock>
              <Title>Choose a circle</Title>
              <Subtitle>{connection ? `Set how ${displayName(connection.otherUser)} appears in your contacts.` : "Select a category."}</Subtitle>
            </TitleBlock>
            <IconButton icon={X} label="Close" onPress={onClose} />
          </Header>
          <Options>
            {categories.map(({ value, icon: Icon }) => (
              <Option key={value} $selected={selected === value} onPress={() => onSelect(value)}>
                <OptionIcon><Icon size={19} color={colors.ink} /></OptionIcon>
                <OptionText>{value}</OptionText>
              </Option>
            ))}
          </Options>
          <Pressable
            accessibilityRole="button"
            disabled={!selected || busy}
            onPress={onConfirm}
            style={({ pressed }) => ({
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              backgroundColor: selected ? colors.brand : colors.border,
              opacity: pressed || busy ? 0.75 : 1,
            })}
          >
            <OptionText style={{ color: colors.white }}>{busy ? "Saving..." : "Confirm category"}</OptionText>
          </Pressable>
        </Dialog>
      </Backdrop>
    </Modal>
  );
}
