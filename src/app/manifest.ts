import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Concerning Habits',
    short_name: 'Habits',
    description: 'Track your habits daily.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafaf9', // stone-50
    theme_color: '#059669', // emerald-500
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/apple-icon',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
