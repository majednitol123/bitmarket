You have already implemented the previous 9-phase production architecture for this existing crypto swap aggregator.

NOW I want to add and integrate an ENTERPRISE-LEVEL PRICE ALERT SYSTEM.

IMPORTANT:
This is an ADDITIVE integration task.

DO NOT rebuild the previous architecture.
DO NOT restart the previous phases.
DO NOT replace existing implementations.
DO NOT remove existing providers/APIs.
DO NOT redesign the existing UI.

First inspect what has already been implemented by the previous 9 phases and integrate Price Alerts into that architecture.

==================================================
1. FIRST: AUDIT EXISTING IMPLEMENTATION
==================================================

Before changing code, inspect the current implementation of:

- Market providers
- Provider abstraction/orchestration
- Redis/cache layer
- Market snapshots
- PostgreSQL schema
- Authentication/authorization
- Notification system
- Notification workers
- WebSocket/SSE/realtime system
- Background workers/jobs
- Redux Toolkit
- React Native token detail/market screens
- Existing API conventions
- Existing error handling
- Existing rate limiting
- Existing observability

Determine what already exists.

REUSE existing functionality wherever possible.

Do not create duplicate services.

If the previous implementation already has a suitable abstraction, extend it instead of creating another abstraction.

==================================================
2. PRICE ALERT USER FLOW
==================================================

The existing mobile UI should allow:

Token Detail
    ↓
Price Alert
    ↓
Above / Below
    ↓
Target Price
    ↓
Create Alert

Example:

ETH current price:
$3,850

User selects:

Above $4,000

Creates alert.

The UI should show:

ETH
Above $4,000
Current price: $3,850
Status: Armed

When the market price crosses $4,000:

ETH Price Alert
ETH reached your target price of $4,000.

The existing UI design must remain unchanged.

Reuse existing components/design system.

==================================================
3. CRITICAL ARCHITECTURE RULE
==================================================

Price Alerts MUST use the EXISTING shared market-price architecture.

The alert system must NOT create its own independent price polling system.

DO NOT implement:

setInterval(() => fetchPrice(), 30000)

per user.

DO NOT implement:

one provider request per alert.

DO NOT implement:

one provider request per user.

Instead:

Existing Market Provider Architecture
                ↓
        Normalized Market Data
                ↓
        Redis Market Snapshot
                ↓
       Price Alert Evaluator
                ↓
        Matching Alerts
                ↓
       Notification Events
                ↓
      Notification Worker
                ↓
        Push Notification

==================================================
4. MULTIPLE PROVIDERS MUST REMAIN
==================================================

The application already uses multiple APIs/providers.

PRESERVE THEM.

Do not make CoinStats the only provider.

Use the existing provider abstraction/orchestrator.

The alert engine should consume normalized market prices without caring which provider supplied them.

For example:

MarketProviderOrchestrator
        ↓
normalized TokenPrice
        ↓
market snapshot
        ↓
PriceAlertEvaluator

Provider selection should continue to respect:

- provider priority
- provider health
- rate limits
- quotas
- fallback strategy
- existing cache strategy

Do not bypass the existing provider architecture.

==================================================
5. DATABASE
==================================================

Inspect the existing PostgreSQL schema first.

If Price Alerts do not already exist, add a proper migration.

Create a durable price_alerts table.

Suggested fields:

id
userId
chain
tokenAddress
tokenId
symbol
condition
threshold
currency
enabled
status
lastEvaluatedPrice
lastEvaluatedAt
triggeredAt
cooldownUntil
createdAt
updatedAt

Conditions:

ABOVE
BELOW

Statuses may include:

ARMED
TRIGGERED
DISABLED

Use the naming conventions already used by the project.

Add appropriate indexes based on actual query patterns.

Important lookup pattern:

chain + token + enabled alerts

Do NOT scan every user's alerts whenever a market price changes.

==================================================
6. CREATE ALERT API
==================================================

Implement using the existing API architecture:

POST /alerts

Example:

{
  "chain": "ethereum",
  "tokenAddress": "0x...",
  "condition": "ABOVE",
  "threshold": "4000",
  "currency": "USD"
}

Validate:

- authenticated user
- valid chain
- valid token
- valid token address
- valid condition
- valid threshold
- supported currency
- supported token
- user alert limits

Never trust userId from the request body.

Get user identity from authenticated context.

Never trust arbitrary token metadata from the client.

==================================================
7. USE SHARED CURRENT PRICE
==================================================

When creating an alert:

