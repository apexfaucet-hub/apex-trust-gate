# `@apexfaucet/trust-gate`

Zero-dependency drop-in ESM SDK & middleware for the **APEX Agent Trust Stack** (`https://apexfaucet.xyz`):

- **`firewall()`** — Pre-payment & pre-tool policy gate (`ALLOW` / `HOLD_FOR_HUMAN` / `DENY`) with per-tx & daily USD caps, allowlists, phishing checks, prompt-injection scan, secret/PII leak blocking, and Ed25519 receipts (`$0.005`/call, free 10/day demo at `https://apexfaucet.xyz/firewall/`).
- **`gradeWork()`** — Post-work escrow grader (`PASS_RELEASE` / `REVISE` / `REJECT_REFUND`) for ERC-8183 / G2 Jobs / MCP deliverables (`$0.004`/call, free 10/day demo at `https://apexfaucet.xyz/grade/`).
- **`tradeEdge()`** — 5-exchange funding rate arbitrage, 10-chain rug/MEV shield, and Quarter-Kelly anti-tilt sizing (`$0.005`/call, free live radar at `https://apexfaucet.xyz/trade/`).
- **`launchAudit()`** — 1-call production launch readiness audit + Ed25519 `LaunchReadinessCertificate` for any AI agent, MCP server, or x402 API (`$0.02`/call).
- **`veritasNotary()`** — Hash-chained Ed25519 Proof-of-Execution Notary (`$0.01`/call, 10 free/day at `https://apexfaucet.xyz/veritas/`) linking multi-agent workflow steps with free public verification (`/api/veritas/verify/:hash`).
- **`agentCredit()`** — Machine Credit Bureau (`$0.005`/call) returning a 300–950 Autonomous Credit Score and directly pluggable `agent-firewall` spend limits (`maxTxUsd`, `dailyCapUsd`, `humanApproveOverUsd`, `escrowCollateralPct`).
- **`verifyReceipt()`** — Pure WebCrypto offline Ed25519 + RFC-8785 verification against `https://apexfaucet.xyz/.well-known/jwks.json` (works in Node 20+, Cloudflare Workers, Deno, Bun, browsers).
- **`wrapTool()`** — 3-line middleware wrapping any MCP, LangGraph, or OpenAI Agents SDK tool with automatic pre-call firewall enforcement and optional post-call work grading.

## Install

```bash
npm install github:apexfaucet-hub/apex-trust-gate
```

Or import directly (Deno / Bun / ESM):

```js
import { wrapTool, firewall, gradeWork, launchAudit, verifyReceipt } from 'https://apexfaucet.xyz/sdk/apex-trust-gate.mjs';
```

## Quick Start

```js
import { wrapTool, FirewallBlockedError } from '@apexfaucet/trust-gate';

const safePay = wrapTool(
  async ({ payee, amountUsd }) => ({ paid: true, payee, amountUsd }),
  {
    apiKey: process.env.APEX_API_KEY, // Card API key from https://apexfaucet.xyz/pass/ (or freeDemo: true for 10/day)
    policy: { maxTxUsd: 25, humanApproveOverUsd: 10, blockPromptInjection: true, blockPiiLeak: true },
  }
);

try {
  const { output, firewall } = await safePay({ payee: '0x...', amountUsd: 8 });
  console.log('Allowed & offline-verified:', firewall.verifiedOffline.ok, output);
} catch (err) {
  if (err instanceof FirewallBlockedError) {
    console.warn('Blocked by APEX Firewall:', err.decision, err.reasons);
  }
}
```

## Offline Ed25519 Receipt Verification

```js
import { verifyReceipt } from '@apexfaucet/trust-gate';

// Automatically fetches https://apexfaucet.xyz/.well-known/jwks.json (cached)
const check = await verifyReceipt(receipt.claims, receipt.attestation);
console.log(check); // { ok: true, kid: 'apex-flux-ed25519-1' }
```

## License

MIT
