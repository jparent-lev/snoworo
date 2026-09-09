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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __SNOWRO_VERSION__: JSON.stringify(commitCourt()),
    __SNOWRO_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