If the existing Redis market snapshot is fresh:

USE IT.

Do NOT make another provider request.

Example:

Redis:

ETH = $3,850

User creates:

ABOVE $4,000

The API should create the alert using the existing market snapshot.

Only if no usable/fresh price exists should the existing market-provider orchestration be used to obtain one.

Do NOT create an alert-specific provider implementation.

==================================================
8. THRESHOLD CROSSING
==================================================

Do NOT implement:

if currentPrice >= threshold:
    trigger

That would repeatedly trigger notifications.

Implement true crossing detection.

For ABOVE:

previousPrice < threshold
AND
currentPrice >= threshold

=> upward crossing.

For BELOW:

previousPrice > threshold
AND
currentPrice <= threshold

=> downward crossing.

Handle equality consistently.

Document the chosen semantics.

==================================================
9. EXAMPLE
==================================================

Alert:

ETH ABOVE $4,000

Price snapshots:

$3,950
$3,980
$4,025

Trigger exactly once when crossing occurs.

Then:

$4,050
$4,100
$4,200

DO NOT trigger again.

If price later falls:

$3,980

the alert becomes eligible for another upward crossing.

Later:

$4,010

It may trigger again according to the configured re-arm/cooldown policy.

==================================================
10. BELOW ALERT
==================================================

Example:

ETH BELOW $3,500

Price:

$3,600
$3,550
$3,490

Trigger.

Then:

$3,450
$3,400

Do not repeatedly notify.

Price returns:

$3,550

Re-arm.

Later:

$3,480

Trigger again.

==================================================
11. RE-ARM + COOLDOWN
==================================================

Implement the existing project's alert state model if one already exists.

Otherwise support:

- ARMED
- TRIGGERED
- re-arm
- cooldown

Example:

Cooldown = 30 minutes.

Rapid fluctuations around the threshold must not generate notification spam.

Cooldown must be enforced server-side.

Do not rely on the mobile application for correctness.

==================================================
12. IDEMPOTENCY
==================================================

This is mandatory.

Duplicate market events must not produce duplicate notifications.

Handle:

- duplicate provider responses
- duplicate market snapshot events
- Redis Pub/Sub duplicates
- worker retries
- multiple workers
- API retries
- backend restarts

Create a deterministic idempotency key.

For example:

price-alert:{alertId}:{crossingVersion}

Use PostgreSQL uniqueness constraints where appropriate.

Never use random idempotency keys.

==================================================
13. CONCURRENT WORKERS
==================================================

The system may have multiple workers/backend instances.

Two workers must never successfully trigger the same crossing.

Use:

PostgreSQL transaction/row locking

and/or

the existing distributed locking mechanism.

Prefer PostgreSQL as the durable correctness boundary.

The trigger operation should be atomic:

BEGIN

lock alert

verify state

verify threshold crossing

update alert state

create notification event with unique idempotency key

COMMIT

If another worker already processed it:

do nothing.

==================================================
14. ALERT EVALUATOR
==================================================

Create or extend the existing market event/evaluation architecture.

Example:

PriceAlertEvaluator

Input:

MarketSnapshot

Responsibilities:

1. Receive normalized market snapshot.
2. Identify relevant enabled alerts.
3. Compare previous/current price.
4. Detect threshold crossing.
5. Apply cooldown/re-arm rules.
6. Atomically update alert state.
7. Create notification event.
8. Prevent duplicate processing.

Only evaluate alerts for the affected token.

Example:

ETH price update

→ evaluate ETH alerts

NOT:

→ evaluate every alert in the database.

==================================================
15. HIGH-SCALE QUERYING
==================================================

The system must support large numbers of alerts.

Potential scenario:

100,000 ETH alerts
50,000 BTC alerts
many other tokens

When ETH changes:

Only query relevant ETH alerts.

Use PostgreSQL indexes and batching.

Do not:

load every alert into memory.

Do not:

perform N+1 database queries.

Process large alert sets in batches.

==================================================
16. NOTIFICATION ARCHITECTURE
==================================================

Use the existing notification infrastructure created by the previous implementation.

Do NOT create a second notification system if one already exists.

Preferred flow:

PriceAlertEvaluator
        ↓
notification_events
        ↓
Notification Worker
        ↓
Push Provider
        ↓
Mobile Device

The evaluator should create a durable notification event.

Push delivery should happen asynchronously.

==================================================
17. PUSH NOTIFICATION
==================================================

Use the existing Expo/mobile push notification implementation.

When triggered:

Title:

