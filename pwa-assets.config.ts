import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.15, resizeOptions: { background: '#ffffff', fit: 'contain' } },
    apple: { ...minimal2023Preset.apple, padding: 0.1, resizeOptions: { background: '#ffffff', fit: 'contain' } },
    transparent: { ...minimal2023Preset.transparent, padding: 0.05, resizeOptions: { background: '#ffffff', fit: 'contain' } },
  },
  images: ['public/icons/source.jpg'],
})
