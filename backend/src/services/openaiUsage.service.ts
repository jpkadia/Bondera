import { env } from "../config/env";
import { OpenAiUsageLogModel } from "../models/OpenAiUsageLog";

const DAY_SECONDS = 24 * 60 * 60;

interface DailyOpenAiUsage {
  date: string;
  startTime: number;
  endTime: number;
  costUsd: number;
  costInr: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  requests: number;
}

const toUtcDayStart = (date: Date): number => {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 1000
  );
};

const formatDate = (unixSeconds: number): string => {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
};

const roundMoney = (value: number): number => Math.round(value * 10000) / 10000;

const sum = <T>(items: T[], pick: (item: T) => number): number =>
  items.reduce((total, item) => total + pick(item), 0);

const aggregateByWeek = (daily: DailyOpenAiUsage[]) => {
  const buckets = new Map<string, DailyOpenAiUsage[]>();

  for (const day of daily) {
    const date = new Date(day.startTime * 1000);
    const dayOfWeek = date.getUTCDay();
    const mondayStart = day.startTime - ((dayOfWeek + 6) % 7) * DAY_SECONDS;
    const key = formatDate(mondayStart);
    const existing = buckets.get(key) ?? [];
    existing.push(day);
    buckets.set(key, existing);
  }

  return [...buckets.entries()].map(([weekStart, days]) => {
    const firstDay = days[0];
    const lastDay = days[days.length - 1];

    if (!firstDay) {
      throw new Error("OpenAI weekly usage bucket is empty.");
    }

    return {
      weekStart,
      weekEnd: formatDate((lastDay?.endTime ?? firstDay.endTime) - DAY_SECONDS),
      costUsd: roundMoney(sum(days, (day) => day.costUsd)),
      costInr: roundMoney(sum(days, (day) => day.costInr)),
      inputTokens: sum(days, (day) => day.inputTokens),
      outputTokens: sum(days, (day) => day.outputTokens),
      cachedInputTokens: sum(days, (day) => day.cachedInputTokens),
      requests: sum(days, (day) => day.requests)
    };
  });
};

export const getOpenAiUsageStats = async () => {
  const now = new Date();
  const endTime = toUtcDayStart(now) + DAY_SECONDS;
  const startTime = endTime - 31 * DAY_SECONDS;
  const logs = await OpenAiUsageLogModel.find({
    createdAt: {
      $gte: new Date(startTime * 1000),
      $lt: new Date(endTime * 1000)
    }
  })
    .select(
      "model inputTokens outputTokens cachedInputTokens estimatedCostUsd estimatedCostInr createdAt"
    )
    .lean();
  const logsByDay = new Map<string, typeof logs>();

  for (const log of logs) {
    const day = log.createdAt.toISOString().slice(0, 10);
    const existing = logsByDay.get(day) ?? [];
    existing.push(log);
    logsByDay.set(day, existing);
  }

  const daily: DailyOpenAiUsage[] = [];

  for (let start = startTime; start < endTime; start += DAY_SECONDS) {
    const date = formatDate(start);
    const dayLogs = logsByDay.get(date) ?? [];

    daily.push({
      date,
      startTime: start,
      endTime: start + DAY_SECONDS,
      costUsd: roundMoney(sum(dayLogs, (log) => log.estimatedCostUsd)),
      costInr: roundMoney(sum(dayLogs, (log) => log.estimatedCostInr)),
      inputTokens: sum(dayLogs, (log) => log.inputTokens),
      outputTokens: sum(dayLogs, (log) => log.outputTokens),
      cachedInputTokens: sum(dayLogs, (log) => log.cachedInputTokens),
      requests: dayLogs.length
    });
  }

  const today = daily.at(-1);
  const last7Days = daily.slice(-7);
  const last30Days = daily.slice(-30);

  return {
    model: env.OPENAI_MODEL,
    currency: {
      source: "bondera-local-usage-log",
      costCurrency: "usd",
      displayCurrency: "inr",
      usdToInr: env.OPENAI_USAGE_USD_TO_INR
    },
    balance: {
      available: false,
      message:
        "Balance cannot be read from OpenAI here, but Bondera tracks every Private AI request made through this backend."
    },
    totals: {
      today: {
        costUsd: roundMoney(today?.costUsd ?? 0),
        costInr: roundMoney(today?.costInr ?? 0),
        requests: today?.requests ?? 0,
        inputTokens: today?.inputTokens ?? 0,
        outputTokens: today?.outputTokens ?? 0
      },
      last7Days: {
        costUsd: roundMoney(sum(last7Days, (day) => day.costUsd)),
        costInr: roundMoney(sum(last7Days, (day) => day.costInr)),
        requests: sum(last7Days, (day) => day.requests),
        inputTokens: sum(last7Days, (day) => day.inputTokens),
        outputTokens: sum(last7Days, (day) => day.outputTokens)
      },
      last30Days: {
        costUsd: roundMoney(sum(last30Days, (day) => day.costUsd)),
        costInr: roundMoney(sum(last30Days, (day) => day.costInr)),
        requests: sum(last30Days, (day) => day.requests),
        inputTokens: sum(last30Days, (day) => day.inputTokens),
        outputTokens: sum(last30Days, (day) => day.outputTokens)
      }
    },
    daily,
    weekly: aggregateByWeek(daily),
    generatedAt: new Date().toISOString()
  };
};
