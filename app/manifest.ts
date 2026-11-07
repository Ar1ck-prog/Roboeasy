import type { MetadataRoute } from 'next'

/** Install / home-screen icon (Android, desktop Chrome). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RoboEasy',
    short_name: 'RoboEasy',
    description: 'Robotics from scratch for LEGO SPIKE Prime: lessons, games and a robot buddy.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff9ee',
    theme_color: '#FFD23F',
    icons: [
      { src: '/roboeasy-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/roboeasy-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/roboeasy-icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}
