import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { initPokerSocket } from './src/services/pokerSocket.js';
import apiRoutes from './src/routes/apiRoutes.js';
import { createAuthRouter, createMpesaRouter } from './src/routes/apiRoutes.js';
import { loadConfig } from './src/config.js';
import { createRepository } from './src/services/repository.js';
import { createAuthService } from './src/services/authService.js';
import { createMpesaService } from './src/services/mpesaService.js';

const config = loadConfig();
const repository = await createRepository(config);
const authService = createAuthService({ repository, secret: config.tokenSecret, ttlSeconds: config.tokenTtlSeconds });
const mpesaService = createMpesaService({ config, repository });
const app = express();
const allowedOrigins = config.allowedOrigins;
const corsOptions = {
  origin: allowedOrigins,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};
app.disable('x-powered-by');
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Allow your server to read JSON bodies in requests
app.use(express.json({ limit: '32kb' }));
app.get('/health', async (_req, res) => {
  try {
    const database = await repository.schemaStatus();
    if (!database.mpesaTransactions) return res.status(503).json({ status: 'error', database });
    return res.json({ status: 'ok', database });
  } catch {
    return res.status(503).json({ status: 'error', database: { schema: 'unavailable', mpesaTransactions: false } });
  }
});
app.use('/api/auth', createAuthRouter(authService));
app.use('/api/mpesa', createMpesaRouter({ authService, mpesaService }));

// Mount API routes under /api
app.use('/api', apiRoutes);

// Wrap Express with native Node HTTP Server wrapper for WebSocket support
const httpServer = createServer(app);

// Initialize the real-time poker socket server
const io = initPokerSocket(httpServer, { config, authService, repository });

const PORT = config.port;
// Bind to the LAN for physical-phone QA. Access is still constrained by the
// host firewall and Socket.IO/CORS configuration; no router exposure is made.
const HOST = config.host;
httpServer.listen(PORT, HOST, () => {
  console.log(`🚀 Game Server handling live tables at http://${HOST}:${PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  io.close();
  httpServer.close(async () => { await repository.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
app.use((error, _req, res, _next) => {
  console.error('Request failed:', config.isProduction ? error.message : error);
  res.status(500).json({ error: 'Request could not be completed' });
});
