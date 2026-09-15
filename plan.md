You are a senior full-stack/backend/platform engineer responsible for making this existing crypto swap aggregator application production-ready, scalable, data-correct, and efficient.

============================================================
CORE INSTRUCTION
============================================================

WORK ON THE EXISTING PROJECT.

Do NOT rebuild the application from scratch.

Do NOT redesign the existing UI.

Do NOT remove existing APIs/providers simply because the architecture is being improved.

IMPORTANT:
The project currently uses MULTIPLE APIs/providers.

KEEP THE EXISTING MULTIPLE-API ARCHITECTURE.

You must:
- inspect all existing APIs/providers
- understand what each API is currently responsible for
- preserve useful existing providers
- improve provider abstraction
- improve caching
- reduce unnecessary duplicate requests
- coordinate refreshes
- prevent API/provider request storms
- use the best provider for each data type
- never replace a working provider without a concrete technical reason

Do NOT assume CoinStats must provide everything.

For example, the application may use:
- CoinStats for wallet/indexing/market data
- blockchain RPC/provider for on-chain state
- swap/quote/route APIs for swaps
- other existing market/token APIs
- other existing infrastructure APIs

Keep them.

============================================================
1. FIRST: INSPECT THE ENTIRE REPOSITORY
============================================================

Before making changes, inspect the complete repository.

Understand:

FRONTEND:
- React Native
- Expo
- TypeScript
- Redux Toolkit
- navigation
- Portfolio screen
- Market screen
- Swap screen
- Wallet connection
- transaction screens
- notification/settings
- existing API clients
- hooks
- polling
- refresh behavior

BACKEND:
- Node.js
- Express.js
- TypeScript/JavaScript
- routes
- controllers
- services
- repositories
- providers
- middleware
- workers/jobs
- WebSocket/SSE if present

DATABASE:
- PostgreSQL
- schema
- migrations
- indexes
- existing tables

CACHE:
- Redis
- cache service
- existing cache keys
- TTLs
- locks
- Pub/Sub if present

PROVIDERS/APIs:
- CoinStats
- blockchain RPC/provider
- swap APIs
- market APIs
- token APIs
- any other third-party API currently used

DO NOT REMOVE A PROVIDER WITHOUT FIRST UNDERSTANDING ITS PURPOSE.

============================================================
2. MULTIPLE API / PROVIDER ARCHITECTURE
============================================================

The application already uses multiple APIs.

PRESERVE THIS.

Create or improve a provider abstraction.

Conceptually:

Provider Layer
|
|-- CoinStatsProvider
|-- BlockchainProvider
|-- SwapProvider
|-- MarketProvider
|-- TokenProvider
|-- OtherExistingProvider(s)

Do NOT force all functionality through CoinStats.

Each provider should have a clear responsibility.

For example:

Blockchain/RPC:
- actual wallet state
- transaction receipt
- block status
- on-chain confirmation
- native balances
- token balances where appropriate

CoinStats:
- wallet indexing where appropriate
- token metadata
- market data where appropriate
- transactions where supported
- DeFi data where supported

Market API:
- market-specific data if already used

Swap/quote API:
- quotes
- routes
- swap transaction construction

Other existing APIs:
- preserve their current valid responsibility

The backend should orchestrate providers.

Frontend must NOT directly expose provider API keys.

============================================================
3. PROVIDER SELECTION
============================================================

Do not call every provider for every request.

For each data requirement, define:

- primary provider
- fallback provider if one already exists
- cache strategy
- refresh strategy
- failure behavior

Example:

Token price:
Primary → existing market provider
Fallback → another configured provider if already supported
Cache → Redis

Wallet balance:
Primary → blockchain/provider/indexing source
Cache → Redis

Swap quote:
Primary → existing swap/route provider
Cache → only where quote caching is safe

Swap confirmation:
Primary → blockchain/RPC
Never trust third-party "success" without blockchain confirmation.

============================================================
4. CRITICAL DATA INTEGRITY RULES
============================================================

Never use fake production data.

Remove or replace:

- Math.random()
- fake transaction hashes
- fake wallet balances
- fake prices
- fake chart points
- fake portfolio history
- fake transactions
- fake swap success
- timer-based transaction success
- fake APY
- fake DeFi positions
- synthetic volume
- fabricated P/L
- hardcoded production market values

