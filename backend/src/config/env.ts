import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().min(1).optional()
);

const candidateEnvFiles = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "..", ".env")
];

for (const envFile of candidateEnvFiles) {
  dotenv.config({ path: envFile, override: false });
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  API_BASE_URL: z.string().url().default("http://localhost:5000"),
  BIRTHDAY_JOB_SECRET: optionalNonEmptyString,
  CLIENT_ORIGIN: z.string().min(1).default("http://localhost:8081"),
  REDIS_URL: z.string().url().optional(),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_USERNAME: z.string().optional(),
  MONGODB_PASSWORD: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be valid"),
  ADMIN_PASSWORD: z
    .string()
    .min(10, "ADMIN_PASSWORD must be at least 10 characters")
    .max(128, "ADMIN_PASSWORD cannot exceed 128 characters"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  GOOGLE_ANDROID_CLIENT_ID: optionalNonEmptyString,
  GOOGLE_IOS_CLIENT_ID: optionalNonEmptyString,
  GOOGLE_PROJECT_ID: optionalNonEmptyString,
  GOOGLE_CALLBACK_URL: z.string().url(),
  BREVO_API_KEY: z.string().min(1, "BREVO_API_KEY is required"),
  BREVO_SENDER_EMAIL: z.string().email("BREVO_SENDER_EMAIL must be valid"),
  BREVO_SENDER_NAME: z.string().min(1).default("Bondera"),
  BREVO_SMTP_USERNAME: z.string().optional(),
  CLOUDINARY_URL: z.string().min(1, "CLOUDINARY_URL is required"),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.6-luna"),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().min(5000).max(120000).default(30000),
  OPENAI_USAGE_USD_TO_INR: z.coerce.number().positive().default(95.7),
  AI_MAX_MESSAGES: z.coerce.number().int().min(1).max(5000).default(1000),
  AI_CONTEXT_CHAR_LIMIT: z.coerce
    .number()
    .int()
    .min(10000)
    .max(500000)
    .default(100000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(100).max(4000).default(1000)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const errors = parsedEnv.error.flatten().fieldErrors;
  throw new Error(`Invalid environment configuration: ${JSON.stringify(errors)}`);
}

export const env = parsedEnv.data;
