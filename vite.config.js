import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function commitCourt() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

// Environnement de test (`vite build --mode test`, configuration dans
// .env.test) : jamais indexé par les moteurs de recherche.
function bloquerIndexationEnTest(mode) {
  return {
    name: 'snowro-noindex-test',
    transformIndexHtml(html) {
      if (mode !== 'test') return html
      return html.replace('<head>', '<head>\n    <meta name="robots" content="noindex, nofollow" />')
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), bloquerIndexationEnTest(mode)],
  define: {
    __SNOWRO_VERSION__: JSON.stringify(commitCourt()),
    __SNOWRO_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
}))