If real data is unavailable:

return:
- null
- empty
- unavailable
- not-supported

as appropriate.

NEVER convert unknown data to zero.

Unknown price != 0.

Unavailable balance != 0.

Unavailable P/L != 0.

============================================================
5. DATA SOURCE OF TRUTH
============================================================

Blockchain state:
SOURCE OF TRUTH for on-chain wallet state.

Provider APIs:
SOURCE OF TRUTH for the data they legitimately provide.

PostgreSQL:
SOURCE OF TRUTH for durable application records.

Redis:
FAST CACHE and coordination layer.

Redux:
CLIENT STATE, NOT SOURCE OF TRUTH.

Never manually modify wallet balances after a swap and assume the result is correct.

After confirmation:
fetch actual wallet state.

============================================================
6. CACHE PHILOSOPHY
============================================================

IMPORTANT:

The application should keep cache reasonably fresh.

We DO NOT want extremely long stale data.

We also DO NOT want every user request to hit external APIs.

Use:

FRESHNESS-AWARE CACHE
+
SHORT/SENSIBLE TTL
+
SINGLE-FLIGHT REFRESH
+
FORCE REFRESH ON PULL-TO-REFRESH

The goal is:

Fresh enough data
+
fast responses
+
controlled API usage
+
scalability

============================================================
7. USER OPENS PORTFOLIO
============================================================

When the user enters Portfolio:

Client:
GET /portfolio/...

Backend:

Check Redis.

IF cache is fresh:
    return cached data immediately.

IF cache is expired/missing:
    one request acquires refresh lock
    fetch latest data from the appropriate APIs/providers
    normalize data
    calculate portfolio
    update Redis
    return latest data

Concurrent requests MUST NOT each call external APIs.

Example:

20 users open Portfolio simultaneously.

BAD:

20 users
→ 20 CoinStats calls
→ 20 blockchain calls
→ duplicate work

GOOD:

20 users
→ backend
→ cache/refresh coordination
→ only necessary provider requests
→ Redis updated
→ users receive current snapshot

============================================================
8. PORTFOLIO PULL-TO-REFRESH
============================================================

This is an explicit user request for fresh data.

When user pulls to refresh:

Client:
POST/GET refresh endpoint according to existing architecture.

Backend should:

1. bypass normal fresh-cache return
2. acquire wallet-specific refresh lock
3. fetch latest data from required providers
4. normalize data
5. update Redis
6. optionally persist snapshot if appropriate
7. return latest data

If another refresh is already running:

DO NOT start another provider request.

Wait briefly or return the newest available data depending on the existing API design.

Example:

20 users pull-to-refresh simultaneously.

BAD:

20 external API requests.

GOOD:

ONE refresh operation
+
shared result
+
all requests receive latest snapshot.

============================================================
9. PORTFOLIO CACHE TTL
============================================================

Use a relatively short, practical cache window.

Do NOT use extremely long cache durations.

Start with configurable values such as:

Portfolio:
1–5 minutes

Market overview:
1–5 minutes

Token prices:
30 seconds–2 minutes

Token detail:
2–5 minutes

Transactions:
5–15 minutes

Historical charts:
15–60 minutes

These are starting defaults.

Make them environment/config driven.

Tune them based on:
- API limits
- actual data volatility
- application requirements
- response latency

Do not hardcode these values throughout the codebase.

============================================================
10. ALWAYS KEEP CACHE FRESH
============================================================

The objective is not:

"Cache data for a long time."

The objective is:

"Keep the shared cache reasonably fresh."

Use controlled refresh.

For frequently requested resources:

Request
→ check cache
→ if fresh, return
→ if nearing expiry/expired, one refresh
→ update Redis
→ return latest snapshot

If background workers are appropriate, they may proactively refresh popular market data.

Do NOT proactively refresh every user's portfolio continuously.

User-specific portfolio data should primarily refresh when:
- user opens it
- cache expires
- user pulls to refresh
- swap confirmation invalidates it
- another explicit event requires it

============================================================
11. MARKET DATA
============================================================

Preserve existing Market UI exactly.

Use existing multiple APIs/providers.

Do NOT replace all market APIs with one API.

Determine which existing provider is best for:
- price
- market cap
- volume
- rankings
- metadata
- chart
- search
- categories
- gainers

