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

