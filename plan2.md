You are a senior React Native + Expo + TypeScript + Redux Toolkit + Node.js + Express.js + PostgreSQL + Redis + Web3 engineer.

I already have a Portfolio screen implemented in my crypto swap aggregator mobile application.

The attached Portfolio screenshot is the visual reference for the existing UI.

==================================================
IMPORTANT — DO NOT REDESIGN THE UI
==================================================

The Portfolio UI is already designed and implemented.

DO NOT redesign it.

DO NOT change:

- Layout
- Colors
- Typography
- Font sizes
- Spacing
- Cards
- Borders
- Shadows
- Chart design
- Network selector
- Holdings tabs
- DeFi Yield tab
- Swap History tab
- Swap buttons
- Bottom navigation
- Existing icons
- Existing animations
- Existing visual style
- Existing navigation structure

The only goal is:

REPLACE MOCK/FAKE PORTFOLIO DATA WITH REAL WALLET, BLOCKCHAIN, MARKET, TRANSACTION AND HISTORICAL DATA.

Reuse the existing UI components whenever possible.

Do not rewrite unrelated parts of the application.

==================================================
1. ACTUAL TECHNOLOGY STACK
==================================================

Frontend:

- React Native
- Expo
- TypeScript
- Redux Toolkit
- Existing Redux store
- Existing Redux slices
- Existing navigation
- Existing API/service layer

Backend:

- Node.js
- Express.js
- TypeScript if already used by the existing backend
- PostgreSQL
- Redis
- Existing Web3/blockchain integrations

Blockchain:

- EVM networks
- Solana

IMPORTANT:

DO NOT replace Express.js with NestJS.

DO NOT replace Redux Toolkit with another state-management library.

Reuse the existing project architecture.

==================================================
2. CURRENT PORTFOLIO SCREEN
==================================================

The current Portfolio screen contains:

- Portfolio header
- Network selector
- Portfolio total value
- Portfolio chart
- Line/Candles controls
- MA(7)
- MA(25)
- Volume
- 24h High
- 24h Low
- Chart timeframe selector
- 1D
- 1W
- 1M
- 1Y
- ALL
- Swap Tokens button
- Holdings tab
- DeFi Yield tab
- Swap History tab
- Token holdings
- Token balance
- Token value
- Token price
- 24h change
- Swap button
- Bottom navigation

The existing data is mock/fake.

Replace the underlying data source with real data.

==================================================
3. PRIMARY GOAL
==================================================

Build a production-ready real Portfolio data system.

The Portfolio must display real:

- Wallet balance
- Native token balance
- ERC-20 holdings
- SPL holdings
- Token prices
- Token values
- Portfolio total value
- Portfolio allocation
- 24h token changes
- Portfolio 24h change
- Historical portfolio value
- Portfolio chart
- DeFi positions where supported
- Blockchain transactions
- Swap history
- Real token metadata
- Real token logos

Support:

EVM

and

Solana

==================================================
4. SOURCE OF TRUTH
==================================================

The blockchain wallet state is the ultimate source of truth.

CoinStats or another indexing/data provider is only a:

- Data provider
- Blockchain indexing provider
- Portfolio data provider
- Market price provider

The provider is NOT the source of truth over the blockchain.

After a swap:

DO NOT manually modify wallet balances.

WRONG:

balance -= soldAmount

balance += receivedAmount

CORRECT:

1. Submit the swap transaction.
2. Store the transaction hash.
3. Wait for blockchain confirmation.
4. Confirm the actual transaction status.
5. Invalidate the relevant Redis portfolio cache.
6. Fetch the actual wallet state again.
7. Recalculate the portfolio.
8. Return the refreshed real portfolio data.

The Portfolio must reflect the actual wallet state.

==================================================
5. COINSTATS / DATA PROVIDER
==================================================

If CoinStats is already available in the project and provides the required functionality, use it where appropriate.

Potential responsibilities:

- Wallet balances
- Native balances
- ERC-20 balances
- SPL balances
- Token metadata
- Token prices
- Transaction history
- Swap/activity information
- DeFi information where supported
- Historical market/portfolio data where supported

CoinStats must ONLY be called from the backend.

NEVER call CoinStats directly from Expo/React Native.

NEVER expose CoinStats API keys to the mobile application.

Create a backend service/provider abstraction.

Example:

CoinStatsService

or:

CoinStatsPortfolioProvider

Do not make the frontend depend directly on CoinStats response fields.

Normalize provider responses into application-owned DTOs.

