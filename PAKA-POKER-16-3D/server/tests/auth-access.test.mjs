import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createAuthRouter } from '../src/routes/apiRoutes.js';
import { createAuthService } from '../src/services/authService.js';
import { createRepository } from '../src/services/repository.js';

async function withAuthServer(run) {
  const repository = await createRepository({});
  const authService = createAuthService({
    repository,
    secret: 'test-secret-that-is-long-enough-123456',
    ttlSeconds: 3600,
  });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter(authService));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await run('http://127.0.0.1:' + address.port + '/api/auth', authService);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await repository.close();
  }
}

test('guest access creates a player and restores its saved session', async () => {
  await withAuthServer(async (baseUrl) => {
    const guestResponse = await fetch(baseUrl + '/guest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'Guest Player' }),
    });
    assert.equal(guestResponse.status, 200);
    const guest = await guestResponse.json();
    assert.equal(guest.user.authType, 'guest');
    assert.ok(guest.token);
    assert.equal(guest.chipBalance, 1000);

    const sessionResponse = await fetch(baseUrl + '/session', {
      headers: { authorization: 'Bearer ' + guest.token },
    });
    assert.equal(sessionResponse.status, 200);
    const session = await sessionResponse.json();
    assert.equal(session.user.id, guest.user.id);
    assert.equal(session.user.displayName, 'Guest Player');
  });
});

test('email registration and sign-in work, including an existing shorter password', async () => {
  await withAuthServer(async (baseUrl, authService) => {
    const registration = await fetch(baseUrl + '/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'Email Player', email: 'PLAYER@example.com', password: 'longpassword123' }),
    });
    assert.equal(registration.status, 200);
    const created = await registration.json();
    assert.equal(created.user.email, 'player@example.com');

    const login = await fetch(baseUrl + '/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'player@example.com', password: 'longpassword123' }),
    });
    assert.equal(login.status, 200);
    const signedIn = await login.json();
    assert.equal(signedIn.user.id, created.user.id);

    await authService.registerEmail('older@example.com', 'short123', 'Older Player');
    const olderLogin = await fetch(baseUrl + '/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'older@example.com', password: 'short123' }),
    });
    assert.equal(olderLogin.status, 200);
  });
});

test('email registration still requires a ten-character new password', async () => {
  await withAuthServer(async (baseUrl) => {
    const response = await fetch(baseUrl + '/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Player', email: 'new@example.com', password: 'short123' }),
    });
    assert.equal(response.status, 400);
  });
});
