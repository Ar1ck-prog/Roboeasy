'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { InlineScript } from '@/components/inline-script'
import { APP_SESSION_KEY, appHome } from '@/lib/app-start'
import type { Locale } from '@/lib/i18n/config'

const TWA_REFERRER = 'android-app://kz.roboeasy.app'

/**
 * The installed app has no use for the landing: the Android app (an older APK opens /) and the
 * desktop app window go to the app's home instead. The inline script acts before the landing
 * paints on a full load; the effect covers in-app navigation (the header logo).
 */
export function AppRedirect({ lang }: { lang: Locale }) {
  const router = useRouter()

  useEffect(() => {
    try {
      if (sessionStorage.getItem(APP_SESSION_KEY) || window.matchMedia('(display-mode: standalone)').matches) router.replace(appHome(lang))
    } catch {
      // No storage: the landing stays.
    }
  }, [lang, router])

  const script =
    `try{var twa=(document.referrer||'').indexOf(${JSON.stringify(TWA_REFERRER)})===0;` +
    `if(twa||sessionStorage.getItem(${JSON.stringify(APP_SESSION_KEY)})||matchMedia('(display-mode: standalone)').matches)` +
    `location.replace(twa?${JSON.stringify(`/${lang}/app`)}:${JSON.stringify(appHome(lang))})}catch(e){}`
  return <InlineScript html={script} />
}
