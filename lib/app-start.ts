import type { Locale } from './i18n/config'

/** Where the installed app (APK, desktop install) lands after its loading screen at /[lang]/app. */
export const appHome = (lang: Locale) => `/${lang}/path`
/** Set for the rest of the app session, so the site's landing sends the app back to its home. */
export const APP_SESSION_KEY = 'roboeasy:app'
