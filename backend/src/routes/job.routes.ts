import { Router } from "express";
import { runBirthdayJob } from "../controllers/job.controller";
import { asyncHandler } from "../utils/asyncHandler";

export const jobRouter = Router();

jobRouter.post("/birthdays", asyncHandler(runBirthdayJob));