Use provider-specific adapters.

Example:

MarketService
|
|-- MarketProviderA
|-- CoinStatsProvider
|-- OtherExistingProvider

MarketService decides which provider supplies each field/resource.

============================================================
12. SHARED MARKET CACHE
============================================================

Market data is highly shareable.

Do NOT make every user call providers independently.

Architecture:

Multiple users
     ↓
Backend
     ↓
Redis shared market snapshot
     ↓
Users

If cache is fresh:
return it.

If expired:
one refresh operation updates it.

20 users opening Market should NOT create 20 identical provider calls.

============================================================
13. MARKET PULL-TO-REFRESH
============================================================

If Market screen supports pull-to-refresh:

User pulls refresh
→ explicit force refresh
→ provider/API refresh
→ normalize
→ Redis update
→ return newest data

If another refresh is already running:
do not duplicate it.

============================================================
14. MARKET TOKEN LIST
============================================================

Every displayed token must contain real data.

Use:
- real price
- real 24h change
- real market cap
- real volume
- real rank
- real logo
- real name
- real symbol

Do not leave only BTC/ETH/SOL connected while other tokens use fake data.

============================================================
15. TOKEN IDENTITY
============================================================

Never identify tokens only by symbol.

Use:

EVM:
chainId + contractAddress

Solana:
chain/network + mint address

Native asset:
canonical chain-specific native identity

This prevents:
ETH on Ethereum
and
ETH-wrapped assets
or
same symbols on different chains

from being mixed incorrectly.

============================================================
16. MARKET SEARCH
============================================================

Preserve existing search UI.

Search should support:
- name
- symbol
- contract address
- Solana mint

Use:
- frontend debounce
- backend rate limiting
- cache
- pagination
- stale-response protection
- request cancellation where practical

Do not call providers on every keystroke.

============================================================
17. MARKET PAGINATION
============================================================

Do not repeatedly request huge provider pages for every category/page.

Use:
- provider pagination
OR
- shared cached dataset
OR
- normalized backend dataset

Then paginate backend results.

Keep response sizes bounded.

============================================================
18. TOKEN CHART
============================================================

Charts MUST be token-specific.

ETH:
ETH historical data

BTC:
BTC historical data

SOL:
SOL historical data

UNI:
UNI historical data

Never reuse another token's history.

Never generate chart values.

Never generate synthetic volume.

If historical data is unavailable:
return unavailable/empty state.

Preserve existing chart UI.

============================================================
19. PORTFOLIO DATA
============================================================

Portfolio must use real:

- native balances
- ERC20 balances
- SPL balances
- token prices
- token values
- allocation
- 24h change
- transactions
- swap history
- supported DeFi positions
- historical portfolio values

Use decimal-safe calculations.

Prefer:
raw blockchain amount
+
decimals
+
decimal arithmetic

Avoid JavaScript Number for large token quantities where precision can be lost.

============================================================
20. PORTFOLIO VALUE
============================================================

For each asset:

valueUsd =
actualBalance × actualPrice

If price unavailable:

valueUsd = null

Do NOT:

valueUsd = 0

unless the actual value is genuinely zero.

============================================================
21. PORTFOLIO P/L
============================================================

Do not fabricate profit/loss.

Simple:

currentValue - previousValue

is NOT necessarily P/L.

Deposits, withdrawals, transfers and swaps affect it.

If cost basis/cash flow data is unavailable:

P/L = null

Existing UI can display:
—

instead of a fake value.

24h change and P/L must remain separate.

============================================================
22. PORTFOLIO HISTORY
============================================================

Use PostgreSQL portfolio snapshots.

Example:

portfolio_snapshots:
- id
- walletId
- chain
- totalValueUsd
- timestamp

Do not write snapshots every few seconds.

Use sensible controlled sampling.

Historical chart must use real data.

Do NOT:
- generate points
- scale one token's history to represent the entire portfolio
- create fake missing history
- fabricate volume

If insufficient history exists:
return empty/unavailable.

============================================================
23. PORTFOLIO DEFI
============================================================

Only show real DeFi positions.

If existing provider supports DeFi:
use it.

If not:
return empty/not-supported.

Never invent:
- APY
- TVL
- LP position
- staking position
- lending position
- borrowed amount

