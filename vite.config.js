import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

// Read version from package.json (single source of truth)
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))
const APP_VERSION = packageJson.version

export default defineConfig({
    plugins: [
        react(),
        // Plugin to replace version placeholder in index.html
        {
            name: 'html-version-inject',
            transformIndexHtml(html) {
                return html.replace(/__APP_VERSION__/g, APP_VERSION)
            }
        }
    ],
    base: '/Meal-prep-mate/',
    build: {
        outDir: 'dist',
        sourcemap: false
    },
    // Make version available as a global constant in the app
    define: {
        __APP_VERSION__: JSON.stringify(APP_VERSION)
    }
})
