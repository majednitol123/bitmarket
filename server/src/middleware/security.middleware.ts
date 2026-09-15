import { Request, Response, NextFunction } from 'express';
import { CorsOptions } from 'cors';
import { config } from '../config/env';

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Remove Express footprint
  res.removeHeader('X-Powered-By');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Clickjacking protection: disallow iframe embedding
  res.setHeader('X-Frame-Options', 'DENY');

  // Cross-Site Scripting protection filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Strict Transport Security (HSTS) - only in production or over HTTPS
  if (config.isProduction || req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Content Security Policy for API servers (pure JSON responses, no active scripts)
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

  // Prevent DNS prefetching
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // Internet Explorer download options
  res.setHeader('X-Download-Options', 'noopen');

  next();
}

/**
 * Sanitizes input bodies and queries:
 * - Blocks prototype pollution keys (__proto__, constructor, prototype)
 * - Strips dangerous null-byte injections (\0)
 */
export function sanitizeRequestInputs(req: Request, res: Response, next: NextFunction): void {
  try {
    if (req.body && typeof req.body === 'object') {
      cleanObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      cleanObject(req.query);
    }
    if (req.params && typeof req.params === 'object') {
      cleanObject(req.params);
    }
    next();
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid characters or malformed request payload',
      },
    });
  }
}

function cleanObject(obj: any, depth = 0): void {
  if (!obj || typeof obj !== 'object' || depth > 8) return;

  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      delete obj[key];
      continue;
    }

    const val = obj[key];
    if (typeof val === 'string') {
      // Strip null bytes
      if (val.includes('\0')) {
        obj[key] = val.replace(/\0/g, '');
      }
    } else if (typeof val === 'object') {
      cleanObject(val, depth + 1);
    }
  }
}

/**
 * Configures CORS based on environment
 */
export function getCorsOptions(): CorsOptions {
  if (config.corsOrigin === '*' || !config.isProduction) {
    return {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'If-None-Match'],
      exposedHeaders: ['ETag', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After', 'X-Request-ID'],
    };
  }

  const allowed = config.corsOrigin.split(',').map((o) => o.trim());
  return {
    origin: (origin, callback) => {
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'If-None-Match'],
    exposedHeaders: ['ETag', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After', 'X-Request-ID'],
  };
}
