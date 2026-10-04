import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Concerning Habits',
    short_name: 'Habits',
    description: 'Track your habits daily.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4f3f3', // the light theme's canvas (see globals.css)
    theme_color: '#059669', // emerald-500
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
