import axios from 'axios';

// ANSI colors for clean terminal visualization
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bgRed: '\x1b[41m\x1b[37m',
  bgGreen: '\x1b[42m\x1b[30m',
};

interface TestConfig {
  url: string;
  intervalMs: number;
  maxRequests: number;
  apiKey?: string;
}

const config: TestConfig = {
  url: process.env.TEST_URL || 'https://pro-api.coinmarketcap.com/public-api/v1/cryptocurrency/listings/latest?start=1&limit=10&convert=USD',
  intervalMs: 5000, // 5 seconds
  maxRequests: 20, // 20 requests = 100 seconds
  apiKey: process.env.COINMARKETCAP_API_KEY || '',
};

interface RequestRecord {
  index: number;
  timestamp: string;
  status: number;
  latencyMs: number;
  success: boolean;
  btcPrice?: number;
  errorCode?: number;
  errorMessage?: string;
  creditCount?: number;
}

const records: RequestRecord[] = [];

console.log(`${colors.cyan}${colors.bright}══════════════════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.bright}   COINMARKETCAP 5-SECOND RATE LIMIT TESTING SUITE${colors.reset}`);
console.log(`${colors.cyan}══════════════════════════════════════════════════════════════════════${colors.reset}`);
console.log(`Target URL : ${colors.yellow}${config.url}${colors.reset}`);
console.log(`Interval   : ${colors.green}${config.intervalMs / 1000}s (every 5 seconds)${colors.reset}`);
console.log(`Total Plan : ${colors.bright}${config.maxRequests} requests (~${(config.maxRequests * config.intervalMs) / 1000} seconds)${colors.reset}`);
console.log(`API Key    : ${config.apiKey ? colors.green + 'CONFIGURED' : colors.yellow + 'NONE (Anonymous Public API)'}${colors.reset}`);
console.log(`${colors.dim}----------------------------------------------------------------------${colors.reset}\n`);

let requestIndex = 0;
let isRunning = true;

async function executeRequest(index: number): Promise<boolean> {
  const startTime = Date.now();
  const timeStr = new Date().toLocaleTimeString();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'BitMarketRateLimitTester/1.0.0',
  };

  if (config.apiKey) {
    headers['X-CMC_PRO_API_KEY'] = config.apiKey;
  }

  try {
    const response = await axios.get(config.url, {
      headers,
      timeout: 8000,
    });

    const latencyMs = Date.now() - startTime;
    const data = response.data;
    const btcCoin = data?.data?.find?.((c: any) => c.symbol === 'BTC') || data?.data?.[0];
    const btcPrice = btcCoin?.quote?.USD?.price;
    const statusMeta = data?.status || {};

    const record: RequestRecord = {
      index,
      timestamp: timeStr,
      status: response.status,
      latencyMs,
      success: true,
      btcPrice,
      creditCount: statusMeta.credit_count,
    };
    records.push(record);

    console.log(
      `[${timeStr}] ${colors.bright}Req #${String(index).padStart(2, '0')}:${colors.reset} ` +
      `${colors.green}${colors.bright}${response.status} OK${colors.reset} | ` +
      `Latency: ${colors.cyan}${latencyMs}ms${colors.reset} | ` +
      `BTC: ${colors.yellow}$${btcPrice ? btcPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}${colors.reset} | ` +
      `Credit: ${colors.dim}${statusMeta.credit_count ?? 1}${colors.reset}`
    );

    return true;
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    const status = error.response?.status || 0;
    const errorBody = error.response?.data;
    const cmcStatus = errorBody?.status || {};

    const record: RequestRecord = {
      index,
      timestamp: timeStr,
      status,
      latencyMs,
      success: false,
      errorCode: cmcStatus.error_code,
      errorMessage: cmcStatus.error_message || error.message,
    };
    records.push(record);

    if (status === 429) {
      console.log(
        `\n[${timeStr}] ${colors.bgRed} RATE LIMIT HIT (429) ${colors.reset} ` +
        `${colors.red}${colors.bright}Req #${index} failed after ${latencyMs}ms${colors.reset}`
      );
      console.log(`${colors.red}  Error Code   : ${cmcStatus.error_code || '429'}${colors.reset}`);
      console.log(`${colors.red}  Error Message: "${cmcStatus.error_message || 'Too Many Requests'}"${colors.reset}`);
      if (error.response?.headers?.['retry-after']) {
        console.log(`${colors.yellow}  Retry-After  : ${error.response.headers['retry-after']}s${colors.reset}`);
      }
    } else {
      console.log(
        `[${timeStr}] ${colors.red}Req #${index} FAILED (${status || 'NETWORK'}): ${error.message}${colors.reset}`
      );
    }

    return false;
  }
}