============================================================
24. PORTFOLIO TRANSACTIONS
============================================================

Use pagination.

Initial Portfolio load should not download thousands of transactions.

Separate heavy resources where appropriate:

Initial:
- summary
- holdings

Additional:
- chart
- transactions
- DeFi
- swap history

Preserve existing UI behavior.

============================================================
25. REDIS ARCHITECTURE
============================================================

Create a robust centralized cache service.

Requirements:

- stable cache keys
- versioned envelopes
- TTL
- stale/fresh state
- distributed locks
- single-flight
- metrics
- safe invalidation
- fallback

Example:

{
  schemaVersion,
  value,
  generatedAt,
  freshUntil,
  staleUntil,
  source,
  version
}

============================================================
26. CACHE LOCKING
============================================================

This is CRITICAL.

When cache expires:

Request A:
acquire lock
→ provider
→ update Redis
→ release lock

Requests B/C/D:
wait/re-read Redis
→ receive refreshed result

B/C/D MUST NOT call provider.

Implement:
- lock owner identity
- lock TTL
- safe release
- timeout
- re-read after waiting

============================================================
27. CACHE KEY EXAMPLES
============================================================

Use normalized keys such as:

portfolio:{chain}:{walletAddress}

portfolio:chart:{chain}:{walletAddress}:{range}

portfolio:transactions:{chain}:{walletAddress}:{cursor}

market:overview

market:tokens:{filters}:{page}

market:gainers

market:categories

market:search:{query}

market:token:{chain}:{tokenIdentity}

market:chart:{chain}:{tokenIdentity}:{range}

price:{chain}:{tokenIdentity}

Use chain + token identity.

Do not use symbol-only cache keys.

============================================================
28. CACHE INVALIDATION AFTER SWAP
============================================================

When a REAL swap is confirmed:

Invalidate:
- portfolio
- holdings
- affected token balances
- wallet transaction cache
- swap history
- portfolio chart if appropriate

Then fetch actual wallet state.

Do NOT manually subtract/add balances as final truth.

============================================================
29. SWAP LIFECYCLE
============================================================

A swap must be real.

Lifecycle:

Quote
→ Route
→ Review
→ Wallet signature
→ Real blockchain submission
→ Real transaction hash
→ Pending
→ Receipt
→ Confirmed/Failed
→ Cache invalidation
→ Actual portfolio refresh
→ Notification

Never mark success because:
- timer expired
- UI optimistic state
- client says success

============================================================
30. SWAP PROVIDER
============================================================

Keep the existing swap/quote APIs.

Do not remove them.

Separate:

Quote/route provider
from
Blockchain transaction confirmation.

A quote provider may construct a transaction.

The blockchain confirms whether it actually succeeded.

============================================================
31. SWAP DATABASE
============================================================

Store durable swap records.

Recommended:

swap_transactions:
- id
- userId
- walletId
- chain
- chainId
- txHash
- nonce
- fromTokenAddress
- fromAmountRaw
- fromDecimals
- toTokenAddress
- toAmountRaw
- toDecimals
- router
- route
- gasUsed
- blockNumber
- status
- submittedAt
- confirmedAt
- failedAt
- lastCheckedAt
- createdAt
- updatedAt

Unique:

(chain, txHash)

============================================================
32. SWAP CONFIRMATION WORKER
============================================================

Create a reliable worker/job.

It checks pending transactions.

Handle:
- pending
- confirmed
- failed
- timeout
- dropped
- replaced
- reorg/finality where appropriate

Stop checking final transactions.

Must be idempotent.

============================================================
33. SWAP IDEMPOTENCY
============================================================

Protect against:
- duplicate requests
- mobile retry
- process restart
- same tx hash
- worker retry

Use:
- database unique constraints
- idempotency keys
- status transitions

Do not duplicate:
- swap history
- notifications
- cache invalidation

============================================================
34. NOTIFICATIONS
============================================================

Do not rely only on local notifications.

Implement backend notification infrastructure.

Tables:

notification_devices

notification_events

notification_deliveries

Store:
- user
- device
- Expo push token
- event
- idempotency key
- provider ticket
- receipt
- attempts
- error
- status

============================================================
35. PUSH TOKEN REGISTRATION
============================================================

Mobile:

permission
→ Expo push token
→ authenticated backend registration

