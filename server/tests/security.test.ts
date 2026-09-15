import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidEvmAddress,
  isValidSolanaAddress,
  isValidTxHash,
  sanitizeRedisKeySegment,
  parsePaginationParams,
} from '../src/middleware/validation.middleware';

describe('Security & Validation Middleware', () => {
  describe('EVM Address Validation', () => {
    it('accepts valid 40-hex-character EVM addresses', () => {
      assert.equal(isValidEvmAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'), true);
      assert.equal(isValidEvmAddress('0x0000000000000000000000000000000000000000'), true);
      assert.equal(isValidEvmAddress('0x1234567890abcdef1234567890abcdef12345678'), true);
    });

    it('rejects malformed EVM addresses', () => {
      assert.equal(isValidEvmAddress('0xd8dA6BF'), false); // Too short
      assert.equal(isValidEvmAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045ZZ'), false); // Invalid hex
      assert.equal(isValidEvmAddress('d8dA6BF26964aF9D7eEd9e03E53415D37aA96045'), false); // Missing 0x
      assert.equal(isValidEvmAddress(''), false);
      assert.equal(isValidEvmAddress('   '), false);
    });
  });

  describe('Solana Address Validation', () => {
    it('accepts valid base58 Solana addresses', () => {
      // 32-44 base58 chars without 0, O, I, l
      assert.equal(isValidSolanaAddress('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), true);
      assert.equal(isValidSolanaAddress('So11111111111111111111111111111111111111112'), true);
    });

    it('rejects invalid Solana addresses', () => {
      assert.equal(isValidSolanaAddress('TooShort'), false);
      assert.equal(isValidSolanaAddress('0xInvalidChars00000000000000000000000000000000'), false); // Contains 0
      assert.equal(isValidSolanaAddress('ThisHasInvalidCharsBecauseOfNumberZero0AndO'), false);
      assert.equal(isValidSolanaAddress(''), false);
    });
  });

  describe('Transaction Hash Validation', () => {
    it('accepts valid 32-byte (64 hex) EVM transaction hashes', () => {
      assert.equal(isValidTxHash('0x3a4f89d34e4a0558b9cf80b182d3cd532e8b233a1e9dfae6bb50eb4d7d110825', 'ethereum'), true);
      assert.equal(isValidTxHash('0x3a4f89d34e4a0558b9cf80b182d3cd532e8b233a1e9dfae6bb50eb4d7d110825', 'arbitrum'), true);
    });

    it('accepts valid 64-byte base58 Solana transaction signatures', () => {
      const validSolanaTx = '5VERv8NMvzbJMEdV8xnrLkEaWR439vauBmtcG5VKCH2EiR9564Zavu654rPfqV79tzS1TBnBfBgYeh5A7jz8uRG4';
      assert.equal(isValidTxHash(validSolanaTx, 'solana'), true);
    });

    it('rejects invalid transaction hashes', () => {
      assert.equal(isValidTxHash('0x123', 'ethereum'), false); // Too short
      assert.equal(isValidTxHash('not-a-hash', 'ethereum'), false);
      assert.equal(isValidTxHash('short', 'solana'), false);
      assert.equal(isValidTxHash('', 'ethereum'), false);
    });
  });

  describe('Redis Key Segment Sanitization', () => {
    it('preserves valid alphanumeric characters, hyphens, underscores', () => {
      assert.equal(sanitizeRedisKeySegment('eth0xd8da6bfprices'), 'eth0xd8da6bfprices');
      assert.equal(sanitizeRedisKeySegment('token_123-abc'), 'token_123-abc');
    });

    it('strips dangerous injection characters (colons, newlines, null bytes, wildcards, path traversals, spaces)', () => {
      assert.equal(sanitizeRedisKeySegment('key\r\nSET dangerous 1'), 'keySETdangerous1');
      assert.equal(sanitizeRedisKeySegment('user\0admin'), 'useradmin');
      assert.equal(sanitizeRedisKeySegment('cache:*'), 'cache');
      assert.equal(sanitizeRedisKeySegment('../../../etc/passwd'), 'etcpasswd');
      assert.equal(sanitizeRedisKeySegment('foo:bar:baz'), 'foobarbaz');
    });

    it('truncates excessively long key segments to 128 characters', () => {
      const longString = 'a'.repeat(200);
      const sanitized = sanitizeRedisKeySegment(longString);
      assert.equal(sanitized.length, 128);
    });
  });

  describe('Pagination Validation', () => {
    it('correctly bounds page and limit', () => {
      const res1 = parsePaginationParams('2', '25');
      assert.equal(res1.page, 2);
      assert.equal(res1.limit, 25);
      assert.equal(res1.offset, 25);

      // Defaults and min limits
      const res2 = parsePaginationParams('-5', '0');
      assert.equal(res2.page, 1);
      assert.equal(res2.limit, 20);

      // Max limit cap (100)
      const res3 = parsePaginationParams('1', '500');
      assert.equal(res3.page, 1);
      assert.equal(res3.limit, 100);
    });
  });
});
