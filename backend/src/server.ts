import http from "http";
import { app } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./database/mongoose";
import {
  startCloudinaryCleanupWorker,
  stopCloudinaryCleanupWorker
} from "./services/cloudinaryCleanup.service";
import {
  closeSocketServer,
  initializeSocketServer
} from "./socket/socketServer";

const server = http.createServer(app);

const startServer = async (): Promise<void> => {
  await connectDatabase();
  startCloudinaryCleanupWorker();
  await initializeSocketServer(server);

  server.listen(env.PORT, () => {
    console.log(`Bondera API listening on port ${env.PORT}`);
  });
};

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  console.log(`${signal} received. Closing Bondera API.`);
  stopCloudinaryCleanupWorker();
  await closeSocketServer();

  if (server.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  await disconnectDatabase();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void startServer().catch((error) => {
  console.error("Failed to start Bondera API.", error);
  process.exit(1);
});
