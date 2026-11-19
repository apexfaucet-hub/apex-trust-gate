import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyReceipt, wrapTool, FirewallBlockedError, rfc8785Stringify } from '../index.mjs';

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

test('verifyReceipt verifies valid Ed25519 signature and rejects tampered claims', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubJwk = publicKey.export({ format: 'jwk' });
  pubJwk.kid = 'test-ed25519-1';

  const claims = { version: 'apex-firewall/1.0', decision: 'ALLOW', amountUsd: 12 };
  const prot = b64url(JSON.stringify({ alg: 'EdDSA', kid: pubJwk.kid }));
  const payload = b64url(Buffer.from(rfc8785Stringify(claims), 'utf8'));
  const sig = b64url(crypto.sign(null, Buffer.from(`${prot}.${payload}`, 'utf8'), privateKey));
  const att = { signed: true, kid: pubJwk.kid, protected: prot, signature: sig };

  const ok = await verifyReceipt(claims, att, { keys: [pubJwk] });
  assert.equal(ok.ok, true);
  assert.equal(ok.kid, 'test-ed25519-1');

  const tampered = await verifyReceipt({ ...claims, amountUsd: 9999 }, att, { keys: [pubJwk] });
  assert.equal(tampered.ok, false);
});

test('wrapTool passes ALLOW and throws FirewallBlockedError on DENY', async () => {
  const allowed = wrapTool(async ({ n }) => n * 3, {
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, decision: 'ALLOW' }) }),
  });
  const res = await allowed({ n: 7, amountUsd: 5 });
  assert.equal(res.output, 21);
  assert.equal(res.firewall.decision, 'ALLOW');

  const denied = wrapTool(async () => 'never', {
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, decision: 'DENY', reasons: ['cap_exceeded'] }) }),
  });
  await assert.rejects(() => denied({ amountUsd: 500 }), FirewallBlockedError);
});
