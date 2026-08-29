import { CalendarDays } from "lucide-react-native";
import { createElement, useRef, useState } from "react";
import { Pressable } from "react-native";
import { styled } from "styled-components/native";

import {
  dateToIsoBirthDate,
  formatIsoBirthDate,
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

export function BirthDateField({
  value,
  disabled = false,
  invalid = false,
  onChangeText,
  onBlur,
}: BirthDateFieldProps) {
  const [focused, setFocused] = useState(false);
  const pickerRef = useRef<HTMLInputElement | null>(null);

  const openCalendar = () => {
    if (disabled || !pickerRef.current) return;
    try {
      if (typeof pickerRef.current.showPicker === "function") {
        pickerRef.current.showPicker();
        return;
      }
    } catch {
      // Older browsers may expose showPicker without supporting it.
    }
    try {
      pickerRef.current.click();
    } catch {
      // The user can still enter DD/MM/YYYY manually.
    }
  };

  return (
    <Field $focused={focused} $invalid={invalid}>
      <CalendarDays size={19} color={colors.inkMuted} />
      <Input
        accessibilityLabel="Birthdate in day month year format"
        editable={!disabled}
        inputMode="numeric"
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
      {createElement("input", {
        ref: pickerRef,
        "aria-label": "Choose birthdate from calendar",
        disabled,
        max: dateToIsoBirthDate(new Date()),
        min: "1900-01-01",
        tabIndex: -1,
        type: "date",
        value: parseBirthDateText(value) ?? "",
        onChange: (event) => {
          onChangeText(formatIsoBirthDate(event.currentTarget.value));
        },
        style: {
          position: "absolute",
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
        },
      })}
    </Field>
  );
}
