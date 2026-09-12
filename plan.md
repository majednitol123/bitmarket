You are a senior React Native + Expo + TypeScript + Redux Toolkit + Node.js + Express.js + PostgreSQL + Redis + Web3 engineer.

I already have a Market screen implemented in my crypto swap aggregator mobile application.

IMPORTANT:
The current Market screen UI is already designed and implemented.

Use the attached Market screen screenshot as the visual reference.

DO NOT redesign the UI.

DO NOT change:
- Layout
- Colors
- Typography
- Spacing
- Cards
- Search UI
- Category tabs
- Bottom navigation
- Token row design
- Swap button design
- Existing visual style
- Existing navigation structure

The goal is to replace mock/fake market data with REAL market data while keeping the existing UI.

==================================================
1. ACTUAL TECHNOLOGY STACK
==================================================

Frontend:

- React Native
- Expo
- TypeScript
- Redux Toolkit
- Existing Redux architecture
- Existing navigation
- Existing API layer

Backend:

- Node.js
- Express.js
- TypeScript if already used by the backend
- PostgreSQL
- Redis
- Existing Web3/blockchain integrations

Blockchain support:

- EVM chains
- Solana

IMPORTANT:

Do NOT replace Express.js with NestJS.

Do NOT replace Redux Toolkit with another state-management library.

Reuse the existing project architecture wherever possible.

==================================================
2. CURRENT MARKET UI
==================================================

The current Market screen contains:

- Markets header
- Connect wallet button
- Market Cap
- 24h Volume
- Market Dominance
- Search by token/symbol
- Categories:
  - All
  - Top Gainers
  - Layer 1
  - DeFi
  - Layer 2
- Token list
- Token logo
- Token symbol
- Token name
- Token price
- 24h percentage change
- Swap button
- Bottom navigation

The current values are mock/fake data.

Replace them with real data.

The screenshot is a UI reference only.

Do not hardcode the screenshot values.

==================================================
3. MAIN GOAL
==================================================

Build a production-ready real Market data system.

The Market screen must display real:

- Token prices
- 24h price changes
- Market cap
- 24h volume
- BTC dominance
- ETH dominance
- Token logos
- Token names
- Token symbols
- Token categories
- Rankings
- Search results
- Top gainers
- Layer 1 tokens
- DeFi tokens
- Layer 2 tokens

Most importantly:

EVERY TOKEN displayed in the Market list must have real price/history data available, subject to the selected provider's coverage.

Do NOT only implement charts for:

- ETH
- BTC
- SOL

If 100 tokens are displayed, the architecture must support real market/history data for all 100 tokens where the provider supports them.

==================================================
4. REAL-TIME / FRESH MARKET DATA
==================================================

This is a critical requirement.

Market prices must use real and fresh market data.

DO NOT use:

- Static prices
- Hardcoded prices
- Random prices
- Fake 24h changes
- Fake market caps
- Fake volume
- Fake dominance

The Market screen should automatically receive updated prices without requiring the user to restart the application.

Use an appropriate real-time/fresh-data strategy.

Preferred architecture:

- Redis short-TTL shared price cache
- Background refresh
- App foreground refresh
- Pull-to-refresh
- Batched provider requests where supported
- Request deduplication
- Redis locking/single-flight

Recommended starting TTL:

Price:
10–30 seconds

Market overview:
30–60 seconds

Token lists:
30–60 seconds

These must be configurable through environment/configuration.

IMPORTANT:

"Real-time" does NOT mean making a separate external API request for every token every second.

Do not aggressively poll.

If the selected provider supports a reliable WebSocket/streaming market-price API and it is appropriate for this application, evaluate using it.

Otherwise implement fresh/near-real-time updates using short-lived Redis caching and background refresh.

The architecture must allow a future WebSocket/streaming implementation without redesigning the Market screen.

==================================================
5. MARKET DATA PROVIDER
==================================================

Use a reliable market-data provider for:

- Token prices
- Market cap
- Volume
- 24h changes
- Historical prices
- Token metadata
- Logos
- Market rankings
- Dominance

If CoinStats is already available in the project and provides the required market data, use CoinStats where appropriate.

