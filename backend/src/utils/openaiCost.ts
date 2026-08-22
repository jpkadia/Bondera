import { env } from "../config/env";

const MODEL_PRICES_PER_1M: Record<string, { input: number; cachedInput: number; output: number }> = {
  "gpt-5.6-luna": { input: 0.2, cachedInput: 0.02, output: 1.2 },
  "gpt-5.6-terra": { input: 2, cachedInput: 0.2, output: 12 },
  "gpt-5.6-sol": { input: 5, cachedInput: 0.5, output: 30 }
};
const DEFAULT_MODEL_PRICE = { input: 0.2, cachedInput: 0.02, output: 1.2 };

const roundMoney = (value: number): number => Math.round(value * 10000) / 10000;

export const estimateOpenAiCost = ({
  model,
  inputTokens,
  cachedInputTokens,
  outputTokens
}: {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}) => {
  const prices = MODEL_PRICES_PER_1M[model] ?? DEFAULT_MODEL_PRICE;
  const uncachedInputTokens = Math.max(inputTokens - cachedInputTokens, 0);
  const costUsd =
    (uncachedInputTokens / 1_000_000) * prices.input +
    (cachedInputTokens / 1_000_000) * prices.cachedInput +
    (outputTokens / 1_000_000) * prices.output;

  return {
    costUsd: roundMoney(costUsd),
    costInr: roundMoney(costUsd * env.OPENAI_USAGE_USD_TO_INR)
  };
};
