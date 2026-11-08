/** What the page is working on, for the site-wide mentor. A plain module: nothing re-renders when it changes. */
let program: string | null = null

export function setMentorProgram(code: string | null) {
  program = code
}

export function getMentorProgram(): string | null {
  return program
}