function printSummary() {
  const total = records.length;
  const successful = records.filter((r) => r.success).length;
  const rateLimited = records.filter((r) => r.status === 429).length;
  const failed = total - successful;
  const avgLatency =
    successful > 0
      ? Math.round(records.filter((r) => r.success).reduce((acc, r) => acc + r.latencyMs, 0) / successful)
      : 0;

  console.log(`\n${colors.cyan}══════════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}                       TEST RESULTS SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}══════════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`Total Requests Sent : ${colors.bright}${total}${colors.reset}`);
  console.log(`Successful (200 OK) : ${colors.green}${successful}${colors.reset} (${((successful / (total || 1)) * 100).toFixed(0)}%)`);
  console.log(`Rate Limited (429)  : ${rateLimited > 0 ? colors.red : colors.green}${rateLimited}${colors.reset}`);
  console.log(`Other Failures      : ${failed - rateLimited > 0 ? colors.red : colors.dim}${failed - rateLimited}${colors.reset}`);
  console.log(`Average Latency     : ${colors.cyan}${avgLatency}ms${colors.reset}`);
  console.log(`${colors.dim}----------------------------------------------------------------------${colors.reset}`);

  console.log(`\n${colors.bright}📊 ARCHITECTURAL ANALYSIS & FINDINGS:${colors.reset}`);
  if (rateLimited > 0) {
    const firstHit = records.find((r) => r.status === 429);
    console.log(
      `${colors.red}❌ Direct 5s polling against CMC Anonymous Public API causes Rate Limiting at Request #${firstHit?.index}!${colors.reset}`
    );
    console.log(`   - Anonymous CMC API has strict burst limits for public callers.`);
    console.log(`   - At 5s intervals = 12 calls/min = 720 calls/hr = 518,400 calls/month.`);
    console.log(`   - Even with a Free CMC API Key (10,000 credits/mo), 5s polling exhausts the entire month in ~14 hours.`);
    console.log(`\n${colors.green}${colors.bright}💡 RECOMMENDED PRODUCTION WEBSOCKET ARCHITECTURE:${colors.reset}`);
    console.log(`   1. ${colors.bright}Binance WebSocket Ticker Feed (0 Rate Limit, 100% Free)${colors.reset}:`);
    console.log(`      - The backend connects once to Binance WebSocket (e.g. \`!miniTicker@arr\`).`);
    console.log(`      - Pushes sub-second price changes to backend in real-time with ZERO quota usage.`);
    console.log(`   2. ${colors.bright}Backend WebSocket Broadcast (/ws)${colors.reset}:`);
    console.log(`      - Backend aggregates the price updates and broadcasts to all mobile clients every 5s.`);
    console.log(`      - Mobile clients never hit external APIs; they only listen to the backend WebSocket.`);
  } else {
    console.log(
      `${colors.green}✔ All ${successful} requests succeeded without hitting 429 within this test duration.${colors.reset}`
    );
  }
  console.log(`${colors.cyan}══════════════════════════════════════════════════════════════════════${colors.reset}\n`);
}

async function runTest() {
  const timer = setInterval(async () => {
    if (!isRunning) return;

    requestIndex++;
    const ok = await executeRequest(requestIndex);

    // If rate limit hit or reached max requests, stop and summarize
    if (!ok && records[records.length - 1]?.status === 429) {
      isRunning = false;
      clearInterval(timer);
      printSummary();
      process.exit(0);
    }

    if (requestIndex >= config.maxRequests) {
      isRunning = false;
      clearInterval(timer);
      printSummary();
      process.exit(0);
    }
  }, config.intervalMs);

  // Run the first request immediately
  requestIndex = 1;
  const ok = await executeRequest(requestIndex);
  if (!ok && records[0]?.status === 429) {
    isRunning = false;
    clearInterval(timer);
    printSummary();
    process.exit(0);
  }
}

// Handle manual interrupt gracefully (Ctrl+C)
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Test interrupted by user.${colors.reset}`);
  printSummary();
  process.exit(0);
});

runTest();
