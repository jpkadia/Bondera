export function displayName(user: { fullName?: string; username: string }) {
  return user.fullName?.trim() || `@${user.username}`;
}

export function initials(user: { fullName?: string; username: string }) {
  const source = user.fullName?.trim() || user.username;
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function relativeTime(value?: string) {
  if (!value) return "";
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function messageTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function seenTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

const calendarDayNumber = (date: Date): number =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;

const validDate = (value: string): Date | undefined => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export function isSameCalendarDay(leftValue: string, rightValue: string): boolean {
  const left = validDate(leftValue);
  const right = validDate(rightValue);
  return Boolean(
    left &&
      right &&
      calendarDayNumber(left) === calendarDayNumber(right),
  );
}

const fullCalendarDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);

export function chatDateLabel(value: string, now = new Date()): string {
  const date = validDate(value);
  if (!date || Number.isNaN(now.getTime())) return "";

  const dayDifference = calendarDayNumber(now) - calendarDayNumber(date);
  if (dayDifference === 0) return "Today";
  if (dayDifference === 1) return "Yesterday";
  return fullCalendarDate(date);
}

export function seenReceiptLabel(value: string, now = new Date()): string {
  const date = validDate(value);
  if (!date || Number.isNaN(now.getTime())) return "";

  const dayDifference = calendarDayNumber(now) - calendarDayNumber(date);
  if (dayDifference === 0) return `Seen at ${seenTime(value)}`;
  if (dayDifference === 1) return "Seen Yesterday";
  return `Seen ${fullCalendarDate(date)}`;
}