==================================================
6. PROVIDER ABSTRACTION
==================================================

Create an abstraction where appropriate:

PortfolioDataProvider

MarketDataProvider

TransactionDataProvider

DeFiDataProvider

The actual provider can be:

CoinStats

or another existing provider already used by the project.

Do NOT introduce a new external provider unnecessarily.

Before adding a provider:

1. Inspect the existing project.
2. Check whether a provider already exists.
3. Reuse it if it provides the required data.
4. Only introduce another provider if there is a real missing capability.

==================================================
7. MULTI-CHAIN SUPPORT
==================================================

Support the project's existing networks.

EVM examples:

- Ethereum
- Base
- Arbitrum
- Polygon
- BNB Chain
- Other existing EVM networks

Solana:

- Solana

Use normalized chain identifiers:

ethereum
base
arbitrum
polygon
bnb
solana

Create centralized chain configuration.

Do not scatter chain-specific logic throughout the application.

==================================================
8. TOKEN IDENTITY
==================================================

NEVER identify tokens only by symbol.

For example:

USDC can exist on:

Ethereum
Base
Arbitrum
Polygon
Solana

Use canonical token identity.

For EVM:

chain + contract address

For Solana:

chain + mint address

For native assets:

chain + native

Examples:

ethereum:native

base:native

arbitrum:native

polygon:native

bnb:native

solana:native

Examples of token identity:

ethereum:0x...

base:0x...

solana:So111...

Never use only:

USDC

ETH

SOL

as the unique identifier.

==================================================
9. EVM HOLDINGS
==================================================

For EVM networks support:

- Native token
- ERC-20 tokens

Examples:

Ethereum:

ETH
USDC
USDT
UNI
ARB
etc.

Base:

ETH
USDC
etc.

Use actual wallet balances.

Do not hardcode balances.

==================================================
10. SOLANA HOLDINGS
==================================================

For Solana support:

- SOL
- SPL tokens

Use:

chain + mint address

for SPL token identity.

Do not treat Solana tokens as EVM tokens.

==================================================
11. NORMALIZED PORTFOLIO RESPONSE
==================================================

Create an internal application-owned DTO.

Example:

{
  "wallet": {
    "address": "0x...",
    "chain": "ethereum"
  },

  "summary": {
    "totalValueUsd": 12500.45,
    "profitLossUsd": null,
    "profitLossPercent": null,
    "change24hUsd": 120.55,
    "change24hPercent": 0.97
  },

  "native": {
    "address": null,
    "symbol": "ETH",
    "name": "Ethereum",
    "balance": "2.45",
    "priceUsd": 2642.50,
    "valueUsd": 6474.12,
    "change24hPercent": 3.42,
    "logoUrl": "...",
    "priceUpdatedAt": "..."
  },

  "tokens": [
    {
      "id": "ethereum:0x...",
      "chain": "ethereum",
      "address": "0x...",
      "symbol": "USDC",
      "name": "USD Coin",
      "balance": "4250",
      "decimals": 6,
      "priceUsd": 1,
      "valueUsd": 4250,
      "allocationPercent": 34.0,
      "change24hPercent": 0.01,
      "logoUrl": "...",
      "priceUpdatedAt": "..."
    }
  ],

  "defi": [],

  "updatedAt": "..."
}

This is an example only.

Adapt it to the existing project architecture.

Do not expose unnecessary provider-specific fields.

==================================================
12. PORTFOLIO TOTAL VALUE
==================================================

Calculate:

Native asset values
+
Token values
+
Supported DeFi position values

=

Total Portfolio Value

Use decimal-safe calculations.

Do NOT blindly use JavaScript Number for high-precision blockchain amounts.

Blockchain balances should remain strings/decimal-safe values until appropriate calculation.

==================================================
13. TOKEN VALUE
==================================================

For each token:

valueUsd = balance × priceUsd

If price is unavailable:

priceUsd = null

valueUsd = null

Do NOT replace unavailable prices with:

0

unless the real value is actually zero.

Do not allow unknown/unpriced tokens to incorrectly inflate total portfolio value.

==================================================
14. ALLOCATION
==================================================

For priced assets:

allocationPercent =
assetValueUsd / totalPortfolioValueUsd × 100

Use real values.

Do not fabricate allocation percentages.

If the total value is zero:

return appropriate zero/null allocation values.

==================================================
15. TOKEN SAFETY
==================================================

Wallets may contain:

- Spam tokens
- Scam tokens
- Dust tokens
- Unknown tokens
- Tokens without logos
- Tokens without prices
- Tokens with incomplete metadata

Do not blindly display every returned token.

Implement reasonable filtering based on provider metadata and existing application rules.

Never fabricate:

- Name
- Symbol
- Logo
- Price
- Market cap
- Value
- Token metadata

If metadata is missing, handle it gracefully.

==================================================
16. PORTFOLIO CHART
==================================================

The Portfolio chart must use REAL historical portfolio values.

The current UI contains timeframe controls such as:

- 1D
- 1W
- 1M
- 1Y
- ALL

Support the existing UI timeframes.

Backend architecture should also be extensible for:

- 3M

if required later.

Example:

GET /api/portfolio/:chain/:walletAddress/chart?range=1D

Response:

{
  "range": "1D",
  "points": [
    {
      "timestamp": "2026-09-12T00:00:00Z",
      "valueUsd": 12000
    },
    {
      "timestamp": "2026-09-12T01:00:00Z",
      "valueUsd": 12100
    }
  ],
  "updatedAt": "..."
}

DO NOT generate:

- Random chart values
- Fake historical values
- Artificial curves
- Hardcoded points
- Placeholder production data

==================================================
17. HISTORICAL PORTFOLIO CALCULATION
==================================================

Historical portfolio value must represent real portfolio state.

Do NOT simply take:

currentBalance × historicalPrice

unless the historical balance is actually known.

Wallet composition changes over time because of:

- Deposits
- Withdrawals
- Transfers
- Swaps
- Token receipts
- Token sales

If reliable historical portfolio composition is unavailable:

Use real portfolio snapshots.

Do not pretend reconstructed history is exact.

==================================================
18. PORTFOLIO SNAPSHOTS
==================================================

If historical portfolio charts are required and the provider does not provide reliable historical portfolio values:

Persist periodic portfolio snapshots.

Example:

portfolio_snapshots

Fields:

- id
- walletId
- chain
- totalValueUsd
- timestamp

Optionally store additional aggregate information if required.

Do not create snapshots every few seconds unnecessarily.

Use an appropriate scheduled/background snapshot strategy.

==================================================
19. P/L
==================================================

DO NOT fabricate profit/loss.

P/L is not simply:

currentValue - previousValue

because the wallet may have:

- Deposits
- Withdrawals
- Transfers
- Swaps

If reliable cost basis and cash-flow data are unavailable:

profitLossUsd = null

profitLossPercent = null

The frontend should display the existing:

—

or equivalent null state.

Do not invent a P/L value.

==================================================
20. 24H PORTFOLIO CHANGE
==================================================

Where reliable data exists, display:

- 24h portfolio change
- 24h portfolio percentage change

Do not confuse:

Token 24h price change

with:

Portfolio profit/loss

They are different metrics.

==================================================
21. REAL-TIME / FRESH PRICE DATA
==================================================

Portfolio token prices must be fresh.

Use:

- Redis short-TTL price cache
- Background refresh
- App foreground refresh
- Pull-to-refresh
- Provider batching where supported
- Request deduplication

Recommended starting TTL:

10–30 seconds for prices

30–60 seconds for portfolio aggregates

These must be configurable.

IMPORTANT:

Do NOT fetch every token price on every React Native render.

Do NOT make one external request per user.

Do NOT aggressively poll.

"Real-time" here means fresh/near-real-time portfolio pricing.

If the provider supports reliable WebSocket/streaming prices and the project genuinely benefits from it, evaluate that option.

Otherwise use short-TTL polling/cache refresh.

==================================================
22. REDIS CACHE
==================================================

Use Redis for frequently changing portfolio data.

Suggested keys:

portfolio:{chain}:{walletAddress}

holdings:{chain}:{walletAddress}

portfolio:summary:{chain}:{walletAddress}

portfolio:chart:{chain}:{walletAddress}:{range}

portfolio:transactions:{chain}:{walletAddress}:{cursor}

portfolio:defi:{chain}:{walletAddress}

portfolio:swap-history:{chain}:{walletAddress}:{cursor}

Prices:

price:{chain}:{tokenAddress}

Native:

price:{chain}:native

Use configurable TTLs.

Suggested starting TTLs:

Portfolio:
30–60 seconds

Prices:
10–30 seconds

Chart:
1–5 minutes depending on timeframe

Transactions:
30–120 seconds

DeFi:
30–120 seconds

Do not hardcode these values throughout the codebase.