Backend validates:
- user
- device
- token

Do not only log token locally.

============================================================
36. PUSH DELIVERY
============================================================

Use a worker.

Flow:

Application event
→ durable notification event
→ delivery record
→ Expo push
→ ticket
→ receipt
→ success/failure
→ retry/cleanup

Handle invalid tokens.

Do not duplicate notifications.

============================================================
37. PRICE ALERTS
============================================================

Use shared market data.

Do NOT:

1000 users
→ 1000 provider requests

Instead:

Provider
→ shared market snapshot
→ alert evaluator
→ matching users
→ notification events

Implement:
- threshold
- enabled
- cooldown
- triggeredAt
- re-arm
- idempotency

============================================================
38. REAL-TIME
============================================================

If the existing application uses or requires WebSocket/SSE:

Use:

Provider refresh
→ Redis snapshot
→ Redis Pub/Sub
→ WebSocket/SSE gateway
→ authenticated clients
→ client fetches latest snapshot

Pub/Sub is NOT the source of truth.

Publish metadata:
- resource
- event type
- snapshot version
- timestamp

Do not publish huge market payloads through Pub/Sub.

============================================================
39. MULTI-INSTANCE REAL-TIME
============================================================

Must work when multiple backend instances run.

Each gateway must receive relevant update events.

Handle:
- authentication
- heartbeat
- reconnect
- exponential backoff
- connection limits
- snapshot versions
- newest update wins

After reconnect:
fetch latest data.

============================================================
40. REDUX TOOLKIT
============================================================

Keep Redux Toolkit.

Prevent:
- duplicate requests
- stale response overwrite
- unnecessary renders
- requests on every render

Redux is client state.

Backend/Redis/provider remains source of truth.

============================================================
41. API DESIGN
============================================================

Adapt to existing route conventions.

Potential endpoints:

GET /portfolio/:chain/:walletAddress

GET /portfolio/:chain/:walletAddress/holdings

GET /portfolio/:chain/:walletAddress/chart?range=1D

GET /portfolio/:chain/:walletAddress/transactions

GET /portfolio/:chain/:walletAddress/swap-history

POST /portfolio/:chain/:walletAddress/refresh

GET /market/overview

GET /market/tokens

GET /market/gainers

GET /market/search?q=

GET /market/tokens/:tokenId

GET /market/tokens/:tokenId/chart?range=1D

POST /swaps

GET /swaps/:id

POST /devices/push-token

GET /alerts

POST /alerts

PATCH /alerts/:id

Adapt instead of blindly duplicating existing routes.

============================================================
42. API VALIDATION
============================================================

Validate:
- chain
- wallet
- token
- address
- txHash
- pagination
- chart range
- amounts
- request body

Never trust client-supplied:
- confirmed
- successful
- blockNumber
- receipt
- gasUsed

Backend must verify these.

============================================================
43. AUTHORIZATION
============================================================

Wallet address alone does not prove ownership.

Ensure:
- authenticated user
- wallet belongs to user
- wallet-specific portfolio access is authorized
- swap history is authorized
- alerts are authorized
- push devices are authorized

Never allow:

User A
→ request User B wallet data

============================================================
44. DATABASE
============================================================

Use PostgreSQL for durable state.

Potential tables:

users

wallets

swap_transactions

wallet_transactions

portfolio_snapshots

notification_devices

notification_events

notification_deliveries

price_alerts

provider_usage_events

tokens where needed

Use:
- foreign keys
- indexes
- unique constraints
- migrations

Do not store continuously changing prices/balances every few seconds.

============================================================
45. DATABASE INDEXING
============================================================

Index based on real queries.

Important candidates:
- userId
- walletId
- chain
- txHash
- timestamp
- createdAt
- status
- nextAttemptAt
- alert enabled
- token identity

Avoid unnecessary indexes.

============================================================
46. PROVIDER ERROR HANDLING
============================================================

Each provider must have:

- timeout
- controlled retry
- error normalization
- metrics
- rate-limit handling
- circuit protection where appropriate

Retry:
- transient network errors
- selected 5xx

Do NOT blindly retry:
- 429 quota exhaustion
- invalid request
- authentication failure

============================================================
47. PROVIDER FALLBACK
============================================================

If multiple APIs already provide overlapping data:

