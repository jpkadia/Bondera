export interface BirthDateFieldProps {
  value: string;
  disabled?: boolean;
  invalid?: boolean;
  onChangeText(value: string): void;
  onBlur?(): void;
}
