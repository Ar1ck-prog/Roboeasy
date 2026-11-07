'use client'

import { useEffect, useId, useState } from 'react'
import { Cloud, CloudOff, Eye, EyeOff, Loader2, LogIn, LogOut, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { CLOUD_CONFIGURED, useCloudModule, useCloudUser } from '@/components/learn/use-cloud'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { fill } from '@/lib/i18n/config'
import type { LearnAppText } from '@/lib/i18n/learn-app'
import type { AuthError } from '@/lib/learn/cloud'
import { cn } from '@/lib/utils'

type Lang = 'ru' | 'kk' | 'en'

const MIN_PASSWORD = 6

/** Profile → Account: optional sign-in with email and password (no confirmation email), cloud sync status, sign out, delete. */
export function AccountCard({ lang, app }: { lang: Lang; app: LearnAppText }) {
  const t = app.account
  const id = useId()
  const mod = useCloudModule()
  const user = useCloudUser(mod)
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AuthError | 'mismatch' | 'tooShort' | null>(null)
  const [sync, setSync] = useState<'idle' | 'syncing' | 'synced'>('idle')

  useEffect(() => {
    if (!mod || !user) return
    let alive = true
    setSync('syncing')
    void mod.startSync().then((r) => alive && setSync(r.ok ? 'synced' : 'idle'))
    return () => {
      alive = false
    }
  }, [mod, user])

  if (!CLOUD_CONFIGURED)
    return (
      <Card flat className="gap-2" id="account">
        <CardTitle>
          <CloudOff className="size-5" aria-hidden="true" />
          {t.title}
        </CardTitle>
        <p className="m-0 text-muted-foreground">{t.unavailable}</p>
      </Card>
    )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mod) return
    if (mode === 'signUp' && password.length < MIN_PASSWORD) return setError('tooShort')
    if (mode === 'signUp' && password !== password2) return setError('mismatch')
    setBusy(true)
    setError(null)
    const r = mode === 'signUp' ? await mod.signUp(email, password) : await mod.signIn(email, password)
    setBusy(false)
    if (r.ok) {
      setPassword('')
      setPassword2('')
      // Next time (after signing out) the form opens on "Sign in".
      setMode('signIn')
      toast.success(t.welcome)
    } else setError(r.error)
  }
  const switchMode = (m: 'signIn' | 'signUp') => {
    setMode(m)
    setError(null)
  }
  const message = error === 'mismatch' ? t.mismatch : error === 'tooShort' ? t.tooShort : error ? t.errors[error] : ''

  return (
    <Card className="gap-3" id="account">
      <CardTitle>
        <Cloud className="size-5" aria-hidden="true" />
        {t.title}
      </CardTitle>
      {user === undefined ? (
        <Loader2 className="size-5 animate-spin" aria-label={app.common.loading} />
      ) : user ? (
        <>
          <p className="m-0 font-bold">{fill(t.signedIn, { email: user.email ?? '' })}</p>
          <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground" role="status">
            {sync === 'syncing' && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {sync === 'synced' ? t.synced : sync === 'syncing' ? t.syncing : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonVariants({ size: 'sm' })} onClick={() => void mod?.signOut()}>
              <LogOut aria-hidden="true" />
              {t.signOut}
            </button>
            <button
              type="button"
              className={buttonVariants({ size: 'sm', variant: 'danger' })}
              onClick={async () => {
                if (!mod || !window.confirm(t.deleteConfirm)) return
                if (await mod.deleteAccount()) toast.success(t.deleted)
                else toast.error(app.account.failed)
              }}
            >
              <Trash2 aria-hidden="true" />
              {t.deleteCloud}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="m-0 text-muted-foreground">{t.lead}</p>
          <div className="flex w-fit overflow-hidden rounded-(--radius-sm) border-(length:--stroke-thin) border-outline" role="tablist" aria-label={t.title}>
            {(['signIn', 'signUp'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={cn('px-4 py-2 text-sm font-extrabold', mode === m ? 'bg-primary text-primary-foreground' : 'bg-card')}
              >
                {m === 'signIn' ? t.signInTab : t.signUpTab}
              </button>
            ))}
          </div>
          <form className="grid max-w-sm gap-3" onSubmit={submit} noValidate>
            <label className="grid gap-1 font-bold" htmlFor={`${id}-email`}>
              {t.email}
              <input
                id={`${id}-email`}
                type="email"
                required
                autoComplete="email"
                className="input w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby={`${id}-hint`}
              />
            </label>
            <label className="grid gap-1 font-bold" htmlFor={`${id}-password`}>
              {t.password}
              <span className="relative">
                <input
                  id={`${id}-password`}
                  type={show ? 'text' : 'password'}
                  required
                  minLength={mode === 'signUp' ? MIN_PASSWORD : undefined}
                  autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                  className="input w-full pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-surface-2"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? t.hide : t.show}
                  aria-pressed={show}
                >
                  {show ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </button>
              </span>
            </label>
            {mode === 'signUp' && (
              <label className="grid gap-1 font-bold" htmlFor={`${id}-password2`}>
                {t.password2}
                <input
                  id={`${id}-password2`}
                  type={show ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  className="input w-full"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                />
                <span className="text-sm font-normal text-muted-foreground">{t.passwordHint}</span>
              </label>
            )}
            {message && (
              <p className="alert m-0 text-destructive" role="alert">
                {message}
              </p>
            )}
            <button
              type="submit"
              className={buttonVariants({ variant: 'primary', className: 'justify-self-start' })}
              disabled={busy || !mod || !email || !password || (mode === 'signUp' && !password2)}
            >
              {busy ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : mode === 'signUp' ? (
                <UserPlus aria-hidden="true" />
              ) : (
                <LogIn aria-hidden="true" />
              )}
              {mode === 'signUp' ? t.signUp : t.signIn}
            </button>
          </form>
          <p id={`${id}-hint`} className="m-0 text-sm text-muted-foreground">
            {t.emailHint}
          </p>
        </>
      )}
    </Card>
  )
}
