const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const EARLIEST_BIRTH_YEAR = 1900;

const isRealDate = (year: number, month: number, day: number): boolean => {
  const value = new Date(year, month - 1, day, 12);

  return (
    value.getFullYear() === year &&
    value.getMonth() === month - 1 &&
    value.getDate() === day
  );
};

export const normalizeBirthDateText = (input: string): string => {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2)];

  if (digits.length > 2) parts.push(digits.slice(2, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 8));

  return parts.join("/");
};

export const dateToIsoBirthDate = (date: Date): string =>
  `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;

export const parseBirthDateText = (
  input: string,
  today = new Date(),
): string | undefined => {
  const match = DISPLAY_DATE_PATTERN.exec(input);
  if (!match) return undefined;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < EARLIEST_BIRTH_YEAR || !isRealDate(year, month, day)) {
    return undefined;
  }

  const value = dateToIsoBirthDate(new Date(year, month - 1, day, 12));
  return value <= dateToIsoBirthDate(today) ? value : undefined;
};

export const formatIsoBirthDate = (value?: string): string => {
  const match = value ? ISO_DATE_PATTERN.exec(value) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
};

export const isoBirthDateToLocalDate = (value?: string): Date | undefined => {
  const match = value ? ISO_DATE_PATTERN.exec(value) : null;
  if (!match) return undefined;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const defaultBirthDate = (today = new Date()): Date =>
  new Date(today.getFullYear() - 18, today.getMonth(), today.getDate(), 12);
