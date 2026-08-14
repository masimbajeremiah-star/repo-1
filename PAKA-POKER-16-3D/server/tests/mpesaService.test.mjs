import assert from 'node:assert/strict';
import test from 'node:test';
import { createMpesaService, parseStkCallback } from '../src/services/mpesaService.js';

const successPayload = {
  Body: { stkCallback: {
    MerchantRequestID: 'merchant-qa', CheckoutRequestID: 'checkout-qa', ResultCode: 0, ResultDesc: 'Success',
    CallbackMetadata: { Item: [
      { Name: 'Amount', Value: 100 },
      { Name: 'MpesaReceiptNumber', Value: 'QA-RECEIPT' },
      { Name: 'TransactionDate', Value: 20260814123000 },
      { Name: 'PhoneNumber', Value: 254700000000 },
    ] },
  } },
};

test('STK callback parser handles success without retaining a full phone number', () => {
  const parsed = parseStkCallback(successPayload);
  assert.equal(parsed.status, 'succeeded');
  assert.equal(parsed.checkoutRequestId, 'checkout-qa');
  assert.equal(parsed.phoneLast4, '0000');
  assert.equal('phoneNumber' in parsed, false);
});

test('STK callback processing is idempotent', async () => {
  const transactions = new Map([['checkout-qa', { status: 'pending' }]]);
  const repository = {
    async completeMpesaTransaction(input) {
      const current = transactions.get(input.checkoutRequestId);
      if (!current || current.status !== 'pending') return false;
      transactions.set(input.checkoutRequestId, input);
      return true;
    },
  };
  const service = createMpesaService({ config: { mpesa: { environment: 'sandbox' } }, repository });
  assert.equal((await service.handleCallback(successPayload)).updated, true);
  assert.equal((await service.handleCallback(successPayload)).updated, false);
});

test('sandbox and production use their matching OAuth/STK hosts and configured callback', async () => {
  const urls = [];
  const fetchImpl = async (url, options = {}) => {
    urls.push({ url, options });
    if (url.includes('/oauth/')) return { ok: true, json: async () => ({ access_token: 'test-token' }) };
    return { ok: true, json: async () => ({ MerchantRequestID: 'm1', CheckoutRequestID: 'c1', ResponseCode: '0' }) };
  };
  const repository = { async createMpesaTransaction() {} };
  const config = { mpesa: { environment: 'sandbox', consumerKey: 'key', consumerSecret: 'secret', shortCode: '174379', passkey: 'pass', callbackUrl: 'https://paka-poker-api.onrender.com/api/mpesa/callback' } };
  const service = createMpesaService({ config, repository, fetchImpl });
  await service.triggerStkPush({ userId: 'user-qa', phoneNumber: '0700000000', amount: 100 });
  assert.match(urls[0].url, /^https:\/\/sandbox\.safaricom\.co\.ke\/oauth\//);
  assert.match(urls[1].url, /^https:\/\/sandbox\.safaricom\.co\.ke\/mpesa\/stkpush\//);
  assert.equal(JSON.parse(urls[1].options.body).CallBackURL, config.mpesa.callbackUrl);
});

test('transaction status is scoped to the authenticated player', async () => {
  const repository = {
    async getMpesaTransaction(userId, checkoutRequestId) {
      return userId === 'owner' && checkoutRequestId === 'checkout-owner' ? { checkoutRequestId, status: 'pending', amount: 1 } : null;
    },
  };
  const service = createMpesaService({ config: { mpesa: { environment: 'sandbox' } }, repository });
  assert.equal((await service.getTransactionStatus('owner', 'checkout-owner')).status, 'pending');
  assert.equal(await service.getTransactionStatus('other', 'checkout-owner'), null);
});

test('Daraja failures log only sanitized OAuth diagnostics', async () => {
  const entries = [];
  const original = console.error;
  console.error = (...args) => entries.push(args);
  try {
    const service = createMpesaService({
      config: { mpesa: { environment: 'sandbox', consumerKey: 'private-key', consumerSecret: 'private-secret', shortCode: '174379', passkey: 'private-passkey', callbackUrl: 'https://example.test/callback' } },
      repository: { async createMpesaTransaction() {} },
      fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ errorCode: 'AUTH-001', errorMessage: 'Invalid credentials\n' }) }),
    });
    await assert.rejects(() => service.triggerStkPush({ userId: 'owner', phoneNumber: '0700000000', amount: 1 }), /OAuth request failed/);
  } finally { console.error = original; }
  assert.deepEqual(entries[0], ['M-PESA Daraja request failed', { operation: 'oauth', httpStatus: 401, errorCode: 'AUTH-001', errorMessage: 'Invalid credentials ' }]);
  assert.equal(JSON.stringify(entries).includes('private-secret'), false);
  assert.equal(JSON.stringify(entries).includes('private-passkey'), false);
});

test('Daraja STK rejection records safe response fields without request secrets', async () => {
  const entries = [];
  const original = console.error;
  console.error = (...args) => entries.push(args);
  let call = 0;
  try {
    const service = createMpesaService({
      config: { mpesa: { environment: 'sandbox', consumerKey: 'private-key', consumerSecret: 'private-secret', shortCode: '174379', passkey: 'private-passkey', callbackUrl: 'https://example.test/callback' } },
      repository: { async createMpesaTransaction() {} },
      fetchImpl: async () => ++call === 1
        ? { ok: true, status: 200, json: async () => ({ access_token: 'private-token' }) }
        : { ok: false, status: 400, json: async () => ({ errorCode: 'STK-001', errorMessage: 'Invalid shortcode' }) },
    });
    await assert.rejects(() => service.triggerStkPush({ userId: 'owner', phoneNumber: '0700000000', amount: 1 }), /STK request failed/);
  } finally { console.error = original; }
  assert.deepEqual(entries[0], ['M-PESA Daraja request failed', { operation: 'stk', httpStatus: 400, errorCode: 'STK-001', errorMessage: 'Invalid shortcode' }]);
  assert.equal(JSON.stringify(entries).includes('private-token'), false);
  assert.equal(JSON.stringify(entries).includes('private-passkey'), false);
});
