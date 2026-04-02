import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('react-router-dom')) return 'router';
          if (id.includes('@microsoft/signalr')) return 'signalr';
          if (id.includes('antd') || id.includes('@ant-design')) return 'antd';
          if (id.includes('react')) return 'react-vendor';

          return 'vendor';
        },
      },
    },
  },
})
