/**
 * A random id for this browser, sent with AI requests so that limits apply per
 * device and not to a whole classroom behind one address. It says nothing
 * about the learner and stays out of every table in readable form.
 */

const KEY = 'rb-device-id'

export function deviceHeaders(): Record<string, string> {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(KEY, id)
    }
    return { 'x-rb-device': id }
  } catch {
    return {}
  }
}
