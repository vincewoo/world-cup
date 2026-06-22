import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The football-data.org API requires the key in an `X-Auth-Token` header and
// does not send CORS headers for browser requests. So in dev we proxy through
// the Vite server: the browser calls `/api/football-data/...` (a same-origin
// relative path) and the proxy forwards to the real API, injecting the token
// server-side. This keeps the key out of the client bundle entirely.
//
// Set the key in a local `.env` file (gitignored):  FOOTBALL_DATA_TOKEN=xxxx
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const token = env.FOOTBALL_DATA_TOKEN || '';
  const headers: Record<string, string> = token ? { 'X-Auth-Token': token } : {};

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/football-data': {
          target: 'https://api.football-data.org/v4',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/football-data/, ''),
          headers,
        },
        // Polymarket Gamma API — public, no key. Proxied to sidestep CORS and to
        // match the football-data pattern. The host must be on the network
        // egress allowlist for requests to reach it.
        '/api/polymarket': {
          target: 'https://gamma-api.polymarket.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/polymarket/, ''),
        },
      },
    },
  };
});
