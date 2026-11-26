import type { ReactNode } from 'react'

const KEYWORDS =
  'and|as|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield'

const TOKEN = new RegExp(
  [
    '(#.*$)', // comment
    '("(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\')', // string
    `\\b(${KEYWORDS})\\b`, // keyword
    '\\b(\\d+(?:\\.\\d+)?)\\b', // number
    '\\b([A-Z][A-Z0-9_]{1,})\\b', // CONSTANT
    '\\b([A-Za-z_]\\w*)(?=\\s*\\()', // function call
  ].join('|'),
  'g',
)

/** The same token kinds for Arduino sketches (C++): // comments, #include, C++ keywords and types. */
const CPP_KEYWORDS =
  'void|int|long|unsigned|float|double|bool|boolean|byte|char|String|const|if|else|for|while|do|switch|case|default|break|continue|return|true|false|HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP'
const CPP_TOKEN = new RegExp(
  [
    '(\\/\\/.*$|#\\w+.*$)', // comment or preprocessor line
    '("(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\')', // string
    `\\b(${CPP_KEYWORDS})\\b`, // keyword
    '\\b(\\d+(?:\\.\\d+)?)\\b', // number
    '\\b([A-Z][A-Z0-9_]{1,})\\b', // CONSTANT
    '\\b([A-Za-z_]\\w*)(?=\\s*\\()', // function call
  ].join('|'),
  'g',
)

const CLASSES = ['tok-com', 'tok-str', 'tok-kw', 'tok-num', 'tok-const', 'tok-fn']

function highlightLine(line: string, token: RegExp = TOKEN): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of line.matchAll(token)) {
    const index = m.index ?? 0
    if (index > last) out.push(line.slice(last, index))
    const group = m.slice(1).findIndex((g) => g !== undefined)
    out.push(
      <span key={index} className={CLASSES[group]}>
        {m[0]}
      </span>,
    )
    last = index + m[0].length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

/** Read-only code view (Python, or an Arduino sketch) with line numbers and light syntax highlighting. */
export function CodeView({ code, label, className, lang = 'python' }: { code: string; label?: string; className?: string; lang?: 'python' | 'arduino' }) {
  const lines = code.replace(/\n$/, '').split('\n')
  const token = lang === 'arduino' ? CPP_TOKEN : TOKEN
  return (
    <pre className={className ? `code ${className}` : 'code'} aria-label={label} tabIndex={0}>
      <code>
        {lines.map((line, i) => (
          <span className="ln" key={i}>
            {highlightLine(line, token)}
            {'\n'}
          </span>
        ))}
      </code>
    </pre>
  )
}
