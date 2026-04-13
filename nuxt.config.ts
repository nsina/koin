// https://nuxt.com/docs/api/configuration/nuxt-config
import { version, author, license, description } from './package.json'

export default defineNuxtConfig({
  modules: ['@nuxthub/core', '@nuxt/eslint', '@nuxt/ui', 'nuxt-charts'],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      appVersion: version,
      appAuthor: author,
      appLicense: license,
      appDescription: description
    }
  },

  routeRules: {
    '/': { prerender: true }
  },

  compatibilityDate: '2025-01-15',

  // NuxtHub auto-detects environment: local dev uses .data/ (SQLite file + filesystem blob),
  // production uses Cloudflare bindings from wrangler.jsonc (D1 + R2).
  hub: {
    db: 'sqlite',
    blob: true,
    kv: true
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
