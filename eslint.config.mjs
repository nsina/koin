import withNuxt from './.nuxt/eslint.config.mjs'
import prettier from 'eslint-config-prettier/flat'

export default withNuxt(prettier, {
  rules: {
    // Nuxt allows single-word components for pages/layouts/error
    'vue/multi-word-component-names': 'off',

    // Nuxt 3 supports multiple template roots via fragments
    'vue/no-multiple-template-root': 'off',

    // Allow self-closing on void elements to match Prettier's output
    'vue/html-self-closing': [
      'warn',
      {
        html: {
          void: 'any',
          normal: 'always',
          component: 'always'
        },
        svg: 'always',
        math: 'always'
      }
    ]
  }
})
