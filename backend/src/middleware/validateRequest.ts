import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { AppError } from "../utils/errors";

export const validateBody = (schema: ZodTypeAny) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(
        new AppError(
          422,
          "VALIDATION_ERROR",
          "The request contains invalid data.",
          result.error.flatten().fieldErrors
        )
      );
      return;
    }

    req.body = result.data;
    next();
  };
};

export const validateParams = (schema: ZodTypeAny) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      next(
        new AppError(
          422,
          "VALIDATION_ERROR",
          "The route parameters are invalid.",
          result.error.flatten().fieldErrors
        )
      );
      return;
    }

    req.params = result.data;
    next();
  };
};

export const validateQuery = (schema: ZodTypeAny) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      next(
        new AppError(
          422,
          "VALIDATION_ERROR",
          "The query parameters are invalid.",
          result.error.flatten().fieldErrors
        )
      );
      return;
    }

    Object.assign(req.query, result.data);
    next();
  };
};
