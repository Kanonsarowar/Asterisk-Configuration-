import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://127.0.0.1:3010',
      '/internal': 'http://127.0.0.1:3010',
      '/login': {
        target: 'http://127.0.0.1:3010',
        bypass(req) {
          if (req.method === 'GET') return req.url;
        },
      },
    },
  },
});
