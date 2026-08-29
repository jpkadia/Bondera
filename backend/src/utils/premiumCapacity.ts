export const hasPremiumCapacity = (
  currentPremiumCount: number,
  maximumPremiumUsers: number
): boolean =>
  Number.isInteger(currentPremiumCount) &&
  Number.isInteger(maximumPremiumUsers) &&
  currentPremiumCount >= 0 &&
  maximumPremiumUsers > 0 &&
  currentPremiumCount < maximumPremiumUsers;
