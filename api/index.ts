import { createApp } from '../server/app.js';

/**
 * Vercel Serverless Function entrypoint wrapping the hardened Express 5 application.
 */
const app = createApp();

export default app;