Otherwise inspect the existing backend and use the existing market-data provider.

IMPORTANT:

Do not introduce another provider unnecessarily if the project already has a suitable provider.

Create a provider abstraction if useful:

MarketDataProvider

Example implementation:

CoinStatsMarketProvider

The frontend must NEVER call CoinStats or another external provider directly.

Architecture:

React Native / Expo
        |
        v
Redux Toolkit
        |
        v
Express.js API
        |
        +----------------+
        |                |
        v                v
      Redis          Market Provider
        |
        v
   PostgreSQL
   (persistent/
    historical data
    only when required)

==================================================
6. BACKEND ARCHITECTURE
==================================================

Use the existing Express.js project structure.

Follow existing conventions for:

- Routes
- Controllers
- Services
- Repositories
- Middleware
- Validation
- Error handling
- Configuration
- Logging

Do not rewrite the backend architecture unnecessarily.

Possible structure:

src/
  modules/
    market/
      market.routes.ts
      market.controller.ts
      market.service.ts
      market.provider.ts
      market.types.ts
      market.mapper.ts

Adapt to the existing project structure.

==================================================
7. MARKET API
==================================================

Create APIs following the existing Express.js conventions.

Possible endpoints:

GET /api/market/overview

GET /api/market/tokens

GET /api/market/tokens/:tokenId

GET /api/market/tokens/:tokenId/chart?range=1D

GET /api/market/search?q=eth

GET /api/market/gainers

GET /api/market/category/:category

Adapt endpoint names to the existing backend.

Do not create duplicate APIs if equivalent APIs already exist.

==================================================
8. MARKET OVERVIEW
==================================================

The Market header currently displays:

Market Cap
24h Volume
Dominance

Return real values.

Example response:

{
  "marketCapUsd": 0,
  "volume24hUsd": 0,
  "btcDominancePercent": 0,
  "ethDominancePercent": 0,
  "marketCapChange24hPercent": 0,
  "updatedAt": "..."
}

These values are examples only.

DO NOT hardcode:

$2.38T
$68.2B
56.4%

Those are screenshot/mock values.

==================================================
9. TOKEN RESPONSE
==================================================

Normalize provider data into an internal application DTO.

Example:

{
  "id": "...",
  "chain": "ethereum",
  "address": "0x...",
  "symbol": "ETH",
  "name": "Ethereum",
  "logoUrl": "...",
  "priceUsd": 2642.50,
  "change24hPercent": 3.42,
  "marketCapUsd": 0,
  "volume24hUsd": 0,
  "rank": 1,
  "category": "layer1",
  "priceUpdatedAt": "..."
}

Do not expose unnecessary provider-specific fields.

The frontend should depend on our normalized API contract, not CoinStats-specific fields.

==================================================
10. TOKEN IDENTITY
==================================================

DO NOT identify tokens only by symbol.

For example:

USDC can exist on:

Ethereum
Base
Arbitrum
Polygon
Solana

Use canonical identity.

EVM:

chain + contract address

Solana:

chain + mint address

Native asset:

chain + native

Examples:

ethereum:native

base:native

arbitrum:native

polygon:native

solana:native

Avoid token collisions.

==================================================
11. REAL TOKEN CHARTS
==================================================

This is one of the most important requirements.

EVERY TOKEN displayed in the Market list must have real historical price data available where supported by the provider.

Examples:

ETH
BTC
SOL
UNI
ARB
USDC
USDT
etc.

Each token must use its OWN historical data.

DO NOT:

- Reuse ETH chart data for BTC
- Reuse BTC chart data for SOL
- Generate random chart points
- Generate artificial curves
- Hardcode chart values
- Use placeholder production chart data

If a token does not have historical data from the provider:

Return an appropriate unavailable/null state.

Do not fabricate data.

==================================================
12. TOKEN-SPECIFIC CHART API
==================================================

The chart API must be token-specific.

Example:

GET /api/market/tokens/ethereum:native/chart?range=1D

must return ETH history.

GET /api/market/tokens/solana:native/chart?range=1D

must return SOL history.

