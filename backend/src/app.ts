import compression from "compression";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import path from "path";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { MulterError } from "multer";
import { env } from "./config/env";
import { apiRouter } from "./routes";
import { AppError } from "./utils/errors";

export const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true
  })
);
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

const adminPublicDirectory = path.resolve(process.cwd(), "public", "admin");

app.get("/admin/vendor/jquery.min.js", (_req: Request, res: Response) => {
  res.sendFile(require.resolve("jquery"));
});
app.get("/admin/vendor/jquery.validate.min.js", (_req: Request, res: Response) => {
  res.sendFile(require.resolve("jquery-validation/dist/jquery.validate.min.js"));
});
app.use(
  "/admin/assets",
  express.static(adminPublicDirectory, {
    index: false,
    maxAge: env.NODE_ENV === "production" ? "1h" : 0
  })
);
app.get("/admin", (_req: Request, res: Response) => {
  res.sendFile(path.join(adminPublicDirectory, "index.html"));
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "bondera-backend",
    timestamp: new Date().toISOString()
  });
});

app.use("/api", apiRouter);

app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(404, "ROUTE_NOT_FOUND", "The requested route does not exist."));
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      code: error.code,
      message: error.message,
      details: error.details
    });
    return;
  }

  if (error instanceof MulterError) {
    const fileTooLarge = error.code === "LIMIT_FILE_SIZE";
    res.status(fileTooLarge ? 413 : 422).json({
      success: false,
      code: fileTooLarge ? "MEDIA_FILE_TOO_LARGE" : "MEDIA_UPLOAD_INVALID",
      message: fileTooLarge
        ? "Each file must be 5MB or smaller."
        : "Upload at most 3 files per message."
    });
    return;
  }

  res.status(500).json({
    success: false,
    code: "INTERNAL_SERVER_ERROR",
    message:
      env.NODE_ENV === "production"
        ? "Something went wrong."
        : error.message
  });
});