Define a controlled priority.

Example:

Primary provider
↓
cached result
↓
secondary provider if legitimately configured
↓
stale cache
↓
database snapshot
↓
unavailable

Do not call all providers simultaneously unless there is a real reason.

Do not create duplicate upstream traffic.

============================================================
48. PROVIDER BUDGET
============================================================

Track provider usage.

For every external API request track:

- provider
- endpoint
- timestamp
- status
- latency
- cache hit/miss
- retry
- cost/weight where known

Make provider limits configurable.

Never assume a specific CoinStats plan/quota unless configured.

============================================================
49. APP FOREGROUND
============================================================

When app returns to foreground:

Do NOT blindly call every provider.

Use:

if cache fresh:
    return cached data

if cache expired:
    refresh

This keeps the app responsive and reduces unnecessary API calls.

============================================================
50. PULL-TO-REFRESH
============================================================

Pull-to-refresh means:

"User explicitly wants the newest available data."

Therefore:

force refresh
→ provider APIs
→ normalize
→ Redis
→ response
→ Redux

But concurrent pull-to-refresh operations must still be deduplicated.

============================================================
51. CACHE STRATEGY SUMMARY
============================================================

NORMAL REQUEST:

Client
→ Backend
→ Redis

Fresh:
→ return

Expired:
→ one refresh
→ provider
→ Redis
→ return

PULL TO REFRESH:

Client
→ Backend force refresh
→ lock
→ provider
→ Redis
→ latest response

CONCURRENT REQUESTS:

Many users
→ same cache key
→ one refresh
→ shared result

SWAP CONFIRMED:

Blockchain
→ confirmation
→ invalidate wallet cache
→ next portfolio request refreshes
→ actual wallet state
→ Redis

============================================================
52. DO NOT OVER-POLL
============================================================

REMOVE unnecessary:

30-second per-user polling.

Especially:

User A → provider every 30s
User B → provider every 30s
User C → provider every 30s

Instead:

short freshness window
+
user-driven refresh
+
shared cache
+
controlled backend refresh
+
swap-triggered invalidation
+
optional scheduled refresh for shared market data

============================================================
53. MARKET PROACTIVE REFRESH
============================================================

For highly popular shared market resources, a backend worker MAY refresh them proactively before/around expiration.

Example:

market snapshot
→ refresh periodically
→ Redis stays warm

This is acceptable because market data is shared.

Do NOT proactively poll every user's portfolio.

============================================================
54. STALE DATA
============================================================

Keep stale data only for controlled fallback.

Do not keep stale data indefinitely.

Example:

Fresh:
0–2 minutes

Stale but usable:
2–5 minutes

Hard expired:
after configured limit

These values are examples.

Make configurable.

If the product requirement requires newer data, use a shorter window.

============================================================
55. SECURITY
============================================================

Review:
- auth
- authorization
- CORS
- rate limits
- request validation
- SQL injection
- Redis key abuse
- SSRF
- payload size
- secret leakage
- logs
- wallet ownership

Secrets:
- environment variables only
- no committed credentials

Create/update:

server/.env.example

If real secrets are found in the repository:
- remove them
- recommend rotation
- do not expose them

============================================================
56. OBSERVABILITY
============================================================

Add structured logs/metrics.

Track:

API:
- latency
- status
- endpoint

Cache:
- hit
- miss
- stale
- refresh
- lock
- waiters

Provider:
- calls
- latency
- 429
- 5xx
- retries
- usage

Swap:
- submitted
- confirmed
- failed
- pending

Notifications:
- queued
- sent
- receipt
- retry
- invalid token

Workers:
- duration
- failures
- retries

Use request IDs.

============================================================
57. HEALTH CHECKS
============================================================

Add:

/health

/readiness

where appropriate.

Liveness:
process running

Readiness:
required dependencies available

Do not make liveness fail merely because an external market provider is temporarily unavailable.

============================================================
58. FAILURE RECOVERY
============================================================

If provider fails:

1. fresh Redis
2. stale Redis if acceptable
3. PostgreSQL snapshot where appropriate
4. controlled unavailable response

Never fabricate.

============================================================
59. UI MUST REMAIN UNCHANGED
============================================================

Do NOT redesign.

