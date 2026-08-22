import type { Response } from "express";
import { env } from "../config/env";
import { OpenAiUsageLogModel } from "../models/OpenAiUsageLog";
import { buildPrivateChatContext } from "../services/aiContext.service";
import { askOpenAiAboutPrivateChats } from "../services/openai.service";
import type { AuthenticatedRequest } from "../types/http";
import { AppError } from "../utils/errors";
import { estimateOpenAiCost } from "../utils/openaiCost";
import type { AskPrivateAiInput } from "../validation/ai.validation";

export const askPrivateAi = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, "AUTH_REQUIRED", "Authentication is required.");
  }

  const { question } = req.body as AskPrivateAiInput;
  const context = await buildPrivateChatContext(req.user.mongoId);
  const result = await askOpenAiAboutPrivateChats(req.user.id, question, context);
  const estimatedCost = estimateOpenAiCost({
    model: env.OPENAI_MODEL,
    inputTokens: result.usage.inputTokens,
    cachedInputTokens: result.usage.cachedInputTokens,
    outputTokens: result.usage.outputTokens
  });

  await OpenAiUsageLogModel.create({
    user: req.user.mongoId,
    model: env.OPENAI_MODEL,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    cachedInputTokens: result.usage.cachedInputTokens,
    totalTokens: result.usage.totalTokens,
    estimatedCostUsd: estimatedCost.costUsd,
    estimatedCostInr: estimatedCost.costInr,
    textMessagesAnalyzed: context.messageWindow.included,
    historyTruncated: context.messageWindow.truncated
  });

  res.status(200).json({
    success: true,
    data: {
      answer: result.answer,
      context: {
        textMessagesAnalyzed: context.messageWindow.included,
        historyTruncated: context.messageWindow.truncated,
        generatedAt: context.generatedAt
      }
    }
  });
};