ETH Price Alert

Body:

ETH reached your target price of $4,000.

Payload should contain safe identifiers such as:

{
  "type": "PRICE_ALERT",
  "alertId": "...",
  "chain": "ethereum",
  "tokenAddress": "0x..."
}

Do not treat notification payload data as authoritative state.

The mobile application should fetch authoritative state when needed.

==================================================
18. IN-APP NOTIFICATION
==================================================

If the previous 9-phase implementation has durable in-app notifications:

create an in-app notification for the triggered alert.

Example:

ETH reached your target price of $4,000.

Push delivery and alert triggering are separate states.

Even if push delivery fails, the alert trigger must remain durable.

==================================================
19. NOTIFICATION RETRIES
==================================================

Reuse the existing notification worker.

Support:

- retry
- exponential backoff
- maximum retry count
- permanent failure
- invalid/expired device token handling

Do not retry permanently invalid tokens forever.

==================================================
20. ALERT MANAGEMENT
==================================================

Implement using existing API conventions:

POST   /alerts
GET    /alerts
GET    /alerts/:id
PATCH  /alerts/:id
DELETE /alerts/:id

Support:

- create
- list
- update threshold
- change ABOVE/BELOW
- enable
- disable
- delete

All operations require authentication.

Users can only access their own alerts.

==================================================
21. MOBILE REDUX
==================================================

Inspect the existing Redux Toolkit implementation.

If alert state already exists:

extend it.

Otherwise create an appropriate alert slice.

Support:

fetchAlerts
createAlert
updateAlert
deleteAlert
enableAlert
disableAlert

Handle:

loading
refreshing
creating
updating
deleting
errors

Do not duplicate market price state unnecessarily.

Reuse existing market/token state for current price.

==================================================
22. REALTIME
==================================================

If the existing system already uses Redis Pub/Sub + WebSocket/SSE:

integrate Price Alerts into it.

Example:

PriceAlertEvaluator
        ↓
Redis Pub/Sub
        ↓
Realtime Gateway
        ↓
Mobile App

Realtime event:

PRICE_ALERT_TRIGGERED

Payload:

alertId
snapshotVersion
token identifier

Do not put large payloads into Redis Pub/Sub.

Pub/Sub is propagation only.

Persistent state remains PostgreSQL.

If the client reconnects:

fetch latest state.

==================================================
23. MARKET CACHE
==================================================

Use the existing cache envelope and TTL strategy.

Do not create a separate price-alert cache.

The alert system should consume the existing market snapshot.

Example:

market:snapshot:{chain}:{token}

Use whatever key structure already exists.

If the previous architecture has:

schemaVersion
generatedAt
freshUntil
staleUntil
source
snapshotVersion

continue using it.

==================================================
24. STALE DATA PROTECTION
==================================================

Never trigger an alert using dangerously stale market data.

Validate:

- timestamp
- freshness
- price > 0
- provider source
- snapshot version

If the market snapshot is too old:

do not trigger a new alert from it.

Use the existing provider refresh architecture.

==================================================
25. PROVIDER FAILURE
==================================================

If the primary market provider fails:

use the existing fallback provider strategy.

Do not blindly call every provider.

Do not blindly retry HTTP 429.

Do not rotate API keys to evade provider quotas.

Respect the existing provider budget/rate-limit system.

==================================================
26. NO PER-ALERT POLLING
==================================================

This is one of the most important requirements.

NEVER implement:

Alert 1 → provider request
Alert 2 → provider request
Alert 3 → provider request

Instead:

Token market refresh
        ↓
ONE normalized market snapshot
        ↓
ALL relevant alerts evaluated

The number of provider requests must depend primarily on monitored assets/provider refresh policy, NOT:

number of users × number of alerts.

==================================================
27. ALERT LIMITS
==================================================

Use existing rate limiting/configuration.

If alert limits do not exist, introduce configurable limits such as:

MAX_ALERTS_PER_USER
MAX_ACTIVE_ALERTS_PER_USER
ALERT_CREATE_RATE_LIMIT

Do not hardcode arbitrary product limits without checking the existing project configuration.

==================================================
28. SECURITY
==================================================

Ensure:

- authentication
- authorization
- ownership validation
- input validation
- rate limiting
- safe SQL/ORM queries
- safe error responses

Never allow:

user A → access user B's alert.

Never trust:

userId from client.

==================================================
29. OBSERVABILITY
==================================================

Integrate with the existing logging/metrics system.

Track:

