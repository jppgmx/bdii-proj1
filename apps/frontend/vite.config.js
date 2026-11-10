import { defineConfig } from 'vite';

export default defineConfig({
  envPrefix: [],
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure(proxy) {
          // O navegador recebe um HTTP do Vite mesmo quando o Express não responde.
          proxy.on('error', (_error, _request, response) => {
            if (!response.headersSent) {
              response.writeHead(502, { 'X-Dev-Proxy-Connection-Failed': '1' });
              response.end();
            }
          });
        },
      },
    },
  },
});