==================================================
23. SHARED PRICE CACHE
==================================================

Do NOT request the same token price separately for every user.

Example:

100 users hold ETH.

Do NOT make 100 external ETH price requests.

Use:

price:ethereum:native

Similarly:

price:{chain}:{tokenAddress}

Price data should be shared across users.

==================================================
24. CACHE STAMPEDE PROTECTION
==================================================

Protect external APIs from duplicate requests.

If 100 requests arrive while:

portfolio:ethereum:0x...

is expired:

Only one request should refresh the provider data.

Use:

- Redis distributed locks
- Single-flight
- Request deduplication

Example:

lock:portfolio:{chain}:{walletAddress}

Price:

lock:price:{chain}:{tokenAddress}

==================================================
25. STALE-WHILE-REVALIDATE
==================================================

Where practical:

If slightly stale cached portfolio data exists:

1. Return cached data immediately.
2. Start background refresh.
3. Fetch fresh data.
4. Update Redis.
5. Future requests receive fresh data.

Do not blank the UI unnecessarily.

==================================================
26. PORTFOLIO APIs
==================================================

Follow the existing Express.js API conventions.

Possible endpoints:

GET /api/portfolio/:chain/:walletAddress

GET /api/portfolio/:chain/:walletAddress/summary

GET /api/portfolio/:chain/:walletAddress/holdings

GET /api/portfolio/:chain/:walletAddress/chart?range=1D

GET /api/portfolio/:chain/:walletAddress/transactions

GET /api/portfolio/:chain/:walletAddress/defi

GET /api/portfolio/:chain/:walletAddress/swap-history

Adapt endpoint names to the existing backend.

Do not create duplicate APIs if equivalent APIs already exist.

==================================================
27. INITIAL PORTFOLIO RESPONSE
==================================================

Keep the initial Portfolio API lightweight.

Initial response should contain:

- Total portfolio value
- P/L if reliable
- 24h change
- Native asset
- Relevant holdings
- Current prices
- Allocation
- Basic DeFi summary
- Updated timestamp

Load heavier data separately when appropriate:

- Detailed chart
- Full transaction history
- Full DeFi positions
- Full swap history

==================================================
28. TRANSACTION PAGINATION
==================================================

Transactions must be paginated.

Example:

GET /api/portfolio/:chain/:walletAddress/transactions?page=1&limit=20

or cursor-based pagination.

Prefer cursor pagination where the provider supports it.

Never return unlimited transaction history.

==================================================
29. SWAP HISTORY
==================================================

The existing Swap History tab should primarily show swaps executed through our own aggregator.

PostgreSQL should be the primary persistent source for these application-owned swaps.

Store:

- wallet
- chain
- txHash
- input token
- input amount
- output token
- output amount
- route
- router
- status
- gas
- createdAt
- confirmedAt

Use a unique constraint to prevent duplicate swap records.

Example:

UNIQUE(walletId, chain, txHash)

==================================================
30. POST-SWAP REFRESH
==================================================

After a swap:

1. Create pending swap record.
2. Submit transaction through the existing swap flow.
3. Store transaction hash.
4. Monitor blockchain confirmation.
5. Update transaction status.
6. Invalidate relevant Redis caches.
7. Fetch actual wallet state.
8. Recalculate Portfolio.
9. Update the Portfolio UI.

Invalidate at minimum:

portfolio cache

holdings cache

transaction cache

relevant DeFi cache

relevant swap-history cache

Do NOT manually add/subtract token balances.

==================================================
31. NETWORK SWITCHING
==================================================

The Portfolio UI contains a network selector.

When network changes:

1. Detect selected network.
2. Detect connected wallet.
3. Resolve the correct wallet address for that network.
4. Fetch that network's portfolio.
5. Show loading state.
6. Display only that network's data.

Do not display Ethereum data when Solana is selected.

Cache separately:

portfolio:ethereum:wallet

portfolio:base:wallet

portfolio:arbitrum:wallet

portfolio:polygon:wallet

portfolio:bnb:wallet

portfolio:solana:wallet

==================================================
32. WALLET CONNECTION
==================================================

Use the existing wallet connection system.

Do not create another wallet connection implementation.

When wallet changes:

- Clear/invalidate previous wallet portfolio state.
- Fetch the new wallet's portfolio.
- Ensure no previous wallet data remains visible incorrectly.

Never persist or request:

- Private keys
- Seed phrases

for this Portfolio feature.

