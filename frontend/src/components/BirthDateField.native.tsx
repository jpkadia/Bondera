import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { CalendarDays } from "lucide-react-native";
import { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { styled } from "styled-components/native";

import {
  dateToIsoBirthDate,
  defaultBirthDate,
  formatIsoBirthDate,
  isoBirthDateToLocalDate,
  normalizeBirthDateText,
  parseBirthDateText,
} from "@/services/birth-date";
import { colors } from "@/theme";
import type { BirthDateFieldProps } from "./BirthDateField.types";

const Field = styled.View<{ $focused: boolean; $invalid: boolean }>`
  min-height: 50px;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding-left: 13px;
  border-width: 1px;
  border-color: ${({ $focused, $invalid }) =>
    $invalid ? colors.coral : $focused ? colors.brand : colors.border};
  border-radius: 8px;
  background-color: ${colors.surface};
`;

const Input = styled.TextInput`
  flex: 1;
  min-width: 0;
  color: ${colors.ink};
  font-size: 15px;
`;

const CalendarButton = styled(Pressable)`
  width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
`;

const Backdrop = styled(SafeAreaView)`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: ${colors.overlay};
`;

const Dialog = styled.View<{ $maxHeight: number }>`
  width: 100%;
  max-width: 420px;
  max-height: ${({ $maxHeight }) => $maxHeight}px;
  border-radius: 12px;
  background-color: ${colors.surface};
`;

const Title = styled.Text`
  color: ${colors.ink};
  font-size: 17px;
  font-weight: 900;
`;

const Actions = styled.View`
  flex-direction: row;
  justify-content: flex-end;
  gap: 9px;
`;

const Action = styled(Pressable)<{ $primary?: boolean }>`
  min-height: 44px;
  min-width: 92px;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  border-radius: 8px;
  background-color: ${({ $primary }) =>
    $primary ? colors.brand : colors.surfaceMuted};
`;

const ActionText = styled.Text<{ $primary?: boolean }>`
  color: ${({ $primary }) => ($primary ? colors.white : colors.ink)};
  font-size: 14px;
  font-weight: 800;
`;

export function BirthDateField({
  value,
  disabled = false,
  invalid = false,
  onChangeText,
  onBlur,
}: BirthDateFieldProps) {
  const { height } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(defaultBirthDate());
  const now = new Date();
  const maximumDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
  );

  const openCalendar = () => {
    if (disabled) return;
    const parsed = parseBirthDateText(value);
    setDraftDate(
      isoBirthDateToLocalDate(parsed) ?? defaultBirthDate(),
    );
    setCalendarOpen(true);
  };

  return (
    <>
      <Field $focused={focused} $invalid={invalid}>
        <CalendarDays size={19} color={colors.inkMuted} />
        <Input
          accessibilityLabel="Birthdate in day month year format"
          editable={!disabled}
          inputMode="numeric"
          keyboardType="number-pad"
          maxLength={10}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colors.inkMuted}
          value={value}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          onChangeText={(text) => onChangeText(normalizeBirthDateText(text))}
          onFocus={() => setFocused(true)}
        />
        <CalendarButton
          accessibilityLabel="Choose birthdate from calendar"
          accessibilityRole="button"
          disabled={disabled}
          onPress={openCalendar}
        >
          <CalendarDays size={19} color={colors.brand} />
        </CalendarButton>
      </Field>

      {calendarOpen && Platform.OS === "android" ? (
        <DateTimePicker
          accentColor={colors.brand}
          display="default"
          maximumDate={maximumDate}
          minimumDate={new Date(1900, 0, 1, 12)}
          mode="date"
          negativeButton={{ label: "Cancel" }}
          positiveButton={{ label: "Use date" }}
          presentation="dialog"
          value={draftDate}
          onDismiss={() => setCalendarOpen(false)}
          onValueChange={(_event, date) => {
            onChangeText(formatIsoBirthDate(dateToIsoBirthDate(date)));
            setCalendarOpen(false);
          }}
        />
      ) : null}

      {Platform.OS !== "android" ? (
        <Modal
          transparent
          visible={calendarOpen}
          animationType="fade"
          onRequestClose={() => setCalendarOpen(false)}
        >
          <Backdrop>
            <Dialog $maxHeight={Math.max(240, height - 40)}>
              <ScrollView
                bounces={false}
                contentContainerStyle={{ gap: 14, padding: 18 }}
                showsVerticalScrollIndicator={false}
              >
                <Title>Choose birthdate</Title>
                <DateTimePicker
                  accentColor={colors.brand}
                  display="inline"
                  maximumDate={maximumDate}
                  minimumDate={new Date(1900, 0, 1, 12)}
                  mode="date"
                  presentation="inline"
                  value={draftDate}
                  onValueChange={(_event, date) => setDraftDate(date)}
                />
                <Actions>
                  <Action onPress={() => setCalendarOpen(false)}>
                    <ActionText>Cancel</ActionText>
                  </Action>
                  <Action
                    $primary
                    onPress={() => {
                      onChangeText(
                        formatIsoBirthDate(dateToIsoBirthDate(draftDate)),
                      );
                      setCalendarOpen(false);
                    }}
                  >
                    <ActionText $primary>Use date</ActionText>
                  </Action>
                </Actions>
              </ScrollView>
            </Dialog>
          </Backdrop>
        </Modal>
      ) : null}
    </>
  );
}