GET /api/market/tokens/ethereum:0xUNI.../chart?range=1D

must return UNI history.

Never return the same chart for all tokens.

Example response:

{
  "token": {
    "id": "ethereum:native",
    "symbol": "ETH",
    "address": null,
    "chain": "ethereum"
  },
  "range": "1D",
  "points": [
    {
      "timestamp": "2026-09-12T00:00:00Z",
      "priceUsd": 2600.10
    },
    {
      "timestamp": "2026-09-12T01:00:00Z",
      "priceUsd": 2612.50
    }
  ],
  "updatedAt": "..."
}

Use actual provider data.

==================================================
13. CHART TIMEFRAMES
==================================================

Support the architecture for:

- 1H
- 1D
- 1W
- 1M
- 3M
- 1Y
- ALL

If the current UI has fewer timeframe buttons:

DO NOT redesign the UI.

Keep the existing UI while keeping the backend architecture extensible.

Use appropriate provider intervals.

Example:

1H:
high-frequency points where supported

1D:
hourly/intraday points where supported

1W:
appropriate periodic points

1M:
daily/appropriate points

3M:
daily/appropriate points

1Y:
daily/weekly depending on provider

ALL:
provider-supported historical granularity

Do not request unnecessary amounts of data.

==================================================
14. MARKET LIST SPARKLINE
==================================================

If the existing Market UI includes a sparkline or if the current architecture already supports one:

Use lightweight real historical data for each token.

Do NOT load full detailed history for every token when the Market screen opens.

For example:

Market list:

ETH  -> lightweight ETH sparkline
BTC  -> lightweight BTC sparkline
SOL  -> lightweight SOL sparkline
UNI  -> lightweight UNI sparkline

When the user opens a token detail/chart:

Fetch the detailed history only for the selected token.

Do not make hundreds of heavy chart requests unnecessarily.

==================================================
15. MARKET CHART UX
==================================================

Recommended behavior:

Market list:
- Current price
- 24h change
- Optional lightweight sparkline

User selects token:
- Open existing token detail/chart screen if already implemented
- Or use the existing navigation flow
- Display large interactive chart
- Load real historical data for the selected token

Do NOT redesign the current Market screen to accomplish this.

==================================================
16. REDUX TOOLKIT
==================================================

The frontend uses Redux Toolkit.

Reuse the existing Redux architecture.

DO NOT replace Redux Toolkit with:

- Zustand
- MobX
- Recoil
- Context-only state management
- Another state library

Create/use an appropriate market slice.

Example:

marketSlice

Possible state:

{
  overview,
  tokens,
  selectedCategory,
  searchQuery,
  searchResults,
  selectedToken,
  charts,
  loading,
  refreshing,
  error,
  pagination
}

Use Redux Toolkit best practices.

If the project already uses createAsyncThunk, RTK Query, or another Redux Toolkit pattern:

Reuse the existing pattern.

DO NOT introduce RTK Query if the existing project has a different established architecture unless there is a strong reason.

==================================================
17. REDUX DATA FLOW
==================================================

Recommended flow:

React Native screen
        |
        v
Redux Toolkit
        |
        v
Existing API service
        |
        v
Express.js
        |
        v
Redis
        |
        v
Market Provider

The screen should not directly call CoinStats.

Keep API/data-fetching logic outside React components.

==================================================
18. SEARCH
==================================================

The existing UI contains:

"Search by token or symbol..."

Implement real search.

Support:

- Token name
- Symbol
- Address where appropriate

Examples:

ETH
Ethereum

BTC
Bitcoin

SOL
Solana

UNI
Uniswap

Search must be debounced.

Recommended debounce:

250–400ms

Do not send an API request on every keystroke.

Reuse any existing debounce utility.

==================================================
19. CATEGORY FILTERS
==================================================

Implement the existing categories:

All
Top Gainers
Layer 1
DeFi
Layer 2

Use real data.

Do not create fake categories.

If the provider provides category metadata:

Use it.

If provider category metadata is unavailable:

Use a controlled internal token/category mapping.

Do not randomly classify tokens.

==================================================
20. TOP GAINERS
==================================================

