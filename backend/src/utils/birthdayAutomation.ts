const ISO_BIRTH_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  localDate: string;
}

export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
};

export const localDateTimeParts = (
  value: Date,
  timeZone: string
): LocalDateTimeParts => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = read("year");
  const month = read("month");
  const day = read("day");

  return {
    year,
    month,
    day,
    hour: read("hour"),
    minute: read("minute"),
    localDate: `${year.toString().padStart(4, "0")}-${month
      .toString()
      .padStart(2, "0")}-${day.toString().padStart(2, "0")}`
  };
};

export const birthdayDueAtLocalMidnight = (
  birthDate: string,
  timeZone: string,
  now: Date
): LocalDateTimeParts | undefined => {
  const birth = ISO_BIRTH_DATE.exec(birthDate);
  if (!birth || !isValidTimeZone(timeZone)) return undefined;

  const local = localDateTimeParts(now, timeZone);
  return local.hour === 0 &&
    local.month === Number(birth[2]) &&
    local.day === Number(birth[3])
    ? local
    : undefined;
};

export const birthdayMessageClientId = (
  birthdayUserId: string,
  localDate: string
): string => `birthday:${localDate}:${birthdayUserId}`;