==================================================
33. FRONTEND REDUX TOOLKIT
==================================================

The frontend uses Redux Toolkit.

Reuse the existing Redux architecture.

DO NOT replace Redux Toolkit.

Inspect whether the project currently uses:

- createSlice
- createAsyncThunk
- RTK Query
- Selectors
- Entity adapters

Reuse the existing pattern.

If createAsyncThunk is already used:

Follow that convention.

If RTK Query is already used:

Reuse it.

Do not introduce a completely different state-management pattern unnecessarily.

==================================================
34. PORTFOLIO REDUX STATE
==================================================

Possible state structure:

{
  portfolio,
  holdings,
  summary,
  selectedNetwork,
  chart,
  chartRange,
  defi,
  transactions,
  swapHistory,
  loading,
  refreshing,
  chartLoading,
  error,
  pagination
}

Adapt this to the existing Redux store.

Do not duplicate data unnecessarily.

==================================================
35. REDUX PERFORMANCE
==================================================

Avoid unnecessary Redux updates.

Do not store huge historical datasets globally if they are not needed.

Cache chart data by:

token/range

or:

wallet/chain/range

where appropriate.

Use efficient selectors.

Avoid causing the entire Portfolio screen to re-render when only one value changes.

==================================================
36. FRONTEND API SERVICE
==================================================

React Native/Expo must communicate only with our Express.js backend.

Use the existing API service.

Possible functions:

getPortfolio()

getPortfolioSummary()

getPortfolioHoldings()

getPortfolioChart()

getPortfolioTransactions()

getPortfolioDefi()

getPortfolioSwapHistory()

Do not put direct CoinStats requests inside React components.

==================================================
37. PORTFOLIO SCREEN MAPPING
==================================================

The existing UI should continue receiving the structure it expects wherever possible.

If backend DTOs differ:

Create an adapter:

mapPortfolioResponseToScreenModel()

Do not rewrite the UI just because the API response is normalized.

The mapper should convert:

backend DTO

to:

existing Portfolio screen model.

==================================================
38. HOLDINGS TAB
==================================================

The Holdings tab must display real:

- Token logo
- Token symbol
- Network
- Balance
- USD value
- Token price
- 24h change
- Swap button

Example screenshot values such as:

2.45 ETH

$6,474.12

$2,642.50

are examples only.

Do not hardcode them.

==================================================
39. DEFI YIELD TAB
==================================================

If reliable DeFi data is available:

Display real positions.

Potential positions:

- Staking
- Lending
- Liquidity pools
- Other supported DeFi positions

If reliable data is unavailable:

Return an empty state.

DO NOT fabricate:

- APY
- Yield
- Staked balance
- Lending balance
- LP position
- DeFi value

==================================================
40. TRANSACTION HISTORY
==================================================

If the Portfolio supports transaction history:

Use real blockchain/indexer data.

Support:

- Sends
- Receives
- Swaps
- Token transfers
- Other supported transaction types

Normalize transactions into application DTOs.

Do not expose raw provider responses directly to the UI.

==================================================
41. LOADING STATES
==================================================

Support:

- Initial loading
- Network switching
- Wallet switching
- Pull-to-refresh
- Background refresh
- Chart loading
- Transaction loading
- DeFi loading
- Swap history loading

During background refresh:

DO NOT remove valid existing data.

Keep the existing data visible while refreshing.

==================================================
42. ERROR HANDLING
==================================================

Handle:

- Invalid wallet
- Unsupported chain
- Provider failure
- Provider timeout
- Provider rate limit
- Redis failure
- Database failure
- Network failure
- Missing token price
- Missing metadata
- Missing historical data
- Empty wallet

Never replace failed real data with fake data.

==================================================
43. EMPTY WALLET
==================================================

An empty wallet is NOT necessarily an error.

Return:

totalValueUsd = 0

tokens = []

defi = []

transactions = []

Use the existing empty-state UI.

Do not show fake holdings.

==================================================
44. MISSING PRICE
==================================================

If a token has no reliable price:

priceUsd = null

valueUsd = null

Do not use:

0

unless the actual price is zero.

Do not allow an unpriced token to incorrectly affect total portfolio value.

==================================================
45. APP FOREGROUND REFRESH
==================================================

When the Expo application returns to the foreground:

Check the freshness of Portfolio data.

If stale:

Refresh.

If fresh:

Do not unnecessarily request everything again.

Use the existing app lifecycle implementation if available.

==================================================
46. PULL TO REFRESH
==================================================