Top Gainers must use real 24h percentage changes.

Sort using real data.

Handle:

- Missing price
- Missing 24h change
- Missing metadata

Do not fabricate values.

==================================================
21. PAGINATION
==================================================

Do not return unlimited tokens.

Example:

GET /api/market/tokens?page=1&limit=50

Enforce a maximum limit.

If the existing UI uses infinite scrolling:

Implement pagination/infinite loading using Redux Toolkit and the existing UI.

Do not load thousands of tokens at once.

==================================================
22. REDIS CACHE
==================================================

Use Redis for frequently changing market data.

Suggested keys:

market:overview

market:tokens:all

market:tokens:gainers

market:tokens:layer1

market:tokens:defi

market:tokens:layer2

market:search:{query}

market:price:{chain}:{tokenAddress}

market:chart:{tokenId}:{range}

Use configurable TTLs.

Suggested starting values:

Overview:
30–60 seconds

Token list:
30–60 seconds

Price:
10–30 seconds

Lightweight sparkline:
1–5 minutes

Detailed chart:
1–5 minutes depending on timeframe

Do not hardcode TTL values throughout the code.

Use environment/configuration.

==================================================
23. SHARED PRICE CACHE
==================================================

Do NOT request the same token price separately for every user.

Example:

100 users view ETH.

Do not make 100 external ETH price requests.

Use:

market:price:ethereum:native

Similarly:

market:price:{chain}:{tokenAddress}

Prices should be shared across users.

==================================================
24. CACHE STAMPEDE PROTECTION
==================================================

Protect the external provider from duplicate requests.

If 100 requests arrive while a cache is expired:

Only one request should refresh the provider.

Use:

- Redis distributed lock
- Single-flight
- Request deduplication

Examples:

lock:market:overview

lock:market:tokens

lock:market:chart:{tokenId}:{range}

==================================================
25. STALE-WHILE-REVALIDATE
==================================================

Where practical:

If slightly stale cached data exists:

1. Return cached data immediately.
2. Refresh data in background.
3. Update Redis.
4. Future requests receive fresh data.

The Market screen should feel fast.

==================================================
26. REAL-TIME PRICE UPDATE STRATEGY
==================================================

The frontend should not continuously fetch every token independently.

Use backend-controlled freshness.

Recommended:

1. User opens Market screen.
2. Redux requests market data.
3. Express checks Redis.
4. If cache is fresh:
   return cached data.
5. If cache is stale:
   return stale data if acceptable.
6. Background refresh gets fresh provider data.
7. Redis is updated.
8. Frontend receives/requests updated data.
9. UI updates without redesign.

When app returns to foreground:

Refresh if data is older than the configured freshness threshold.

Pull-to-refresh should trigger a refresh.

==================================================
27. OPTIONAL STREAMING ARCHITECTURE
==================================================

If the market-data provider supports WebSocket/streaming prices:

Evaluate whether it is appropriate.

If implemented:

- Backend owns provider WebSocket connections.
- React Native does NOT directly connect to the external provider.
- Backend can broadcast normalized price updates to clients if the existing app architecture supports it.
- Do not create one provider connection per user.
- Reuse provider connections where possible.

If streaming is not necessary:

Use short-TTL Redis caching and background refresh.

Do not over-engineer the first implementation.

==================================================
28. MARKET OVERVIEW REFRESH
==================================================

Market overview values must be real and fresh:

- Market cap
- 24h volume
- BTC dominance
- ETH dominance
- Market cap 24h change

Do not calculate dominance incorrectly from the limited tokens displayed in the UI.

Use provider/global market data where available.

==================================================
29. POSTGRESQL
==================================================

PostgreSQL should NOT store every price tick.

Use PostgreSQL only for persistent data/history when required.

If historical market snapshots are required:

Create something similar to:

market_price_snapshots

Fields:

- id
- tokenId
- chain
- tokenAddress
- priceUsd
- marketCapUsd
- volume24hUsd
- timestamp

Add indexes based on actual query patterns.

Do not write every 10-second price update to PostgreSQL.

Redis handles short-lived current data.

PostgreSQL handles persistent historical data.

