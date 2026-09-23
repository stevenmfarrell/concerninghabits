import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Concerning Habits',
    short_name: 'Habits',
    description: 'The Shire family habit tracker',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafaf9',
    theme_color: '#047857',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ],
  }
}
