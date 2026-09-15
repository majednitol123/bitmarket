import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isAppError = err instanceof AppError;
  const statusCode = (err as AppError).statusCode || 500;
  const code = (err as AppError).code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');
  const rawMessage = err.message || 'An unexpected error occurred';
  const details = (err as AppError).details;
  const requestId = req.id;

  // In production, never leak internal 500 server stack traces or database errors
  const safeMessage = (config.isProduction && statusCode >= 500 && !isAppError)
    ? 'An internal server error occurred'
    : rawMessage;

  if (statusCode >= 500) {
    console.error(`[Error] [${requestId || 'no-id'}] ${req.method} ${req.originalUrl} (${statusCode}):`, err);
  } else {
    console.warn(`[Warning] [${requestId || 'no-id'}] ${req.method} ${req.originalUrl} (${statusCode}):`, rawMessage);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: safeMessage,
      ...(details ? { details } : {}),
      ...(requestId ? { requestId } : {}),
    },
  });
}
