import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

// Regex patterns for crypto asset validation
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const SOLANA_TX_HASH_REGEX = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;

/**
 * Validates whether an address string is a valid Ethereum/EVM address
 */
export function isValidEvmAddress(address?: string): boolean {
  if (!address || typeof address !== 'string') return false;
  return EVM_ADDRESS_REGEX.test(address.trim());
}

/**
 * Validates whether an address string is a valid Solana public key (Base58)
 */
export function isValidSolanaAddress(address?: string): boolean {
  if (!address || typeof address !== 'string') return false;
  return SOLANA_ADDRESS_REGEX.test(address.trim());
}

/**
 * Validates whether an address is valid for the given chain
 */
export function isValidAddressForChain(address: string, chain = 'ethereum'): boolean {
  const normChain = chain.toLowerCase().trim();
  if (normChain === 'solana') {
    return isValidSolanaAddress(address);
  }
  return isValidEvmAddress(address);
}


export function isValidTxHash(hash?: string, chain?: string): boolean {
  if (!hash || typeof hash !== 'string') return false;
  const clean = hash.trim();
  if (chain) {
    const isSolana = ['solana', 'sol'].includes(chain.toLowerCase());
    return isSolana ? SOLANA_TX_HASH_REGEX.test(clean) : EVM_TX_HASH_REGEX.test(clean);
  }
  return EVM_TX_HASH_REGEX.test(clean) || SOLANA_TX_HASH_REGEX.test(clean);
}


export function sanitizeRedisKeySegment(segment: string): string {
  if (!segment || typeof segment !== 'string') return '';
  // Remove glob wildcards (*, ?, [, ]), colons (:), slashes (/ \), dots (.), null bytes, newlines, tabs, and spaces
  return segment
    .replace(/[:*?[\]\r\n\t\0\s./\\]/g, '')
    .slice(0, 128);
}

/**
 * Parses and sanitizes pagination query parameters (page, limit)
 */
export function parsePaginationParams(rawPage?: any, rawLimit?: any, defaultLimit = 20, maxLimit = 100) {
  let page = parseInt(String(rawPage), 10);
  let limit = parseInt(String(rawLimit), 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = defaultLimit;
  else if (limit > maxLimit) limit = maxLimit;

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

/**
 * Middleware: Validates that a route param (or query param) contains a valid wallet address
 */
export function validateWalletParam(paramName = 'address') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rawAddress = (req.params[paramName] || req.query[paramName] || req.body[paramName]) as string | undefined;
    const rawChain = (req.params.chain || req.query.chain || req.body.chain || 'ethereum') as string;

    if (!rawAddress) {
      throw new AppError(`Missing required parameter "${paramName}"`, 400, 'MISSING_ADDRESS');
    }

    const cleanAddress = rawAddress.trim();
    if (!isValidAddressForChain(cleanAddress, rawChain)) {
      throw new AppError(
        `Invalid wallet address "${cleanAddress}" for chain "${rawChain}"`,
        400,
        'INVALID_WALLET_ADDRESS'
      );
    }

    // Pass normalized address
    if (req.params[paramName]) req.params[paramName] = cleanAddress;
    if (req.query[paramName]) req.query[paramName] = cleanAddress;
    if (req.body[paramName]) req.body[paramName] = cleanAddress;

    next();
  };
}

/**
 * Middleware: Validates and sanitizes pagination query parameters (page, limit)
 */
export function validatePagination(defaultLimit = 50, maxLimit = 100) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { page, limit } = parsePaginationParams(req.query.page, req.query.limit, defaultLimit, maxLimit);
    req.query.page = String(page);
    req.query.limit = String(limit);
    next();
  };
}

/**
 * Middleware: Enforces payload size limit for POST/PUT requests
 */
export function checkPayloadLimit(maxBytes = 512 * 1024) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      throw new AppError('Payload size exceeds permitted limit', 413, 'PAYLOAD_TOO_LARGE');
    }
    next();
  };
}