Connect the existing pull-to-refresh behavior.

Refresh:

- Portfolio summary
- Holdings
- Current prices
- Relevant data

Do not unnecessarily reload all historical chart data.

==================================================
47. POSTGRESQL
==================================================

PostgreSQL should store persistent application-owned data.

Recommended tables:

wallets

Fields:

- id
- userId
- address
- chain
- createdAt
- updatedAt

Unique:

userId + chain + address

--------------------------------------------------

swap_transactions

Fields:

- id
- walletId
- chain
- txHash
- fromTokenAddress
- fromTokenSymbol
- fromAmount
- toTokenAddress
- toTokenSymbol
- toAmount
- router
- route
- status
- gasUsed
- createdAt
- confirmedAt
- updatedAt

Unique:

walletId + chain + txHash

--------------------------------------------------

wallet_transactions

Fields:

- id
- walletId
- chain
- txHash
- transactionType
- fromAddress
- toAddress
- tokenAddress
- tokenSymbol
- amount
- valueUsd
- timestamp

--------------------------------------------------

portfolio_snapshots

Fields:

- id
- walletId
- chain
- totalValueUsd
- timestamp

Add indexes according to actual query patterns.

Do not blindly create tables if equivalent tables already exist.

Reuse existing database models.

==================================================
48. DO NOT STORE EVERY PRICE TICK
==================================================

Do NOT write every 10–30 second price update into PostgreSQL.

Redis handles:

- Current price cache
- Current portfolio cache
- Short-lived data

PostgreSQL handles:

- Wallet relationships
- Swap history
- Persistent transaction history
- Portfolio snapshots
- Other persistent application data

==================================================
49. HISTORICAL DATA STRATEGY
==================================================

Prefer provider historical data when reliable.

If provider historical portfolio data is unavailable:

Use periodic portfolio snapshots.

Do not fabricate history.

Clearly distinguish:

Provider historical data

from:

Application-collected portfolio snapshots.

==================================================
50. AUTHORIZATION
==================================================

If the existing application has authentication:

Do not rely only on walletAddress for private application-owned data.

Verify that the wallet belongs to or is authorized for the authenticated user where appropriate.

Prevent unauthorized access to private application data.

==================================================
51. SECURITY
==================================================

Never expose:

- CoinStats API key
- Market provider API keys
- PostgreSQL credentials
- Redis credentials
- Private keys
- Seed phrases
- Internal infrastructure credentials

The Expo app must only communicate with our backend.

==================================================
52. ENVIRONMENT VARIABLES
==================================================

Use the existing backend environment/configuration system.

Potential variables:

MARKET_PROVIDER_API_KEY

COINSTATS_API_KEY

REDIS_URL

DATABASE_URL

PORTFOLIO_CACHE_TTL

PRICE_CACHE_TTL

CHART_CACHE_TTL

TRANSACTION_CACHE_TTL

Do not create duplicate configuration systems.

Never commit secrets to Git.

==================================================
53. PERFORMANCE
==================================================

Avoid:

- N+1 provider requests
- One price request per user
- One external request per token unnecessarily
- Duplicate provider requests
- Huge API responses
- Unlimited transaction queries
- Excessive polling
- Re-fetching on every render
- Unnecessary Redux updates
- Writing every price tick to PostgreSQL

Use:

- Redis
- Shared price cache
- Batching
- Pagination
- Request deduplication
- Distributed locking
- Background refresh
- Memoized selectors
- Efficient Redux state

==================================================
54. MULTI-CHAIN DATA ISOLATION
==================================================

Never mix portfolio data across chains incorrectly.

Example:

Ethereum portfolio:

ETH
USDC
UNI

Solana portfolio:

SOL
SPL tokens

When the user switches network:

Only display the selected network's data.

==================================================
55. SWAP BUTTON
==================================================

The existing Swap buttons must continue working.

DO NOT redesign them.

When a user taps Swap:

Pass the correct canonical token identity to the existing Swap flow.

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
56. SWAP TOKENS BUTTON
==================================================

The existing "Swap Tokens" button must continue working.

Do not redesign it.

Use the existing swap navigation.

Do not create a second swap implementation.

==================================================
57. CHART CONTROLS
==================================================

The existing UI contains:

- Line
- Candles
- MA(7)
- MA(25)
- VOL

Preserve the existing controls and visual design.

Important:

Do not fabricate technical-analysis data.

If MA(7), MA(25), or volume is shown:

Use real historical price/volume data.

If the provider does not support the required data:

