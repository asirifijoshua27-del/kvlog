import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Strict Content Security Policy injected into the production build only.
// (In development, Electron's main process sets a CSP header that allows Vite's hot reload.)
const PRODUCTION_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: kvlog-media:; media-src 'self' blob: kvlog-media:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'";

function productionCsp(): Plugin {
  return {
    name: 'kvlog-production-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${PRODUCTION_CSP}" />`
      );
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), productionCsp()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome130'
  }
});
