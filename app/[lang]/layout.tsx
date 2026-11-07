import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { Analytics } from '@vercel/analytics/next'

import { InlineScript } from '@/components/inline-script'
import { Providers } from '@/components/providers'
import { fontVariables } from '@/lib/fonts'
import { getDictionary, isLocale, locales } from '@/lib/i18n'
import { THEME_SCRIPT } from '@/lib/theme-script'
import '../globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

type Params = { params: Promise<{ lang: string }> }

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const t = getDictionary(lang)
  return {
    metadataBase: new URL(siteUrl),
    title: t.meta.title,
    description: t.meta.description,
    applicationName: 'RoboEasy AI',
    alternates: {
      canonical: `/${lang}`,
      languages: { ru: '/ru', kk: '/kk', en: '/en', 'x-default': '/ru' },
    },
    openGraph: {
      type: 'website',
      siteName: 'RoboEasy AI',
      title: t.meta.title,
      description: t.meta.description,
      locale: lang === 'kk' ? 'kk_KZ' : lang === 'ru' ? 'ru_RU' : 'en_US',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: 'RoboEasy AI' }],
    },
    twitter: { card: 'summary_large_image', title: t.meta.title, description: t.meta.description, images: ['/og.png'] },
    icons: { icon: [{ url: '/favicon.ico', sizes: '48x48' }, { url: '/icon.svg', type: 'image/svg+xml' }], apple: '/apple-icon.png' },
  }
}

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fff9ee' },
    { media: '(prefers-color-scheme: dark)', color: '#141826' },
  ],
}

export default async function RootLayout({ children, params }: Params & { children: ReactNode }) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return (
    <html lang={lang} className={fontVariables} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <InlineScript html={THEME_SCRIPT} />
      </head>
      <body>
        <Providers>{children}</Providers>
        {/* Vercel Analytics only exists on Vercel; elsewhere (Render) its script is a 404. */}
        {process.env.NODE_ENV === 'production' && process.env.VERCEL && <Analytics />}
      </body>
    </html>
  )
}