Preserve:
- Portfolio UI
- Market UI
- Swap UI
- Wallet UI
- charts
- cards
- colors
- typography
- spacing
- navigation
- tabs
- buttons

Only change:
- data source
- state synchronization
- loading/error handling
- refresh behavior when necessary

Use frontend adapters if backend DTOs change.

============================================================
60. EVM + SOLANA
============================================================

Support both correctly.

EVM:
- chain ID
- contract address
- native asset

Solana:
- mint
- SOL
- SPL

Do not mix:
- EVM address
- Solana mint
- symbol-only identity

============================================================
61. TESTING
============================================================

Test:

CACHE:
- hit
- miss
- expiry
- refresh
- concurrent requests
- lock owner
- lock waiter
- waiter does not call provider
- Redis failure

MARKET:
- multiple providers
- provider selection
- shared snapshot
- search
- pagination
- token chart

PORTFOLIO:
- real balances
- multiple chains
- price calculation
- missing price
- P/L unavailable
- snapshot
- chart

SWAP:
- real tx hash
- pending
- confirmed
- failed
- duplicate tx
- retry
- cache invalidation

NOTIFICATIONS:
- token registration
- event
- delivery
- retry
- invalid token
- idempotency

ALERTS:
- trigger
- cooldown
- re-arm
- duplicate prevention

AUTH:
- wallet authorization
- unauthorized access

============================================================
62. PERFORMANCE GOALS
============================================================

The important performance goals are architectural:

- cached API responses should be fast
- no provider call for every user render
- no 30-second client provider polling
- no cache stampede
- no duplicate provider calls for identical refreshes
- no provider request per alert
- no provider request per WebSocket client
- bounded database queries
- bounded provider pagination
- efficient Redis usage

Do not optimize by sacrificing data correctness.

============================================================
63. MULTIPLE API RULE — VERY IMPORTANT
============================================================

DO NOT REMOVE EXISTING MULTIPLE APIs.

Instead:

AUDIT THEM.

For every existing API/provider document internally:

Provider:
Purpose:
Used by:
Primary/secondary:
Cacheable:
TTL:
Refresh trigger:
Failure fallback:
Rate limit:
Cost:
Data source of truth:

If two APIs provide the same data:
- determine which should be primary
- use the other as fallback only where useful
- avoid calling both unnecessarily

If different APIs provide different data:
- keep both

If an API is redundant and truly unused:
- only remove it after verifying it is unnecessary
- do not remove it merely for architectural simplicity

============================================================
64. FINAL ARCHITECTURE
============================================================

Target architecture:

                  MOBILE APP
                      |
                Redux Toolkit
                      |
                 Backend API
                      |
          +-----------+-----------+
          |           |           |
       Redis      PostgreSQL   Provider Layer
          |                       |
          |              +--------+--------+
          |              |        |        |
          |          CoinStats  RPC    Swap APIs
          |              |        |        |
          |              +--------+--------+
          |
       Shared Cache
          |
       Pub/Sub
          |
    WS/SSE Gateway
          |
       Mobile clients

Provider Layer:
- preserve multiple APIs
- choose the correct source
- cache results
- control refresh
- handle fallback

============================================================
65. IMPLEMENTATION ORDER
============================================================

PHASE 0
Full repository audit
+
provider/API inventory
+
remove fake/synthetic production behavior

PHASE 1
Provider abstraction
+
provider responsibility
+
timeouts
+
retry
+
error handling
+
budget tracking

PHASE 2
Redis architecture
+
cache envelopes
+
TTL
+
locks
+
single-flight
+
SWR
+
fallback

PHASE 3
Market
+
shared cache
+
multiple providers
+
search
+
pagination
+
token-specific charts
+
gainers/categories

PHASE 4
Portfolio
+
real balances
+
real prices
+
short freshness cache
+
user-open refresh
+
pull-to-refresh force refresh
+
snapshots
+
history
+
transactions
+
DeFi

PHASE 5
Real swap lifecycle
+
real tx hash
+
confirmation worker
+
database
+
idempotency
+
cache invalidation

PHASE 6
Notifications
+
device registration
+
events
+
delivery
+
Expo tickets/receipts
+
retry
+
invalid-token cleanup

PHASE 7
Price alerts
+
shared market snapshot
+
cooldown
+
idempotency