==================================================
30. MARKET DATA HISTORY
==================================================

Prefer the provider's historical API for historical chart data when available.

If the provider's historical coverage is insufficient and the application requires persistent history:

Use PostgreSQL snapshots.

Do not silently fabricate historical values.

Clearly distinguish:

provider historical data

from:

application-collected historical snapshots.

==================================================
31. FRONTEND API SERVICE
==================================================

Use the existing Expo/React Native API service.

Do not put fetch/axios logic directly into UI components if the project already has a service layer.

Create/use functions similar to:

getMarketOverview()

getMarketTokens()

getMarketToken(tokenId)

getMarketTokenChart(tokenId, range)

searchMarketTokens(query)

getMarketGainers()

getMarketCategory(category)

Adapt names to the existing codebase.

==================================================
32. MARKET SCREEN MAPPING
==================================================

The existing UI should continue receiving the same view-model structure where possible.

Create an adapter if needed:

mapMarketResponseToScreenModel()

Do not rewrite UI components just because backend DTOs differ.

Backend provides normalized real data.

Mapper adapts it to the existing UI.

==================================================
33. LOADING STATES
==================================================

Support:

- Initial loading
- Search loading
- Category loading
- Pagination loading
- Chart loading
- Pull-to-refresh
- Background refresh

During background refresh:

Do NOT blank the existing valid data.

Keep the current data visible while refreshing.

==================================================
34. ERROR HANDLING
==================================================

Handle:

- Provider timeout
- Provider rate limit
- Provider unavailable
- Redis failure
- Invalid token
- Missing chart data
- Unsupported token
- Network error
- Backend error

Never show fake data after an error.

If a price cannot be loaded:

Use a proper null/loading/error state.

Do not display:

$0

unless the real price is actually zero.

==================================================
35. TOKEN DATA SAFETY
==================================================

Wallet/market providers may return:

- Spam tokens
- Scam tokens
- Dust tokens
- Unknown tokens
- Tokens without logos
- Tokens without prices
- Tokens with incomplete metadata

Do not blindly display every token.

Do not fabricate:

- Name
- Logo
- Price
- Market cap
- Chart
- Value

==================================================
36. MULTI-CHAIN
==================================================

Market data must support the project's existing EVM + Solana ecosystem.

EVM:

chain + contract address

Solana:

chain + mint address

Native:

chain + native

Do not assume every token is EVM.

==================================================
37. SWAP BUTTON
==================================================

The existing Swap button must continue working.

DO NOT redesign it.

When the user taps Swap for a token:

Pass the correct canonical token identity into the existing swap screen.

Examples:

ETH:
ethereum:native

USDC:
ethereum:0x...

SOL:
solana:native

SPL token:
solana:<mint>

Do not rely on symbol alone.

==================================================
38. SWAP INTEGRATION
==================================================

Do not rewrite the existing swap aggregator.

Only ensure the Market screen passes correct token information to the existing swap flow.

If the existing swap screen requires:

- chain
- token address
- symbol
- decimals

provide the correct values.

==================================================
39. PERFORMANCE
==================================================

Avoid:

- N+1 requests
- One external price request per token
- One chart request per token unnecessarily
- Duplicate provider calls
- Huge API responses
- Unlimited pagination
- Excessive polling
- Re-fetching on every React render
- Redux state duplication
- Unnecessary component re-renders

Use:

- Redis
- Batching
- Pagination
- Cache
- Request deduplication
- Background refresh
- Memoized selectors where useful
- Proper Redux state normalization where appropriate

==================================================
40. REDUX PERFORMANCE
==================================================

Do not store massive historical chart datasets globally unless needed.

For example:

The detailed chart for one selected token can be stored by:

tokenId + range

rather than duplicating the same data.

Avoid unnecessary Redux updates when only one token price changes.

Use selectors efficiently.

==================================================
41. SECURITY
==================================================

External API keys must remain on the backend.

NEVER expose:

- CoinStats API key
- Provider API key
- Redis credentials
- PostgreSQL credentials
- Internal infrastructure credentials

React Native only communicates with our Express.js backend.

