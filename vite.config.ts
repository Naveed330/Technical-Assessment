import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  'connect-src ' +
    [
      "'self'",
      'wss://stream.binance.com:9443',
      'wss://stream.binance.com',
      'wss://data-stream.binance.vision',
      'wss://stream.binance.us:9443',
    ].join(' '),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

// Build-only: the dev server needs inline scripts and ws://localhost for HMR.
function contentSecurityPolicy(): Plugin {
  return {
    name: 'inject-content-security-policy',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
