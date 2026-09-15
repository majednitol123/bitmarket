import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Extend Express Request type to carry requestId
declare global {
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
    }
  }
}


export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];
  const requestId = (typeof incomingId === 'string' && incomingId.trim())
    ? incomingId.trim().slice(0, 64)
    : `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  req.id = requestId;
  req.startTime = Date.now();
  res.setHeader('X-Request-ID', requestId);
  next();
}
