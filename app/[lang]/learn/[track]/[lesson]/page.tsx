import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AchievementWatcher } from '@/components/learn/achievement-watcher'
import { LessonPlayer } from '@/components/learn/lesson-player'
import { CloudSync } from '@/components/learn/use-cloud'
import { getDictionary, isLocale, locales } from '@/lib/i18n'
import { getLearnText } from '@/lib/i18n/learn'
import { getLearnAppText } from '@/lib/i18n/learn-app'
import { getWedoText } from '@/lib/i18n/wedo'
import { COURSE, findLessonRef, readLesson, toClientLesson } from '@/lib/learn/content'

type Params = { params: Promise<{ lang: string; track: string; lesson: string }> }

export function generateStaticParams() {
  return locales.flatMap((lang) =>
    COURSE.tracks.flatMap((track) =>
      track.units.flatMap((unit) => unit.lessons.filter((l) => l.status === 'ready').map((l) => ({ lang, track: track.id, lesson: l.id }))),
    ),
  )
}

export const dynamicParams = false

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, lesson: id } = await params
  if (!isLocale(lang)) return {}
  const lesson = readLesson(id)
  if (!lesson) return {}
  return { title: `${lesson.title[lang]} — RoboEasy`, description: lesson.goal[lang], alternates: { canonical: `/${lang}/learn/${lesson.track}/${lesson.id}` } }
}

export default async function LessonPage({ params }: Params) {
  const { lang, track, lesson: id } = await params
  if (!isLocale(lang)) notFound()
  const found = findLessonRef(id)
  const lesson = readLesson(id)
  if (!found || !lesson || found.track.id !== track) notFound()

  // The next lesson in course order (within the track).
  const ordered = found.track.units.flatMap((u) => u.lessons)
  const nextRef = ordered[ordered.findIndex((l) => l.id === id) + 1]
  const next = nextRef && nextRef.status === 'ready' ? { href: `/${lang}/learn/${track}/${nextRef.id}`, title: nextRef.title[lang] } : null

  const app = getLearnAppText(lang)
  return (
    <>
      <LessonPlayer
        lesson={toClientLesson(lesson)}
        lang={lang}
        t={getLearnText(lang)}
        blocksT={getDictionary(lang).blocks}
        trackTitle={found.track.title[lang]}
        unitTitle={found.unit.title[lang]}
        isProject={found.ref.project}
        next={next}
        mapHref={`/${lang}/learn/${track}`}
        lockedT={app.locked}
        family={found.track.family}
        wedoT={found.track.family === 'wedo' ? getWedoText(lang) : undefined}
        pathT={app.wedo}
      />
      <AchievementWatcher lang={lang} app={app} />
      <CloudSync />
    </>
  )
}
