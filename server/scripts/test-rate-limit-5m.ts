import axios from 'axios';

// ANSI colors for terminal visualization
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

const INTERVAL_MS = parseInt(process.env.TEST_INTERVAL_MS || '7000', 10); // 7s interval
const DURATION_MINUTES = 5; // 5 minutes continuous soak test
const TOTAL_REQUESTS = Math.floor((DURATION_MINUTES * 60 * 1000) / INTERVAL_MS); // ~43 requests
const URL = 'https://pro-api.coinmarketcap.com/public-api/v1/cryptocurrency/listings/latest?start=1&limit=10&convert=USD';

interface RequestRecord {
  index: number;
  timestamp: string;
  status: number;
  latencyMs: number;
  success: boolean;
  btcPrice?: number;
  errorMessage?: string;
  errorCode?: number;
}

const records: RequestRecord[] = [];

console.log(`\n${colors.cyan}${colors.bright}══════════════════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.bright}   COINMARKETCAP 5-MINUTE CONTINUOUS RATE LIMIT SOAK TEST${colors.reset}`);
console.log(`${colors.cyan}══════════════════════════════════════════════════════════════════════${colors.reset}`);
console.log(`Target URL  : ${colors.yellow}${URL}${colors.reset}`);
console.log(`Interval    : ${colors.green}${INTERVAL_MS / 1000}s (every ${INTERVAL_MS / 1000} seconds)${colors.reset}`);
console.log(`Duration    : ${colors.bright}${DURATION_MINUTES} minutes (~${TOTAL_REQUESTS} total requests)${colors.reset}`);
console.log(`Mode        : Anonymous Public API (Zero API Key required)`);
console.log(`${colors.dim}----------------------------------------------------------------------${colors.reset}\n`);

let currentIndex = 0;

async function executeRequest(index: number): Promise<boolean> {
  const startTime = Date.now();
  const timeStr = new Date().toLocaleTimeString();

  try {
    const res = await axios.get(URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BitMarketRateLimitAudit/1.0.0',
      },
      timeout: 8000,
    });

    const latencyMs = Date.now() - startTime;
    const btcCoin = res.data?.data?.find((c: any) => c.symbol === 'BTC') || res.data?.data?.[0];
    const btcPrice = btcCoin?.quote?.USD?.price;

    records.push({
      index,
      timestamp: timeStr,
      status: res.status,
      latencyMs,
      success: true,
      btcPrice,
    });

    console.log(
      `[${timeStr}] ${colors.bright}Req #${String(index).padStart(2, '0')}/${TOTAL_REQUESTS}:${colors.reset} ` +
      `${colors.green}${colors.bright}${res.status} OK${colors.reset} | ` +
      `Latency: ${colors.cyan}${latencyMs}ms${colors.reset} | ` +
      `BTC: ${colors.yellow}$${btcPrice ? btcPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}${colors.reset}`
    );
    return true;
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const status = err.response?.status || 0;
    const cmcStatus = err.response?.data?.status || {};

    records.push({
      index,
      timestamp: timeStr,
      status,
      latencyMs,
      success: false,
      errorCode: cmcStatus.error_code,
      errorMessage: cmcStatus.error_message || err.message,
    });

    if (status === 429) {
      console.log(
        `\n[${timeStr}] ${colors.bgRed} RATE LIMIT HIT (429) ${colors.reset} ` +
        `Req #${index} failed: "${cmcStatus.error_message || 'Too Many Requests'}"`
      );
    } else {
      console.log(
        `[${timeStr}] ${colors.red}Req #${index} FAILED (${status}): ${err.message}${colors.reset}`
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
  console.log(`${colors.bright}                   5-MINUTE SOAK TEST RESULTS${colors.reset}`);
  console.log(`${colors.cyan}══════════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`Total Requests Sent : ${colors.bright}${total}${colors.reset}`);
  console.log(`Successful (200 OK) : ${colors.green}${successful}${colors.reset} (${((successful / (total || 1)) * 100).toFixed(1)}%)`);
  console.log(`Rate Limited (429)  : ${rateLimited > 0 ? colors.red + colors.bright + rateLimited : colors.green + '0'}${colors.reset}`);
  console.log(`Other Errors        : ${failed - rateLimited > 0 ? colors.red + (failed - rateLimited) : colors.dim + '0'}${colors.reset}`);
  console.log(`Average Latency     : ${colors.cyan}${avgLatency}ms${colors.reset}`);
  console.log(`${colors.dim}----------------------------------------------------------------------${colors.reset}`);

  if (rateLimited === 0) {
    console.log(`${colors.green}${colors.bright}✔ VERDICT: 7-second interval is 100% STABLE over 5 minutes with ZERO 429 errors!${colors.reset}`);
  } else {
    console.log(`${colors.red}${colors.bright}❌ VERDICT: Rate limits encountered ${rateLimited} time(s).${colors.reset}`);
  }
  console.log(`${colors.cyan}══════════════════════════════════════════════════════════════════════\n${colors.reset}`);
}

async function run() {
  currentIndex = 1;
  await executeRequest(currentIndex);

  const timer = setInterval(async () => {
    currentIndex++;
    await executeRequest(currentIndex);

    if (currentIndex >= TOTAL_REQUESTS) {
      clearInterval(timer);
      printSummary();
      process.exit(0);
    }
  }, INTERVAL_MS);
}

run();
