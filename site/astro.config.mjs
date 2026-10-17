import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://titian.irawan.dev',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
