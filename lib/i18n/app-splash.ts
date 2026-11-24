import type { Locale } from './config'

const ru = {
  tagline: 'Робототехника с нуля',
  loading: 'Загружаем приложение…',
}

const kk: typeof ru = {
  tagline: 'Робототехника нөлден',
  loading: 'Қосымша жүктеліп жатыр…',
}

const en: typeof ru = {
  tagline: 'Robotics from scratch',
  loading: 'Loading the app…',
}

export type AppSplashText = typeof ru
export const getAppSplashText = (lang: Locale): AppSplashText => ({ ru, kk, en })[lang]
