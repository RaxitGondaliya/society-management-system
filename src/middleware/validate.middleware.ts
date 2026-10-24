import { Request, Response, NextFunction } from "express";
import { ZodType, ZodError } from "zod";
import { errorResponse } from "../utils/apiResponse";

export interface RequestValidationSchema {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export const validate = (schema: RequestValidationSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        const parsedQuery = await schema.query.parseAsync(req.query);
        try {
          req.query = parsedQuery as typeof req.query;
        } catch {
          Object.assign(req.query, parsedQuery);
        }
      }
      if (schema.params) {
        const parsedParams = await schema.params.parseAsync(req.params);
        try {
          req.params = parsedParams as typeof req.params;
        } catch {
          Object.assign(req.params, parsedParams);
        }
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = (error.issues || []).map((issue) => ({
          field: issue.path.join(".") || "root",
          message: issue.message,
        }));

        errorResponse(res, "Validation Error", 400, formattedErrors);
        return;
      }
      next(error);
    }
  };
};
