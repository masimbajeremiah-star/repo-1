import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_CLIENT_ORIGINS } from '../src/config.js';

test('CORS allowlist includes supported Vite preview, development, and Capacitor origins', () => {
  [
    'http://localhost:4175',
    'http://127.0.0.1:4175',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://localhost',
    'capacitor://localhost',
  ].forEach((origin) => assert.ok(BUILTIN_CLIENT_ORIGINS.includes(origin), `missing origin: ${origin}`));
});
