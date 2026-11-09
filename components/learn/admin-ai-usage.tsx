'use client'

import { useEffect, useState } from 'react'

import { useCloudModule, useCloudUser } from '@/components/learn/use-cloud'
import { Card, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { type UsageSummary, summarizeUsage } from '@/lib/ai/usage-summary'

type Lang = 'ru' | 'kk' | 'en'

const T = {
  ru: {
    title: 'ИИ сегодня',
    denied: 'Эта страница только для администратора.',
    requests: 'Запросов к Gemini',
    cached: 'Ответов из кэша',
    failed: 'Ошибок',
    kinds: 'По типу запроса',
    models: 'По моделям',
    errors: 'Какие ошибки',
    empty: 'Сегодня запросов ещё не было.',
    name: 'Название',
  },
  // TODO: проверить перевод
  kk: {
    title: 'ЖИ бүгін',
    denied: 'Бұл бет тек әкімшіге арналған.',
    requests: 'Gemini сұраулары',
    cached: 'Кэштен жауаптар',
    failed: 'Қателер',
    kinds: 'Сұрау түрі бойынша',
    models: 'Модельдер бойынша',
    errors: 'Қандай қателер',
    empty: 'Бүгін сұрау болған жоқ.',
    name: 'Атауы',
  },
  en: {
    title: 'AI today',
    denied: 'This page is for administrators only.',
    requests: 'Requests to Gemini',
    cached: 'Answers from cache',
    failed: 'Errors',
    kinds: 'By request type',
    models: 'By model',
    errors: 'Which errors',
    empty: 'No requests yet today.',
    name: 'Name',
  },
}

export function AdminAiUsage({ lang }: { lang: Lang }) {
  const t = T[lang]
  const mod = useCloudModule()
  const user = useCloudUser(mod)
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    if (user === null) setDenied(true)
    if (!mod || !user) return
    let alive = true
    void mod
      .isAdmin()
      .then(async (ok) => {
        if (!alive) return
        if (!ok) return setDenied(true)
        const rows = await mod.aiUsageToday()
        if (alive) setSummary(summarizeUsage(rows))
      })
      .catch(() => alive && setDenied(true))
    return () => {
      alive = false
    }
  }, [mod, user])

  if (denied) return <p className="container alert alert-warn my-10">{t.denied}</p>
  if (!summary) return <Skeleton className="container my-10 h-64" />

  const tiles = [
    [t.requests, summary.requests],
    [t.cached, summary.cached],
    [t.failed, summary.failed],
  ] as const

  return (
    <div className="container grid gap-6 py-10">
      <h1 className="m-0 text-4xl">{t.title}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map(([label, value]) => (
          <Card key={label} className="gap-1">
            <p className="m-0 text-sm text-muted-foreground">{label}</p>
            <p className="m-0 font-display text-4xl font-bold">{value}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="gap-3">
          <CardTitle>{t.kinds}</CardTitle>
          <Rows rows={summary.byKind.map((k) => [k.name, `${k.requests} · ${k.cached} · ${k.failed}`])} empty={t.empty} />
        </Card>
        <Card className="gap-3">
          <CardTitle>{t.models}</CardTitle>
          <Rows rows={summary.byModel.map((m) => [m.name, `${m.requests} · ${m.failed}`])} empty={t.empty} />
        </Card>
        <Card className="gap-3">
          <CardTitle>{t.errors}</CardTitle>
          <Rows rows={summary.errors.map((e) => [e.name, String(e.count)])} empty={t.empty} />
        </Card>
      </div>
    </div>
  )
}

function Rows({ rows, empty }: { rows: [string, string][]; empty: string }) {
  if (!rows.length) return <p className="m-0 text-muted-foreground">{empty}</p>
  return (
    <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
      {rows.map(([name, value]) => (
        <div key={name} className="contents">
          <dt className="min-w-0 truncate font-bold">{name}</dt>
          <dd className="m-0 text-right tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
