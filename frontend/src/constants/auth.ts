export const USERNAME_PATTERN = /^(?!.*\.\.)[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])?$/;

export const normalizeUsernameInput = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 30);

export const USERNAME_REQUIREMENTS =
  "3-30 characters. Use lowercase letters, numbers, periods, or underscores; start and end with a letter or number.";