==================================================
42. ENVIRONMENT VARIABLES
==================================================

Use environment variables for:

- Market provider API key
- Redis URL
- PostgreSQL URL
- Cache TTLs
- Provider configuration
- Other backend secrets

Never commit secrets to Git.

Update the existing environment/configuration system rather than creating a second configuration mechanism.

==================================================
43. TESTING
==================================================

Add tests following the existing project testing framework.

Test:

Market overview:
- Market cap
- Volume
- BTC dominance
- ETH dominance
- 24h change

Token list:
- Pagination
- Sorting
- Categories

Search:
- Symbol
- Name
- Address

Charts:
- ETH chart
- BTC chart
- SOL chart
- ERC-20 chart
- SPL token chart
- 1H
- 1D
- 1W
- 1M
- 3M
- 1Y
- ALL

Important chart test:

Ensure ETH does NOT receive BTC chart data.

Ensure BTC does NOT receive ETH chart data.

Ensure each tokenId maps to its own historical dataset.

Caching:
- Cache hit
- Cache miss
- Expiration
- Concurrent refresh
- Redis lock
- Stale-while-revalidate

Errors:
- Provider error
- Timeout
- Rate limit
- Missing price
- Missing chart

Redux:
- Initial loading
- Successful data
- Refresh
- Search
- Category switching
- Pagination
- Chart loading
- Error state

==================================================
44. NO MOCK DATA
==================================================

Production Market data must contain NO:

- Fake prices
- Fake market cap
- Fake volume
- Fake dominance
- Fake 24h changes
- Fake token rankings
- Fake chart data
- Random chart values
- Hardcoded token balances
- Screenshot values

Mocks are allowed only inside tests.

==================================================
45. NO HARDCODED SCREENSHOT VALUES
==================================================

The screenshot may contain values such as:

$2.38T
$68.2B
BTC 56.4%
ETH 14.8%
$2,642.50
$63,120
$138.45
$7.85
$0.58

These are UI examples only.

DO NOT use them as production values.

==================================================
46. APP FOREGROUND REFRESH
==================================================

When the Expo application returns to the foreground:

Check the freshness of market data.

If data is stale:

Refresh it.

Do not aggressively refresh if the data is still fresh.

Reuse the existing Expo/React Native app lifecycle implementation if available.

==================================================
47. PULL TO REFRESH
==================================================

Implement or connect the existing pull-to-refresh behavior.

Refresh:

- Market overview
- Token prices
- Token list
- Relevant category

Do not unnecessarily reload every historical chart.

==================================================
48. MARKET SCREEN UI PRESERVATION
==================================================

The existing Market screen screenshot is the visual source of truth.

DO NOT redesign it.

DO NOT change:

- Header
- Search box
- Category buttons
- Token cards
- Swap buttons
- Bottom navigation
- Typography
- Colors
- Spacing
- Existing animations
- Existing icons

Only connect real data to the existing UI.

If a real value is unavailable:

Use an appropriate existing loading/null/empty state.

Never invent a value.

==================================================
49. IMPLEMENTATION PROCESS
==================================================

Before changing any code:

1. Inspect the existing Expo project.
2. Inspect the Market screen.
3. Find all mock/fake market data.
4. Inspect Redux Toolkit slices.
5. Inspect Redux store configuration.
6. Inspect existing API services.
7. Inspect existing Express.js routes.
8. Inspect Express controllers/services.
9. Inspect existing Redis implementation.
10. Inspect PostgreSQL schema/ORM.
11. Inspect existing Web3/token models.
12. Inspect existing chain configuration.
13. Inspect existing swap flow.
14. Inspect existing navigation.
15. Inspect existing testing setup.

Then implement incrementally.

Do not rewrite unrelated functionality.

Reuse existing components, services, utilities, Redux slices, API clients, and configuration wherever possible.

==================================================
50. CODE QUALITY
==================================================

Follow the existing project's:

- TypeScript conventions
- ESLint configuration
- Prettier configuration
- Naming conventions
- Folder structure
- Error-handling patterns
- API response patterns
- Redux patterns
- Testing patterns

Do not introduce unnecessary dependencies.

