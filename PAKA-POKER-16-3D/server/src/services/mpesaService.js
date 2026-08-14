const DARAJA_BASE_URLS = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
};

function timestamp(now = new Date()) {
  const part = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${part(now.getMonth() + 1)}${part(now.getDate())}${part(now.getHours())}${part(now.getMinutes())}${part(now.getSeconds())}`;
}

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  throw new Error('Enter a valid Kenyan mobile number');
}

function metadataItems(callback) {
  const items = callback?.CallbackMetadata?.Item;
  if (!Array.isArray(items)) return {};
  return Object.fromEntries(items.filter((item) => item && typeof item.Name === 'string').map((item) => [item.Name, item.Value]));
}

export function parseStkCallback(payload) {
  const callback = payload?.Body?.stkCallback;
  if (!callback || typeof callback !== 'object') return null;
  const resultCode = Number(callback.ResultCode);
  const metadata = metadataItems(callback);
  return {
    merchantRequestId: String(callback.MerchantRequestID || ''),
    checkoutRequestId: String(callback.CheckoutRequestID || ''),
    resultCode: Number.isFinite(resultCode) ? resultCode : -1,
    resultDescription: String(callback.ResultDesc || '').slice(0, 500),
    status: resultCode === 0 ? 'succeeded' : 'failed',
    amount: metadata.Amount == null ? null : Number(metadata.Amount),
    receiptNumber: metadata.MpesaReceiptNumber == null ? null : String(metadata.MpesaReceiptNumber),
    transactionDate: metadata.TransactionDate == null ? null : String(metadata.TransactionDate),
    phoneLast4: metadata.PhoneNumber == null ? null : String(metadata.PhoneNumber).slice(-4),
  };
}

export function createMpesaService({ config, repository, fetchImpl = fetch }) {
  const mpesa = config.mpesa;

  function assertConfigured() {
    const missing = [];
    if (!mpesa.consumerKey) missing.push('MPESA_CONSUMER_KEY');
    if (!mpesa.consumerSecret) missing.push('MPESA_CONSUMER_SECRET');
    if (!mpesa.shortCode) missing.push('MPESA_SHORTCODE');
    if (!mpesa.passkey) missing.push('MPESA_PASSKEY');
    if (!mpesa.callbackUrl) missing.push('MPESA_CALLBACK_URL');
    if (missing.length) throw new Error(`M-PESA is not configured: ${missing.join(', ')}`);
  }

  async function accessToken() {
    assertConfigured();
    const authorization = Buffer.from(`${mpesa.consumerKey}:${mpesa.consumerSecret}`).toString('base64');
    const response = await fetchImpl(`${DARAJA_BASE_URLS[mpesa.environment]}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { authorization: `Basic ${authorization}` },
    });
    if (!response.ok) throw new Error(`Daraja OAuth failed with status ${response.status}`);
    const body = await response.json();
    if (!body.access_token) throw new Error('Daraja OAuth response did not include an access token');
    return body.access_token;
  }

  return {
    async getTransactionStatus(userId, checkoutRequestId) {
      if (!userId || !checkoutRequestId) return null;
      return repository.getMpesaTransaction(userId, checkoutRequestId);
    },

    async triggerStkPush({ userId, phoneNumber, amount }) {
      assertConfigured();
      const numericAmount = Number(amount);
      if (!Number.isInteger(numericAmount) || numericAmount < 1 || numericAmount > 150000) throw new Error('Amount must be a whole number between 1 and 150000');
      const phone = formatPhone(phoneNumber);
      const requestTimestamp = timestamp();
      const password = Buffer.from(`${mpesa.shortCode}${mpesa.passkey}${requestTimestamp}`).toString('base64');
      const token = await accessToken();
      const response = await fetchImpl(`${DARAJA_BASE_URLS[mpesa.environment]}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          BusinessShortCode: mpesa.shortCode,
          Password: password,
          Timestamp: requestTimestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: numericAmount,
          PartyA: phone,
          PartyB: mpesa.shortCode,
          PhoneNumber: phone,
          CallBackURL: mpesa.callbackUrl,
          AccountReference: `PAKA-${String(userId).slice(0, 18)}`,
          TransactionDesc: 'PAKA Poker wallet top-up',
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.CheckoutRequestID) throw new Error(String(body.CustomerMessage || body.errorMessage || `Daraja STK Push failed with status ${response.status}`));
      await repository.createMpesaTransaction({
        userId,
        merchantRequestId: body.MerchantRequestID,
        checkoutRequestId: body.CheckoutRequestID,
        amount: numericAmount,
        phoneLast4: phone.slice(-4),
      });
      return {
        merchantRequestId: body.MerchantRequestID,
        checkoutRequestId: body.CheckoutRequestID,
        responseCode: body.ResponseCode,
        customerMessage: body.CustomerMessage,
      };
    },

    async handleCallback(payload) {
      const callback = parseStkCallback(payload);
      if (!callback?.checkoutRequestId) return { accepted: false, reason: 'Malformed STK callback' };
      const updated = await repository.completeMpesaTransaction(callback);
      console.log('M-PESA callback', {
        merchantRequestId: callback.merchantRequestId,
        checkoutRequestId: callback.checkoutRequestId,
        resultCode: callback.resultCode,
        status: callback.status,
        updated,
      });
      return { accepted: true, updated, status: callback.status };
    },
  };
}
