import { createApp } from './app.js';
import { loadServerEnv } from './env.js';

process.env.NODE_ENV ??= 'production';

const env = loadServerEnv();
const app = createApp(env);

const server = app.listen(env.PORT, () => {
  console.warn(`PranaPulse AI listening on http://127.0.0.1:${String(env.PORT)}`);
});

function handleShutdown(): void {
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