Use the existing UI's appropriate unavailable state.

Do not generate fake indicator values.

==================================================
58. 24H HIGH / LOW / VOLUME
==================================================

If the Portfolio chart UI displays:

24h High
24h Low
Volume

Use real market data for the selected asset/network where applicable.

Do not hardcode screenshot values.

Do not confuse:

portfolio value

with:

underlying asset market statistics.

==================================================
59. CHART DATA CACHE
==================================================

Cache historical chart data separately.

Example:

portfolio:chart:{chain}:{walletAddress}:{range}

Use appropriate TTL based on timeframe.

Do not request the same chart repeatedly when cached data is still valid.

==================================================
60. CHART PERFORMANCE
==================================================

Do not load ALL historical data when the Portfolio screen first opens.

Initial request should be lightweight.

Load detailed chart data for the selected timeframe.

Do not request unnecessary chart ranges simultaneously.

If the user switches:

1D -> 1W

then fetch/cache the 1W data.

Do not reload 1D unnecessarily.

==================================================
61. TESTING
==================================================

Add tests using the existing testing framework.

Test:

Wallet:

- Valid wallet
- Invalid wallet
- Empty wallet
- Wallet switching

EVM:

- Native balance
- ERC-20 balance
- Multiple EVM networks

Solana:

- SOL balance
- SPL balance

Pricing:

- Token price
- Missing price
- Price cache
- Price refresh

Portfolio:

- Total value
- Allocation
- 24h change
- Missing price handling

P/L:

- Reliable P/L
- Missing cost basis
- Deposits/withdrawals
- No fabricated P/L

Chart:

- 1D
- 1W
- 1M
- 1Y
- ALL
- Real historical points
- Missing historical data

Network switching:

- Ethereum
- Base
- Arbitrum
- Polygon
- BNB
- Solana

Transactions:

- Pagination
- Real transaction mapping

Swap history:

- Pending
- Confirmed
- Failed
- Duplicate prevention

Cache:

- Cache hit
- Cache miss
- Expiration
- Redis lock
- Concurrent requests
- Stale-while-revalidate

Post-swap:

- Confirmation
- Cache invalidation
- Portfolio refresh

Redux:

- Loading
- Success
- Error
- Refresh
- Network switching
- Wallet switching

==================================================
62. NO MOCK DATA
==================================================

Production Portfolio data must contain NO:

- Fake balances
- Fake prices
- Fake portfolio totals
- Fake P/L
- Fake chart points
- Fake transactions
- Fake DeFi positions
- Fake allocation
- Fake token metadata
- Fake 24h values
- Random values
- Hardcoded screenshot values

Mocks are allowed ONLY inside tests.

==================================================
63. DO NOT BREAK EXISTING APPLICATION
==================================================

Do not rewrite:

- Existing swap aggregator
- Existing wallet connection
- Existing navigation
- Existing Market screen
- Existing Redux architecture
- Existing unrelated APIs

unless absolutely necessary.

Make the smallest clean changes required.

==================================================
64. IMPLEMENTATION PROCESS
==================================================

Before modifying code, inspect the existing codebase.

Step 1:

Inspect the Portfolio screen.

Find:

- UI component
- Mock data
- Existing chart implementation
- Existing tabs
- Existing network selector
- Existing swap button behavior

Step 2:

Inspect Redux Toolkit.

Find:

- Store
- Slices
- Thunks
- API state
- Existing selectors

Step 3:

Inspect backend.

Find:

- Express app
- Routes
- Controllers
- Services
- Existing Web3 code
- Existing market provider
- Existing wallet provider

Step 4:

Inspect:

- Redis implementation
- PostgreSQL schema
- ORM/query layer
- Existing wallet models
- Existing transaction models

Step 5:

Inspect existing swap lifecycle.

Step 6:

Implement Portfolio data incrementally.

Step 7:

Connect backend to Redux Toolkit.

Step 8:

Connect Redux data to the existing UI.

Step 9:

Test all supported chains.

Step 10:

Test post-swap refresh.

DO NOT rewrite unrelated code.

==================================================
65. CODE QUALITY
==================================================

Follow the existing project's:

- TypeScript conventions
- ESLint
- Prettier
- Naming conventions
- Folder structure
- Error handling
- Logging
- API response conventions
- Redux patterns
- Testing patterns

Do not introduce unnecessary dependencies.

If a new dependency is genuinely required:

Explain why it is needed.

==================================================
66. FINAL VALIDATION
==================================================

