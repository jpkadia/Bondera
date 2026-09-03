import type { Server } from "socket.io";

let socketServer: Server | undefined;

export const userRoom = (userId: string): string => `user:${userId}`;

export const setSocketServer = (io: Server): void => {
  socketServer = io;
};

export const clearSocketServer = (): void => {
  socketServer = undefined;
};

export const getSocketServer = (): Server => {
  if (!socketServer) {
    throw new Error("Socket.io has not been initialized.");
  }

  return socketServer;
};

export const isUserOnline = (userId: string): boolean => {
  const room = socketServer?.sockets.adapter.rooms.get(userRoom(userId));
  return Boolean(room?.size);
};

export const isUserActive = (userId: string): boolean => {
  const room = socketServer?.sockets.adapter.rooms.get(userRoom(userId));
  if (!room) return false;
  return [...room].some((socketId) =>
    socketServer?.sockets.sockets.get(socketId)?.data.appActive === true
  );
};

export const emitToUser = (userId: string, event: string, payload: unknown): void => {
  socketServer?.to(userRoom(userId)).emit(event, payload);
};

export const disconnectUserSockets = (userId: string): void => {
  socketServer?.in(userRoom(userId)).disconnectSockets(true);
};