alerts_created
alerts_updated
alerts_deleted
alerts_triggered
alerts_evaluated
alert_evaluation_duration
alert_crossing_detected
alert_cooldown_skipped
notification_events_created
notification_sent
notification_failed
notification_retried

Also track provider/cache metrics using the existing observability architecture.

==================================================
30. TESTING
==================================================

Add tests to the existing test architecture.

Unit tests:

- ABOVE crossing
- BELOW crossing
- equality
- no crossing
- re-arm
- cooldown
- duplicate snapshot
- duplicate event
- stale price
- invalid price

Integration tests:

- create alert
- list alerts
- update alert
- delete alert
- trigger alert
- notification event
- authorization

Concurrency tests:

- two workers process same alert
- duplicate Pub/Sub event
- simultaneous market updates
- concurrent alert evaluation

Expected:

ONE crossing = ONE notification event.

==================================================
31. FAILURE RECOVERY
==================================================

Verify behavior after:

- Redis restart
- PostgreSQL restart
- worker restart
- API restart
- Pub/Sub reconnect
- notification provider failure
- market provider failure

PostgreSQL must retain alert configuration.

Redis must not be the only location containing alert state.

==================================================
32. NO FAKE DATA
==================================================

Absolutely do NOT introduce:

- fake prices
- random prices
- fake trigger timers
- fake notification success
- random alert IDs
- fake push responses
- synthetic market data

Everything must be connected to the real existing backend architecture.

==================================================
33. IMPORTANT INTEGRATION RULE
==================================================

Do not duplicate anything that the previous 9 phases already implemented.

Before creating a new:

- Redis service
- market service
- notification service
- worker
- provider abstraction
- WebSocket gateway
- authentication layer
- database abstraction

check whether an existing implementation already provides it.

Extend/refactor the existing implementation instead.

==================================================
34. IMPLEMENTATION PROCESS
==================================================

Step 1:
Audit the existing 9-phase implementation.

Step 2:
Create an implementation map:

Existing component
→ Reuse / Extend / Refactor

Step 3:
Implement database migration.

Step 4:
Implement alert domain/service.

Step 5:
Implement REST API.

Step 6:
Integrate with existing market snapshots.

Step 7:
Implement threshold-crossing evaluator.

Step 8:
Implement atomic/idempotent triggering.

Step 9:
Integrate existing notification worker.

Step 10:
Integrate existing realtime system.

Step 11:
Integrate existing React Native UI.

Step 12:
Integrate Redux Toolkit.

Step 13:
Add tests.

Step 14:
Run typecheck, lint, tests, migration validation and build.

==================================================
35. ACCEPTANCE CRITERIA
==================================================

The feature is complete only when:

[ ] User can create ABOVE alert.
[ ] User can create BELOW alert.
[ ] User can view alerts.
[ ] User can update alerts.
[ ] User can enable/disable alerts.
[ ] User can delete alerts.
[ ] Alerts persist in PostgreSQL.
[ ] Existing providers remain intact.
[ ] Existing market architecture remains intact.
[ ] Shared market snapshots drive evaluation.
[ ] No provider request per alert.
[ ] No provider request per user.
[ ] Fresh cached price is reused during alert creation.
[ ] Threshold crossing works correctly.
[ ] ABOVE works.
[ ] BELOW works.
[ ] Re-arm works.
[ ] Cooldown works.
[ ] Duplicate events cannot duplicate triggers.
[ ] Multiple workers cannot double-trigger.
[ ] Notification events are durable.
[ ] Push notification works through existing notification infrastructure.
[ ] In-app notification works where supported.
[ ] Realtime notification works where supported.
[ ] User ownership is enforced.
[ ] Provider failure is handled.
[ ] Stale data is protected.
[ ] Redis failure is recoverable.
[ ] Worker restart is recoverable.
[ ] No fake/random/synthetic behavior exists.
[ ] Tests pass.
[ ] Existing functionality remains compatible.
[ ] Existing UI design remains unchanged.

==================================================
36. FINAL REPORT
==================================================

After implementation, report:

1. What already existed from the previous 9 phases.
2. What was reused.
3. What was extended.
4. What was refactored.
5. New files.
6. Modified files.
7. Database migrations.
8. API endpoints.
9. Redis keys/events.
10. Alert evaluation flow.
11. Crossing/re-arm logic.
12. Notification flow.
13. Realtime integration.
14. Security.
15. Tests executed.
16. Build/typecheck/lint results.
17. Any remaining limitations.

Do not claim completion unless the implementation was actually verified.