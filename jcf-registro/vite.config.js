import { defineConfig } from 'vite';

const buildId = process.env.GITHUB_SHA?.slice(0, 8) || new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);

export default defineConfig({
  base: '/AppFotos/jcf-registro/',
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  build: {
    target: ['es2020', 'safari15'],
    sourcemap: true,
    assetsDir: 'assets'
  },
  test: { environment: 'node', include: ['tests/**/*.test.js'] }
});
