import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapCoinMarketCapOverview,
  mapCoinMarketCapCoin,
  mapCoinMarketCapCoinList,
} from '../src/modules/market/market.mapper';
import { coinMarketCapProvider } from '../src/providers/CoinMarketCapProvider';

describe('CoinMarketCap Provider & Mappers', () => {
  it('maps CoinMarketCap global metrics quote accurately', () => {
    const mockOverview = {
      data: {
        quote: {
          USD: {
            total_market_cap: 2800123456789.12,
            total_volume_24h: 120987654321.45,
            total_market_cap_yesterday_percentage_change: 3.5,
            total_volume_24h_yesterday_percentage_change: 12.8,
            last_updated: '2026-09-19T08:00:00.000Z',
          },
        },
        btc_dominance: 58.65,
        btc_dominance_24h_percentage_change: 0.35,
      },
    };

    const overview = mapCoinMarketCapOverview(mockOverview);
    assert.equal(overview.marketCapUsd, 2800123456789.12);
    assert.equal(overview.volume24hUsd, 120987654321.45);
    assert.equal(overview.btcDominancePercent, 58.65);
    assert.equal(overview.marketCapChange24hPercent, 3.5);
    assert.equal(overview.volumeChange24hPercent, 12.8);
    assert.equal(overview.btcDominanceChangePercent, 0.35);
    assert.equal(overview.updatedAt, '2026-09-19T08:00:00.000Z');
  });

  it('maps CoinMarketCap token with 128x128 CDN logo and platform metadata', () => {
    const rawCoin = {
      id: 1027,
      name: 'Ethereum',
      symbol: 'ETH',
      slug: 'ethereum',
      cmc_rank: 2,
      quote: {
        USD: {
          price: 2650.75,
          percent_change_1h: 0.45,
          percent_change_24h: 5.2,
          percent_change_7d: 8.1,
          market_cap: 320000000000,
          volume_24h: 15000000000,
          last_updated: '2026-09-19T08:15:00.000Z',
        },
      },
      tags: ['layer-1', 'pos', 'smart-contracts'],
      platform: null,
    };

    const token = mapCoinMarketCapCoin(rawCoin);
    assert.ok(token);
    assert.equal(token.id, 'ethereum');
    assert.equal(token.symbol, 'ETH');
    assert.equal(token.name, 'Ethereum');
    assert.equal(
      token.logoUrl,
      'https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png'
    );
    assert.equal(token.priceUsd, 2650.75);
    assert.equal(token.change1hPercent, 0.45);
    assert.equal(token.change24hPercent, 5.2);
    assert.equal(token.change1wPercent, 8.1);
    assert.equal(token.marketCapUsd, 320000000000);
    assert.equal(token.volume24hUsd, 15000000000);
    assert.equal(token.rank, 2);
    assert.equal(token.cmcId, 1027);
    assert.deepEqual(token.tags, ['layer-1', 'pos', 'smart-contracts']);
  });

  it('correctly maps token contract address when platform is present', () => {
    const rawToken = {
      id: 825,
      name: 'Tether USDt',
      symbol: 'USDT',
      slug: 'tether',
      cmc_rank: 3,
      platform: {
        id: 1027,
        slug: 'ethereum',
        name: 'Ethereum',
        symbol: 'ETH',
        token_address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      },
      quote: {
        USD: {
          price: 1.0,
          percent_change_1h: 0.0,
          percent_change_24h: 0.01,
          percent_change_7d: 0.02,
          market_cap: 180000000000,
          volume_24h: 80000000000,
        },
      },
      tags: ['stablecoin'],
    };

    const token = mapCoinMarketCapCoin(rawToken);
    assert.ok(token);
    assert.equal(token.contractAddress, '0xdac17f958d2ee523a2206206994597c13d831ec7');
    assert.equal(token.contractAddresses?.length, 1);
    assert.equal(token.contractAddresses?.[0].blockchain, 'ethereum');
    assert.equal(token.contractAddresses?.[0].contractAddress, '0xdac17f958d2ee523a2206206994597c13d831ec7');
  });

  it('CoinMarketCapProvider fetches live market overview successfully', async () => {
    const overview = await coinMarketCapProvider.getMarketOverview();
    assert.ok(overview);
    assert.ok(overview.marketCapUsd > 0);
    assert.ok(overview.volume24hUsd > 0);
    assert.ok(overview.btcDominancePercent > 0);
  });

  it('CoinMarketCapProvider fetches live token listings with CMC 128x128 CDN logo URLs', async () => {
    const res = await coinMarketCapProvider.getCoins({ page: 1, limit: 5 });
    assert.ok(res.tokens.length === 5);
    assert.ok(res.tokens[0].logoUrl.startsWith('https://s2.coinmarketcap.com/static/img/coins/128x128/'));
    assert.ok(res.tokens[0].priceUsd > 0);
  });
});
