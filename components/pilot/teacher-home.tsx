'use client'

import { type FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart3, Link2, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { AccountCard } from '@/components/learn/account-card'
import { useCloudModule, useCloudUser } from '@/components/learn/use-cloud'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { type Locale, fill } from '@/lib/i18n/config'
import type { LearnAppText } from '@/lib/i18n/learn-app'
import type { PilotText } from '@/lib/i18n/pilot'
import { type ClassRow, createClass, myClasses, setPostOpen } from '@/lib/pilot/client'

export function TeacherHome({ lang, t, app }: { lang: Locale; t: PilotText; app: LearnAppText }) {
  const mod = useCloudModule()
  const user = useCloudUser(mod)
  const [classes, setClasses] = useState<ClassRow[] | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const teacher = user && !user.is_anonymous ? user : null

  const load = useCallback(async () => setClasses(await myClasses()), [])

  useEffect(() => {
    if (teacher) void load()
  }, [teacher, load])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await createClass(name)
      setName('')
      await load()
    } catch {
      toast.error(t.errors.failed)
    }
    setBusy(false)
  }

  const copyLink = async (code: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/${lang}/class?code=${code}`)
    toast.success(t.teacher.copied)
  }

  return (
    <div className="container grid max-w-3xl gap-6 py-10">
      <header className="grid gap-2">
        <h1 className="m-0 text-4xl">{t.teacher.title}</h1>
        <p className="m-0 text-lg text-muted-foreground">{t.teacher.lead}</p>
        <Link className="justify-self-start underline" href={`/${lang}/parents/consent`}>
          {t.teacher.consent}
        </Link>
      </header>

      {user === undefined ? (
        <Skeleton className="h-48" />
      ) : !teacher ? (
        <>
          <p className="alert m-0">{t.teacher.signIn}</p>
          <AccountCard lang={lang} app={app} />
        </>
      ) : (
        <>
          <Card className="gap-3">
            <CardTitle>{t.teacher.newClass}</CardTitle>
            <form className="flex flex-wrap items-end gap-3" onSubmit={create}>
              <label className="grid min-w-56 flex-1 gap-1 font-bold">
                {t.teacher.className}
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t.teacher.classHint} required />
              </label>
              <button type="submit" className={buttonVariants({ variant: 'primary' })} disabled={busy}>
                <Plus aria-hidden="true" />
                {t.teacher.create}
              </button>
            </form>
          </Card>

          <section className="grid gap-3" aria-labelledby="classes-title">
            <h2 id="classes-title" className="m-0 text-2xl">
              {t.teacher.classes}
            </h2>
            {classes === null ? (
              <Skeleton className="h-24" />
            ) : classes.length === 0 ? (
              <p className="m-0 text-muted-foreground">{t.teacher.empty}</p>
            ) : (
              classes.map((c) => (
                <Card key={c.id} flat className="gap-3" data-testid="class-card">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="m-0 font-display text-xl font-bold">{c.name}</p>
                      <p className="m-0 font-mono text-lg" data-testid="class-code">
                        {fill(t.teacher.code, { code: c.code })}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={buttonVariants({ size: 'sm' })} onClick={() => void copyLink(c.code)}>
                        <Link2 aria-hidden="true" />
                        {t.teacher.copyLink}
                      </button>
                      <Link className={buttonVariants({ variant: 'primary', size: 'sm' })} href={`/${lang}/teacher/${c.id}`}>
                        <BarChart3 aria-hidden="true" />
                        {t.teacher.report}
                      </Link>
                    </div>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={c.post_open}
                      onChange={(e) => {
                        const open = e.target.checked
                        setClasses((list) => list?.map((x) => (x.id === c.id ? { ...x, post_open: open } : x)) ?? null)
                        setPostOpen(c.id, open).catch(() => {
                          toast.error(t.errors.failed)
                          void load()
                        })
                      }}
                    />
                    {t.teacher.postOpen}
                  </label>
                </Card>
              ))
            )}
          </section>
        </>
      )}
    </div>
  )
}
