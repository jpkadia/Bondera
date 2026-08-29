import { Types } from "mongoose";
import { DeviceInstallationModel } from "../models/DeviceInstallation";

interface ExpoPushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: "birthday" | "messages";
}

interface ExpoPushTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

export const sendPushToUser = async (
  userId: string | Types.ObjectId,
  payload: ExpoPushPayload
): Promise<number> => {
  const installations = await DeviceInstallationModel.find({
    user: userId,
    active: true
  })
    .select("expoPushToken")
    .lean();

  if (installations.length === 0) return 0;

  const messages = installations.map((installation) => ({
    to: installation.expoPushToken,
    sound: "default" as const,
    channelId: payload.channelId ?? "messages",
    priority: "high" as const,
    ttl: 24 * 60 * 60,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {}
  }));
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(messages)
  });

  if (!response.ok) {
    throw new Error(`Expo Push Service returned HTTP ${response.status}.`);
  }

  const result = (await response.json()) as { data?: ExpoPushTicket[] };
  const tickets = result.data ?? [];
  const invalidTokens = tickets.flatMap((ticket, index) =>
    ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered"
      ? [installations[index]?.expoPushToken]
      : []
  ).filter((token): token is string => Boolean(token));

  if (invalidTokens.length > 0) {
    await DeviceInstallationModel.updateMany(
      { expoPushToken: { $in: invalidTokens } },
      { $set: { active: false, invalidatedAt: new Date() } }
    );
  }

  return tickets.filter((ticket) => ticket.status === "ok").length;
};
