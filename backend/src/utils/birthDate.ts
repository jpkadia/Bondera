export interface CalendarDateParts {
  year?: number;
  month?: number;
  day?: number;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const EARLIEST_BIRTH_YEAR = 1900;

const isRealCalendarDate = (year: number, month: number, day: number): boolean => {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const toIsoBirthDate = (
  parts: CalendarDateParts,
  now = new Date()
): string | undefined => {
  const { year, month, day } = parts;

  if (
    !year ||
    !month ||
    !day ||
    year < EARLIEST_BIRTH_YEAR ||
    !isRealCalendarDate(year, month, day)
  ) {
    return undefined;
  }

  const value = `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  const today = `${now.getUTCFullYear().toString().padStart(4, "0")}-${(
    now.getUTCMonth() + 1
  )
    .toString()
    .padStart(2, "0")}-${now.getUTCDate().toString().padStart(2, "0")}`;

  return value <= today ? value : undefined;
};

export const isValidBirthDate = (value: string, now = new Date()): boolean => {
  const match = ISO_DATE_PATTERN.exec(value);

  if (!match) {
    return false;
  }

  return (
    toIsoBirthDate(
      {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3])
      },
      now
    ) === value
  );
};
