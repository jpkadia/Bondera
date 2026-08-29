import type { Response } from "express";
import { Types } from "mongoose";
import { env } from "../config/env";
import { AiConversationModel } from "../models/AiConversation";
import { AiTurnModel } from "../models/AiTurn";
import { OpenAiUsageLogModel } from "../models/OpenAiUsageLog";
import { buildPrivateChatContext } from "../services/aiContext.service";
import { askOpenAiAboutPrivateChats } from "../services/openai.service";
import type { AuthenticatedRequest } from "../types/http";
import { AppError } from "../utils/errors";
import { estimateOpenAiCost } from "../utils/openaiCost";
import type { AskPrivateAiInput } from "../validation/ai.validation";

const serializeTurn = (turn: {
  _id: Types.ObjectId;
  question: string;
  answer: string;
  textMessagesAnalyzed: number;
  historyTruncated: boolean;
  createdAt: Date;
}) => ({
  id: turn._id.toString(),
  question: turn.question,
  answer: turn.answer,
  textMessagesAnalyzed: turn.textMessagesAnalyzed,
  historyTruncated: turn.historyTruncated,
  createdAt: turn.createdAt
});

const loadConversationView = async (
  userId: Types.ObjectId,
  conversationId: Types.ObjectId
) => {
  const [conversation, turns] = await Promise.all([
    AiConversationModel.findOne({ _id: conversationId, user: userId }).lean(),
    AiTurnModel.find({ conversation: conversationId, user: userId })
      .sort({ createdAt: 1, _id: 1 })
      .lean()
  ]);

  if (!conversation) {
    throw new AppError(404, "AI_CONVERSATION_NOT_FOUND", "AI conversation was not found.");
  }

  return {
    id: conversation._id.toString(),
    title: conversation.title,
    turns: turns.map(serializeTurn),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  };
};

export const listAiConversations = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, "AUTH_REQUIRED", "Authentication is required.");
  }

  const conversations = await AiConversationModel.find({ user: req.user.mongoId })
    .sort({ updatedAt: -1, _id: -1 })
    .lean();
  const conversationIds = conversations.map((conversation) => conversation._id);
  const turns = await AiTurnModel.find({
    user: req.user.mongoId,
    conversation: { $in: conversationIds }
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  const turnsByConversation = new Map<string, ReturnType<typeof serializeTurn>[]>();

  for (const turn of turns) {
    const key = turn.conversation.toString();
    const items = turnsByConversation.get(key) ?? [];
    items.push(serializeTurn(turn));
    turnsByConversation.set(key, items);
  }

  res.status(200).json({
    success: true,
    data: {
      conversations: conversations.map((conversation) => ({
        id: conversation._id.toString(),
        title: conversation.title,
        turns: turnsByConversation.get(conversation._id.toString()) ?? [],
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      }))
    }
  });
};

export const askPrivateAi = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, "AUTH_REQUIRED", "Authentication is required.");
  }

  const { conversationId, question } = req.body as AskPrivateAiInput;
  let conversation = conversationId
    ? await AiConversationModel.findOne({
        _id: conversationId,
        user: req.user.mongoId
      })
    : null;

  if (conversationId && !conversation) {
    throw new AppError(404, "AI_CONVERSATION_NOT_FOUND", "AI conversation was not found.");
  }

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

  let createdConversation = false;
  if (!conversation) {
    conversation = await AiConversationModel.create({
      user: req.user.mongoId,
      title: question.slice(0, 48)
    });
    createdConversation = true;
  }

  try {
    await AiTurnModel.create({
      conversation: conversation._id,
      user: req.user.mongoId,
      question,
      answer: result.answer,
      textMessagesAnalyzed: context.messageWindow.included,
      historyTruncated: context.messageWindow.truncated
    });
    conversation.updatedAt = new Date();
    await conversation.save();
  } catch (error) {
    if (createdConversation) {
      await AiConversationModel.deleteOne({ _id: conversation._id });
    }
    throw error;
  }

  const conversationView = await loadConversationView(
    req.user.mongoId,
    conversation._id
  );

  res.status(200).json({
    success: true,
    data: {
      answer: result.answer,
      context: {
        textMessagesAnalyzed: context.messageWindow.included,
        historyTruncated: context.messageWindow.truncated,
        generatedAt: context.generatedAt
      },
      conversation: conversationView
    }
  });
};

export const deleteAiConversation = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, "AUTH_REQUIRED", "Authentication is required.");
  }

  const conversationId = req.params.conversationId!;
  const conversation = await AiConversationModel.findOneAndDelete({
    _id: conversationId,
    user: req.user.mongoId
  });

  if (!conversation) {
    throw new AppError(404, "AI_CONVERSATION_NOT_FOUND", "AI conversation was not found.");
  }

  await AiTurnModel.deleteMany({
    conversation: conversation._id,
    user: req.user.mongoId
  });

  res.status(200).json({
    success: true,
    data: { conversationId: conversation._id.toString() }
  });
};
