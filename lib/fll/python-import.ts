import type { Locale } from '@/lib/i18n/config'

export const FLL_IMPORT_MESSAGE = 'roboeasy:fll-python-import'
export const FLL_IMPORT_RESULT = 'roboeasy:fll-python-import-result'
export const FLL_IMPORT_PARAM = 'pythonImport'
export const FLL_IMPORT_KEY = 'roboeasy:fll-python-import:'

export type FllPythonImport = { id: string; name: string; code: string; hint?: string }

export function stageFllImport(locale: Locale, name: string, code: string, hint?: string): string {
  if (!code.trim()) throw new Error('Empty Python')
  const id = crypto.randomUUID()
  const data: FllPythonImport = { id, name, code, hint }
  sessionStorage.setItem(FLL_IMPORT_KEY + id, JSON.stringify(data))
  return `/${locale}/compete/simulator?${FLL_IMPORT_PARAM}=${id}`
}

export function readFllImport(id: string): FllPythonImport | null {
  if (!/^[\da-f-]{36}$/.test(id)) return null
  try {
    const data = JSON.parse(sessionStorage.getItem(FLL_IMPORT_KEY + id) ?? 'null')
    if (data?.id === id && typeof data.name === 'string' && typeof data.code === 'string' && data.code.trim() &&
      (data.hint === undefined || typeof data.hint === 'string')) return data
  } catch {
    // The simulator can still be used when the browser blocks storage.
  }
  return null
}
