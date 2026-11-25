import { createApp } from './app.js';
import { loadServerEnv } from './env.js';

process.env.NODE_ENV ??= 'production';

const env = loadServerEnv();
const app = createApp(env);

const server = app.listen(env.PORT, env.HOST, () => {
  console.warn(`PranaPulse AI listening on http://${env.HOST}:${String(env.PORT)}`);
});

function handleShutdown(): void {
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
