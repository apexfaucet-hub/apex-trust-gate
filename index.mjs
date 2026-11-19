// @apexfaucet/trust-gate — Zero-dependency Ed25519 Agent Firewall, Work Grader & Quant Shield SDK
// Works in Node 20+, Deno, Bun, Cloudflare Workers, and browsers (WebCrypto Ed25519).
// Docs: https://apexfaucet.xyz/firewall/ | https://apexfaucet.xyz/grade/ | https://apexfaucet.xyz/trade/
// Card API Key ($5 / $20 +25% / $50 +30%): https://apexfaucet.xyz/pass/

const DEFAULT_BASE = 'https://apexfaucet.xyz';
const JWKS_CACHE = { at: 0, data: null };

export class FirewallBlockedError extends Error {
  constructor(decision, reasons, receipt) {
    super(`APEX Firewall blocked action (${decision}): ${(reasons || []).join('; ') || 'policy violation'}`);
    this.name = 'FirewallBlockedError';
    this.decision = decision;
    this.reasons = reasons || [];
    this.receipt = receipt;
  }
}

export function rfc8785Stringify(val) {
  if (val === null || typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return '[' + val.map(rfc8785Stringify).join(',') + ']';
  const keys = Object.keys(val).filter((k) => val[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + rfc8785Stringify(val[k])).join(',') + '}';
}

function b64urlEncodeBytes(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecodeBytes(str) {
  const s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function fetchJwks(baseUrl = DEFAULT_BASE, fetchImpl = fetch) {
  if (JWKS_CACHE.data && Date.now() - JWKS_CACHE.at < 300_000) return JWKS_CACHE.data;
  const r = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/.well-known/jwks.json`);
  if (!r.ok) throw new Error(`JWKS fetch failed: HTTP ${r.status}`);
  const j = await r.json();
  JWKS_CACHE.at = Date.now();
  JWKS_CACHE.data = j;
  return j;
}

export async function verifyReceipt(claims, attestation, jwksOrBase = DEFAULT_BASE, fetchImpl = fetch) {
  if (!claims || !attestation || !attestation.signed || !attestation.protected || !attestation.signature) {
    return { ok: false, reason: 'unsigned' };
  }
  const jwks = typeof jwksOrBase === 'string' ? await fetchJwks(jwksOrBase, fetchImpl) : jwksOrBase;
  const keys = Array.isArray(jwks && jwks.keys) ? jwks.keys : [];
  const jwk = keys.find((k) => k.kid === attestation.kid) || keys[0];
  if (!jwk) return { ok: false, reason: 'key not found in JWKS' };
  const enc = new TextEncoder();
  const canonical = rfc8785Stringify(claims);
  const signingInput = enc.encode(`${attestation.protected}.${b64urlEncodeBytes(enc.encode(canonical))}`);
  const sigBytes = b64urlDecodeBytes(attestation.signature);
  const pubKey = await crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['verify']);
  const ok = await crypto.subtle.verify('Ed25519', pubKey, sigBytes, signingInput);
  return { ok, kid: jwk.kid };
}

async function postApex(path, body, opts = {}) {
  const baseUrl = (opts.baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  const fetchImpl = opts.fetch || fetch;
  const apiKey = opts.apiKey || (typeof process !== 'undefined' && process.env && process.env.APEX_API_KEY) || '';
  const headers = { 'content-type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;
  if (opts.paymentSignature) headers['payment-signature'] = opts.paymentSignature;
  const r = await fetchImpl(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
  if (r.status === 402) return Object.assign({ ok: false, paymentRequired: true, status: 402, passUrl: `${baseUrl}/pass/` }, j);
  if (!r.ok) throw new Error(j.error || `APEX HTTP ${r.status}`);
  if (opts.verifyOffline !== false && j.claims && j.attestation && j.attestation.signed) {
    j.verifiedOffline = await verifyReceipt(j.claims, j.attestation, opts.jwks || baseUrl, fetchImpl);
  }
  return j;
}

export async function firewall(payload, opts = {}) {
  const path = opts.freeDemo ? '/api/firewall/evaluate' : '/api/x402/agent-firewall';
  const res = await postApex(path, payload, opts);
  if (opts.throwOnBlock && res.ok && res.decision !== 'ALLOW') {
    throw new FirewallBlockedError(res.decision, res.reasons, res);
  }
  return res;
}

export async function gradeWork(payload, opts = {}) {
  const path = opts.freeDemo ? '/api/grade/evaluate' : '/api/x402/work-grade';
  return await postApex(path, payload, opts);
}

export async function tradeEdge(payload, opts = {}) {
  return await postApex('/api/x402/trade-edge', payload, opts);
}

export async function launchAudit(payload, opts = {}) {
  return await postApex('/api/x402/agent-launch-audit', payload, opts);
}

export async function veritasNotary(payload, opts = {}) {
  const path = opts.freeDemo ? '/api/veritas/notarize-demo' : '/api/x402/veritas-notary';
  return await postApex(path, payload, opts);
}

export async function agentCredit(payload, opts = {}) {
  return await postApex('/api/x402/agent-credit', payload, opts);
}

export async function workCommons(payload, opts = {}) {
  const path = opts.freeDemo ? '/api/synapse/search-demo' : '/api/x402/work-commons';
  return await postApex(path, payload, opts);
}

export async function workMint(payload, opts = {}) {
  const path = opts.freeDemo ? '/api/synapse/mint-demo' : '/api/x402/work-mint';
  return await postApex(path, payload, opts);
}

export async function agentMemory(payload, opts = {}) {
  const path = opts.freeDemo ? '/api/memory/demo' : '/api/x402/agent-memory';
  return await postApex(path, payload, opts);
}

export async function deepResearch(payload, opts = {}) {
  const path = opts.freeDemo ? '/api/research/demo' : '/api/x402/deep-research';
  return await postApex(path, payload, opts);
}

export async function agentSpotlight(payload, opts = {}) {
  return await postApex('/api/x402/agent-spotlight', payload, opts);
}

export async function aiInfraStatus(payload = {}, opts = {}) {
  return await postApex('/api/x402/ai-infra-status', payload, opts);
}

export async function cryptoPulse(payload = {}, opts = {}) {
  return await postApex('/api/x402/crypto-pulse', payload, opts);
}

export function wrapTool(toolFn, config = {}) {
  return async function guardedTool(args = {}) {
    const fw = await firewall({
      agentId: config.agentId || 'wrapped-agent',
      action: config.action || 'call_tool',
      policy: config.policy || { maxTxUsd: 25, blockPromptInjection: true, blockPiiLeak: true },
      target: {
        amountUsd: args.amountUsd ?? args.amount_usd,
        payee: args.payee,
        url: args.url,
        prompt: args.prompt || args.text,
        payloadText: args.payloadText,
      },
    }, Object.assign({ throwOnBlock: true }, config));

    const output = await toolFn(args, { firewallReceipt: fw });
    if (config.gradeTask) {
      const grade = await gradeWork({
        task: typeof config.gradeTask === 'function' ? config.gradeTask(args) : config.gradeTask,
        expectedFormat: config.expectedFormat || 'any',
        requiredFields: config.requiredFields,
        output: typeof output === 'string' ? output : JSON.stringify(output),
      }, config);
      return { output, firewall: fw, grade };
    }
    return { output, firewall: fw };
  };
}