If a dependency is required:

Explain why before adding it.

==================================================
51. FINAL VALIDATION
==================================================

Verify all of the following:

[ ] Market UI remains unchanged.

[ ] Mock market data removed from production flow.

[ ] Real token prices work.

[ ] Real-time/fresh price updates work.

[ ] Prices refresh without restarting the app.

[ ] Pull-to-refresh works.

[ ] App foreground refresh works.

[ ] Real 24h changes work.

[ ] Real market cap works.

[ ] Real volume works.

[ ] Real BTC dominance works.

[ ] Real ETH dominance works.

[ ] Search works.

[ ] Search is debounced.

[ ] All category filters work.

[ ] Top Gainers uses real data.

[ ] Pagination works.

[ ] Every displayed token can retrieve its own real historical chart data where supported.

[ ] ETH chart works.

[ ] BTC chart works.

[ ] SOL chart works.

[ ] ERC-20 charts work.

[ ] SPL charts work.

[ ] Different chart timeframes work.

[ ] No token receives another token's chart.

[ ] No fake chart data exists in production.

[ ] Lightweight sparkline data is efficient if required by existing UI.

[ ] Detailed chart data loads only when necessary.

[ ] Redis caching works.

[ ] Shared price cache works.

[ ] Chart caching works.

[ ] Cache stampede protection exists.

[ ] Stale-while-revalidate works where appropriate.

[ ] Redux Toolkit integration works.

[ ] Existing Redux architecture is preserved.

[ ] Express.js architecture is preserved.

[ ] PostgreSQL is not unnecessarily written on every price tick.

[ ] Multi-chain token identity works.

[ ] EVM token identity works.

[ ] Solana token identity works.

[ ] Swap buttons continue working.

[ ] Correct token identity is passed to Swap.

[ ] API keys remain backend-only.

[ ] No secrets are exposed to Expo.

[ ] TypeScript passes.

[ ] ESLint passes.

[ ] Tests pass.

[ ] Existing navigation continues working.

[ ] Existing swap functionality continues working.

==================================================
52. FINAL DELIVERABLE
==================================================

Actually inspect and implement the existing codebase.

Do NOT only explain the implementation.

At the end provide:

1. Files created
2. Files modified
3. Redux slices/actions/thunks/selectors changed
4. Express routes created/modified
5. Controllers/services created/modified
6. Market provider integration
7. API endpoints
8. Redis keys
9. Redis TTLs
10. Cache strategy
11. Real-time/fresh-price strategy
12. Chart/history implementation
13. PostgreSQL changes/migrations
14. Frontend changes
15. Swap integration changes
16. Tests added
17. Required environment variables
18. Commands required to run migrations/build/test
19. Any limitations
20. Any provider-specific limitations

==================================================
PRIMARY REQUIREMENTS
==================================================

1. REAL MARKET DATA.

2. REAL/FRESH MARKET PRICES.

3. REAL 24H CHANGES.

4. REAL MARKET CAP.

5. REAL MARKET VOLUME.

6. REAL BTC/ETH DOMINANCE.

7. REAL TOKEN METADATA.

8. REAL HISTORICAL CHART DATA.

9. EVERY DISPLAYED TOKEN MUST HAVE ITS OWN CHART/HISTORY DATA WHERE PROVIDER SUPPORTS IT.

10. NO FAKE OR RANDOM CHART DATA.

11. EVM + SOLANA SUPPORT.

12. REDIS SHARED PRICE CACHE.

13. REDIS CACHE-STAMPEDE PROTECTION.

14. REDUX TOOLKIT FRONTEND INTEGRATION.

15. EXPRESS.JS BACKEND.

16. POSTGRESQL FOR PERSISTENT/HISTORICAL DATA WHERE REQUIRED.

17. EXISTING SWAP FLOW MUST CONTINUE WORKING.

18. DO NOT EXPOSE EXTERNAL API KEYS TO EXPO.

19. DO NOT REDESIGN THE EXISTING MARKET UI.

20. INSPECT THE EXISTING CODEBASE FIRST AND IMPLEMENT INCREMENTALLY.