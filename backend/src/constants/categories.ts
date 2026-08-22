export const CONTACT_CATEGORIES = ["Family", "Friends", "Professional"] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

