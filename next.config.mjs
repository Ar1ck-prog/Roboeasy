/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Old section URLs (docs/product/information-architecture.md). Locale-less ones get a locale from proxy.ts first.
  redirects() {
    return [
      { source: '/:lang(ru|kk|en)/workspace', destination: '/:lang/sandbox', permanent: true },
      { source: '/:lang(ru|kk|en)/fll/:rest*', destination: '/:lang/compete/:rest*', permanent: true },
      // Classes were removed (self-paced learning only): old links land on the learner's path.
      { source: '/:lang(ru|kk|en)/class/:rest*', destination: '/:lang/path', permanent: false },
      { source: '/workspace', destination: '/sandbox', permanent: true },
      { source: '/fll/:rest*', destination: '/compete/:rest*', permanent: true },
    ]
  },
  // The copied BIOGLOW 3D simulator (public/fll-sim) pauses Python programs through a
  // SharedArrayBuffer, which needs cross-origin isolation of its frame and of the page
  // that embeds it. The frame only loads its own files, so it can require CORP; the
  // page uses `credentialless` so cross-origin images and scripts keep loading.
  headers() {
    const isolated = [{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }]
    return [
      {
        source: '/fll-sim/:path*',
        headers: [...isolated, { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' }, { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }],
      },
      {
        source: '/:lang(ru|kk|en)/compete/simulator',
        headers: [...isolated, { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' }],
      },
    ]
  },
  experimental: {
    // The root layout lives in app/[lang], so unmatched URLs need their own 404 page.
    globalNotFound: true,
  },
}

export default nextConfig