Verify every item:

[ ] Portfolio UI remains visually unchanged.

[ ] Mock portfolio data removed from production flow.

[ ] Real wallet balance works.

[ ] Real native token balance works.

[ ] Real ERC-20 balances work.

[ ] Real SPL balances work.

[ ] Real token prices work.

[ ] Real token logos work.

[ ] Real token metadata works.

[ ] Real token values work.

[ ] Total portfolio value is real.

[ ] Allocation is real.

[ ] 24h token changes are real.

[ ] Portfolio 24h change is real where supported.

[ ] P/L is never fabricated.

[ ] Historical portfolio chart uses real data.

[ ] No random chart points exist.

[ ] No hardcoded chart values exist.

[ ] Existing chart controls continue working.

[ ] 1D works.

[ ] 1W works.

[ ] 1M works.

[ ] 1Y works.

[ ] ALL works.

[ ] 24h High is real where applicable.

[ ] 24h Low is real where applicable.

[ ] Volume is real where applicable.

[ ] Ethereum works.

[ ] Base works.

[ ] Arbitrum works.

[ ] Polygon works.

[ ] BNB works.

[ ] Solana works.

[ ] Network switching works.

[ ] Wallet switching works.

[ ] Holdings tab works.

[ ] DeFi tab contains only real data.

[ ] Swap History contains real application swaps.

[ ] Transaction history is real.

[ ] Transactions are paginated.

[ ] Pull-to-refresh works.

[ ] App foreground refresh works.

[ ] Prices are fresh/near-real-time.

[ ] Price cache works.

[ ] Portfolio cache works.

[ ] Chart cache works.

[ ] Shared price cache works.

[ ] Cache stampede protection exists.

[ ] Stale-while-revalidate works where appropriate.

[ ] PostgreSQL does not receive every price tick.

[ ] Post-swap cache invalidation works.

[ ] Post-swap portfolio refresh works.

[ ] Redux Toolkit integration works.

[ ] Express.js backend architecture is preserved.

[ ] Existing swap functionality still works.

[ ] Existing wallet connection still works.

[ ] API keys remain backend-only.

[ ] Private keys/seed phrases are never stored.

[ ] TypeScript passes.

[ ] ESLint passes.

[ ] Tests pass.

==================================================
67. FINAL DELIVERABLE
==================================================

Actually inspect and implement the existing codebase.

DO NOT only explain what should be done.

Actually make the required code changes.

At the end provide a concise implementation report containing:

1. Files created
2. Files modified
3. Redux slices/actions/thunks/selectors changed
4. Express routes created/modified
5. Controllers/services created/modified
6. Provider integration
7. API endpoints
8. Redis keys
9. Redis TTLs
10. Cache strategy
11. Real-time/fresh-price strategy
12. Portfolio calculation logic
13. Chart/history implementation
14. PostgreSQL changes/migrations
15. Swap integration changes
16. Network support
17. Frontend changes
18. Tests added
19. Required environment variables
20. Commands required to run
21. Any provider limitations
22. Any remaining limitations or assumptions

==================================================
PRIMARY REQUIREMENTS
==================================================

REAL WALLET DATA.

REAL BLOCKCHAIN DATA.

REAL TOKEN BALANCES.

REAL TOKEN PRICES.

REAL PORTFOLIO VALUES.

REAL ALLOCATION.

REAL 24H DATA.

REAL HISTORICAL PORTFOLIO CHART.

REAL TRANSACTION HISTORY.

REAL SWAP HISTORY.

REAL DEFI DATA WHERE SUPPORTED.

REAL EVM + SOLANA SUPPORT.

FRESH/NEAR-REAL-TIME PRICES.

REDIS SHARED CACHING.

REDIS CACHE-STAMPEDE PROTECTION.

REDUX TOOLKIT FRONTEND.

EXPRESS.JS BACKEND.

POSTGRESQL PERSISTENCE.

NO FABRICATED FINANCIAL DATA.

NO RANDOM CHART DATA.

NO HARDCODED PRODUCTION VALUES.

DO NOT MANUALLY MODIFY WALLET BALANCES AFTER SWAPS.

DO NOT EXPOSE PROVIDER API KEYS.

DO NOT REDESIGN THE EXISTING PORTFOLIO UI.

INSPECT THE EXISTING CODEBASE FIRST.

REUSE EXISTING ARCHITECTURE.

IMPLEMENT THE FEATURE, DO NOT ONLY EXPLAIN IT.