PHASE 8
WebSocket/SSE
+
Redis Pub/Sub
+
snapshot versions
+
reconnect
+
multi-instance support

PHASE 9
Security
+
rate limiting
+
observability
+
health checks
+
performance
+
tests

============================================================
66. AFTER EACH PHASE
============================================================

After each phase:

1. Run typecheck.
2. Run lint.
3. Run relevant tests.
4. Validate database migrations.
5. Check frontend/backend compatibility.
6. Check for regressions.
7. Check provider request behavior.
8. Check Redis behavior.
9. Check that no fake/synthetic data was introduced.
10. Report changes before continuing.

============================================================
67. FINAL ACCEPTANCE CRITERIA
============================================================

DATA:
[ ] No fake production data
[ ] No random transaction hashes
[ ] No fake balances
[ ] No synthetic chart data
[ ] No fake DeFi
[ ] No fake P/L

MULTIPLE APIs:
[ ] Existing APIs preserved
[ ] Provider responsibilities documented
[ ] Provider abstraction implemented
[ ] No unnecessary duplicate provider calls
[ ] Correct fallback behavior
[ ] API keys protected

PORTFOLIO:
[ ] User opens Portfolio → freshness-aware API
[ ] Missing/expired cache → provider refresh
[ ] Fresh cache → immediate response
[ ] Pull-to-refresh → force fresh provider refresh
[ ] Concurrent refreshes deduplicated
[ ] Redis updated with latest data
[ ] Real balances
[ ] Real prices
[ ] Real history
[ ] Real transactions

MARKET:
[ ] Existing APIs preserved
[ ] Shared market cache
[ ] Short sensible TTL
[ ] Real prices
[ ] Real charts
[ ] Real search
[ ] Real gainers
[ ] Efficient pagination
[ ] Pull-to-refresh works

CACHE:
[ ] Redis
[ ] TTL
[ ] Freshness
[ ] Single-flight
[ ] Lock ownership
[ ] No waiter provider calls
[ ] Safe fallback
[ ] Metrics

SWAP:
[ ] Real blockchain submission
[ ] Real tx hash
[ ] Real receipt
[ ] Real confirmation
[ ] Idempotency
[ ] Cache invalidation
[ ] Actual portfolio refresh

NOTIFICATIONS:
[ ] Backend device registration
[ ] Durable events
[ ] Durable delivery
[ ] Retry
[ ] Receipt handling
[ ] Invalid token cleanup
[ ] Idempotency

SECURITY:
[ ] Authentication
[ ] Authorization
[ ] Wallet ownership
[ ] Input validation
[ ] Rate limiting
[ ] Secrets protected

PERFORMANCE:
[ ] No 30-second per-user provider polling
[ ] No cache stampede
[ ] No duplicate refresh storm
[ ] No unnecessary multi-provider calls
[ ] No unbounded queries

============================================================
68. FINAL REPORT
============================================================

At completion provide:

1. Architecture summary
2. Existing providers discovered
3. Providers retained
4. Providers changed
5. Why each provider is used
6. Files created
7. Files modified
8. Files removed
9. Database migrations
10. Redis keys
11. Cache TTLs
12. Refresh behavior
13. Pull-to-refresh behavior
14. Provider request strategy
15. Swap lifecycle
16. Notification architecture
17. Alert architecture
18. Real-time architecture
19. Security changes
20. Tests executed
21. Remaining limitations
22. Required environment variables
23. Deployment steps
24. Any provider/API limitations

FINAL RULE:

Do not claim production-ready merely because the application compiles.

Production-ready means:

REAL DATA
+
CORRECT SOURCE OF TRUTH
+
MULTIPLE EXISTING APIs PRESERVED
+
SMART PROVIDER SELECTION
+
SHORT/SENSIBLE CACHE
+
SINGLE-FLIGHT REFRESH
+
USER-INITIATED FORCE REFRESH
+
REAL BLOCKCHAIN CONFIRMATION
+
DURABLE DATABASE STATE
+
SECURE AUTHORIZATION
+
RELIABLE NOTIFICATIONS
+
OBSERVABILITY
+
TESTED FAILURE HANDLING
+
SCALABILITY
+
EXISTING UI PRESERVED

START NOW.

First inspect the entire repository and inventory every existing API/provider.

Do not remove existing APIs.

Then implement the system phase by phase according to this specification.