import { defineConfig } from 'vite';
import { resolve } from 'path';
import { cpSync, mkdirSync, existsSync, rmSync } from 'fs';
import { build } from 'vite';

function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    async closeBundle() {
      const dist = resolve(__dirname, 'dist');

      // Move index.html → panel/index.html
      const srcHtml = resolve(dist, 'index.html');
      const panelDir = resolve(dist, 'panel');
      const destHtml = resolve(panelDir, 'index.html');
      if (existsSync(srcHtml)) {
        if (!existsSync(panelDir)) mkdirSync(panelDir, { recursive: true });
        cpSync(srcHtml, destHtml);
        rmSync(srcHtml);
      }

      // Copy manifest.json
      cpSync(resolve(__dirname, 'manifest.json'), resolve(dist, 'manifest.json'));

      // Copy icons if they exist
      const iconsDir = resolve(__dirname, 'icons');
      if (existsSync(iconsDir)) {
        cpSync(iconsDir, resolve(dist, 'icons'), { recursive: true });
      }

      // Build content script and background as standalone IIFE bundles
      // (they can't use ES module imports in Chrome extensions)
      for (const entry of ['content', 'background']) {
        const input = entry === 'content'
          ? resolve(__dirname, 'src/content/scroll-tracker.js')
          : resolve(__dirname, 'src/background/index.js');

        await build({
          configFile: false,
          build: {
            outDir: dist,
            emptyOutDir: false,
            rollupOptions: {
              input,
              output: {
                entryFileNames: `${entry}.js`,
                format: 'iife',
              },
            },
            target: 'esnext',
            minify: false,
          },
          resolve: {
            alias: {
              '@': resolve(__dirname, 'src'),
            },
          },
        });
      }
    },
  };
}

export default defineConfig({
  root: resolve(__dirname, 'src/panel'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        panel: resolve(__dirname, 'src/panel/index.html'),
      },
      output: {
        entryFileNames: 'panel/panel.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (info) => {
          if (info.name?.endsWith('.css')) return 'panel/[name]-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    target: 'esnext',
    minify: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [copyExtensionFiles()],
});
