import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command, mode }) => {
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        // Proxy API requests to the Node.js backend server
        '/api': {
          target: 'https://api.maduratravel.com',
          changeOrigin: true,
        },
      },
    },
    build: {
      target: 'esnext',
      rollupOptions: {
        output: { format: 'es' }
      }
    },
  };
});