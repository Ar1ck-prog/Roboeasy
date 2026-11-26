/**
 * Arduino C/C++ as far as the lessons go: lexer and parser.
 *
 * The subset: global and local variables (int, long, unsigned long, byte,
 * bool, float, char, String, arrays), #define and const, functions with
 * parameters, if/else, for, while, do/while, switch, break/continue/return,
 * C operators, method calls on objects (Serial.println, servo.write).
 * Errors carry a code and a line; their text lives in lib/i18n/electronics.ts.
 */

export class CodeError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly line: number,
    readonly params: Record<string, string | number> = {},
  ) {
    super(`${code} at line ${line}`)
  }
}

export type ErrorCode =
  | 'unexpected_char'
  | 'unterminated_string'
  | 'unterminated_comment'
  | 'expected'
  | 'unexpected_token'
  | 'unknown_type'
  | 'no_setup'
  | 'no_loop'
  | 'unknown_name'
  | 'unknown_function'
  | 'unknown_method'
  | 'not_a_function'
  | 'wrong_args'
  | 'const_assign'
  | 'not_assignable'
  | 'not_an_array'
  | 'index_out_of_range'
  | 'division_by_zero'
  | 'duplicate'
  | 'break_outside'
  | 'too_deep'
  | 'bad_pin'
  | 'bad_analog_pin'
  | 'servo_not_attached'

// ── Lexer ───────────────────────────────────────────────────────────────

export type TokenKind = 'num' | 'str' | 'char' | 'id' | 'op' | 'eof'
export interface Token {
  kind: TokenKind
  text: string
  line: number
  /** Numbers: value, whether it is a floating literal, its suffix. */
  value?: number
  float?: boolean
  suffix?: string
}

const OPS = [
  '<<=', '>>=', '...',
  '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '==', '!=', '<=', '>=', '&&', '||', '<<', '>>', '->', '::',
  '+', '-', '*', '/', '%', '=', '<', '>', '!', '~', '&', '|', '^', '?', ':', ';', ',', '.', '(', ')', '{', '}', '[', ']',
]

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', "'": "'", '"': '"' }

export function lex(source: string): Token[] {
  const tokens: Token[] = []
  const defines = new Map<string, Token[]>()
  let i = 0
  let line = 1
  const src = source.replace(/\r\n?/g, '\n')

  while (i < src.length) {
    const c = src[i]
    if (c === '\n') {
      line++
      i++
      continue
    }
    if (c === ' ' || c === '\t' || c === '\f' || c === '\v') {
      i++
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const start = line
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') line++
        i++
      }
      if (i >= src.length) throw new CodeError('unterminated_comment', start)
      i += 2
      continue
    }
    if (c === '#') {
      // A preprocessor line: #include is ignored, #define NAME value is a substitution.
      let end = i
      while (end < src.length && src[end] !== '\n') end++
      const text = src.slice(i + 1, end).trim()
      const define = /^define\s+([A-Za-z_]\w*)\s*(.*)$/.exec(text)
      if (define) {
        const body = lex(define[2]).filter((t) => t.kind !== 'eof').map((t) => ({ ...t, line }))
        defines.set(define[1], body)
      }
      i = end
      continue
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let j = i
      let float = false
      let value: number
      if (c === '0' && /[xX]/.test(src[i + 1] ?? '')) {
        j = i + 2
        while (/[0-9a-fA-F]/.test(src[j] ?? '')) j++
        value = parseInt(src.slice(i + 2, j), 16)
      } else if (c === '0' && /[bB]/.test(src[i + 1] ?? '')) {
        j = i + 2
        while (/[01]/.test(src[j] ?? '')) j++
        value = parseInt(src.slice(i + 2, j), 2)
      } else {
        while (/[0-9]/.test(src[j] ?? '')) j++
        if (src[j] === '.') {
          float = true
          j++
          while (/[0-9]/.test(src[j] ?? '')) j++
        }
        if (/[eE]/.test(src[j] ?? '') && /[-+0-9]/.test(src[j + 1] ?? '')) {
          float = true
          j += 2
          while (/[0-9]/.test(src[j] ?? '')) j++
        }
        value = Number(src.slice(i, j))
      }
      let suffix = ''
      while (/[uUlLfF]/.test(src[j] ?? '')) suffix += src[j++].toLowerCase()
      if (suffix.includes('f')) float = true
      tokens.push({ kind: 'num', text: src.slice(i, j), line, value, float, suffix })
      i = j
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      let text = ''
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\n') throw new CodeError('unterminated_string', line)
        if (src[j] === '\\') {
          text += ESCAPES[src[j + 1]] ?? src[j + 1]
          j += 2
        } else text += src[j++]
      }
      if (j >= src.length) throw new CodeError('unterminated_string', line)
      tokens.push({ kind: c === '"' ? 'str' : 'char', text, line })
      i = j + 1
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i
      while (/\w/.test(src[j] ?? '')) j++
      const word = src.slice(i, j)
      const body = defines.get(word)
      if (body) tokens.push(...body.map((t) => ({ ...t, line })))
      else tokens.push({ kind: 'id', text: word, line })
      i = j
      continue
    }
    const op = OPS.find((o) => src.startsWith(o, i))
    if (!op) throw new CodeError('unexpected_char', line, { char: c })
    tokens.push({ kind: 'op', text: op, line })
    i += op.length
  }
  tokens.push({ kind: 'eof', text: '', line })
  return tokens
}

// ── Types ───────────────────────────────────────────────────────────────

/** How a variable stores its value. */
export type Kind = 'i8' | 'u8' | 'char' | 'bool' | 'i16' | 'u16' | 'i32' | 'u32' | 'f' | 'str' | 'servo' | 'void'

/** Words of a type name and the kind they make (int is 16 bits on the Uno; the board may widen it). */
const TYPE_WORDS = new Set([
  'int', 'long', 'short', 'unsigned', 'signed', 'char', 'byte', 'bool', 'boolean', 'float', 'double', 'void', 'String', 'Servo', 'word',
  'uint8_t', 'int8_t', 'uint16_t', 'int16_t', 'uint32_t', 'int32_t', 'size_t',
])

export function kindOf(words: string[], intBits: 16 | 32): Kind | null {
  const w = words.filter((x) => x !== 'signed')
  const unsigned = w.includes('unsigned')
  const base = w.filter((x) => x !== 'unsigned')
  const key = base.join(' ')
  const int: Kind = intBits === 16 ? (unsigned ? 'u16' : 'i16') : unsigned ? 'u32' : 'i32'
  switch (key) {
    case '':
    case 'int':
    case 'short':
    case 'short int':
      return key.startsWith('short') ? (unsigned ? 'u16' : 'i16') : int
    case 'long':
    case 'long int':
    case 'long long':
      return unsigned ? 'u32' : 'i32'
    case 'char':
      return unsigned ? 'u8' : 'char'
    case 'byte':
    case 'uint8_t':
      return 'u8'
    case 'int8_t':
      return 'i8'
    case 'bool':
    case 'boolean':
      return 'bool'
    case 'float':
    case 'double':
      return 'f'
    case 'void':
      return 'void'
    case 'String':
      return 'str'
    case 'Servo':
      return 'servo'
    case 'word':
    case 'uint16_t':
      return 'u16'
    case 'int16_t':
      return 'i16'
    case 'uint32_t':
    case 'size_t':
      return 'u32'
    case 'int32_t':
      return 'i32'
    default:
      return null
  }
}

// ── AST ─────────────────────────────────────────────────────────────────

export type Expr =
  | { t: 'num'; value: number; float: boolean; long: boolean; unsigned: boolean; line: number }
  | { t: 'str'; value: string; line: number }
  | { t: 'char'; value: number; line: number }
  | { t: 'id'; name: string; line: number }
  | { t: 'assign'; op: string; target: Expr; value: Expr; line: number }
  | { t: 'bin'; op: string; a: Expr; b: Expr; line: number }
  | { t: 'un'; op: string; a: Expr; line: number }
  | { t: 'upd'; op: '++' | '--'; prefix: boolean; target: Expr; line: number }
  | { t: 'cond'; test: Expr; a: Expr; b: Expr; line: number }
  | { t: 'call'; name: string; args: Expr[]; line: number }
  | { t: 'method'; object: string; method: string; args: Expr[]; line: number }
  | { t: 'index'; array: Expr; index: Expr; line: number }
  | { t: 'cast'; kind: Kind; a: Expr; line: number }

export interface Declarator {
  name: string
  /** Array size expression; `null` for `int a[] = {…}`. */
  size?: Expr | null
  init?: Expr
  list?: Expr[]
  /** Constructor arguments: `Servo s;` has none. */
  line: number
}

export type Stmt =
  | { t: 'decl'; kind: Kind; isConst: boolean; items: Declarator[]; line: number }
  | { t: 'expr'; e: Expr; line: number }
  | { t: 'block'; body: Stmt[]; line: number }
  | { t: 'if'; test: Expr; then: Stmt; else?: Stmt; line: number }
  | { t: 'while'; test: Expr; body: Stmt; line: number }
  | { t: 'do'; test: Expr; body: Stmt; line: number }
  | { t: 'for'; init?: Stmt; test?: Expr; update?: Expr; body: Stmt; line: number }
  | { t: 'switch'; test: Expr; cases: { test: Expr | null; body: Stmt[] }[]; line: number }
  | { t: 'break'; line: number }
  | { t: 'continue'; line: number }
  | { t: 'return'; value?: Expr; line: number }
  | { t: 'empty'; line: number }

export interface Param {
  kind: Kind
  name: string
  array: boolean
  ref: boolean
}

export interface Func {
  name: string
  ret: Kind
  params: Param[]
  body: Stmt & { t: 'block' }
  line: number
}

export interface Program {
  globals: (Stmt & { t: 'decl' })[]
  functions: Map<string, Func>
}

// ── Parser ──────────────────────────────────────────────────────────────

const PRECEDENCE: Record<string, number> = {
  '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5,
  '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7,
  '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10,
}
const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='])

export function parse(source: string, intBits: 16 | 32 = 16): Program {
  const tokens = lex(source)
  let p = 0
  const peek = (o = 0) => tokens[Math.min(p + o, tokens.length - 1)]
  const next = () => tokens[p++]
  const is = (text: string, o = 0) => {
    const t = peek(o)
    return (t.kind === 'op' || t.kind === 'id') && t.text === text
  }
  const accept = (text: string) => (is(text) ? (p++, true) : false)
  const expect = (text: string) => {
    if (!is(text)) throw new CodeError('expected', lineForMissing(), { what: text, got: describe(peek()) })
    return next()
  }
  // A missing ';' belongs to the line before the next token.
  const lineForMissing = () => (p > 0 && peek().line > tokens[p - 1].line ? tokens[p - 1].line : peek().line)
  const describe = (t: Token) => (t.kind === 'eof' ? '' : t.kind === 'str' ? `"${t.text}"` : t.text)
  const ident = () => {
    const t = peek()
    if (t.kind !== 'id') throw new CodeError('expected', t.line, { what: 'name', got: describe(t) })
    p++
    return t.text
  }

  const startsType = (o = 0) => {
    const t = peek(o)
    if (t.kind !== 'id') return false
    if (t.text === 'const' || t.text === 'static' || t.text === 'volatile') return true
    return TYPE_WORDS.has(t.text)
  }

  /** Reads `const unsigned long` and the like. */
  const readType = (): { kind: Kind; isConst: boolean; line: number } => {
    const line = peek().line
    let isConst = false
    const words: string[] = []
    for (;;) {
      const t = peek()
      if (t.kind !== 'id') break
      if (t.text === 'const') isConst = true
      else if (t.text === 'static' || t.text === 'volatile') {
        /* no effect here */
      } else if (TYPE_WORDS.has(t.text)) words.push(t.text)
      else break
      p++
    }
    const kind = kindOf(words, intBits)
    if (!kind) throw new CodeError('unknown_type', line, { type: words.join(' ') })
    return { kind, isConst, line }
  }

  // Expressions
  const primary = (): Expr => {
    const t = peek()
    if (t.kind === 'num') {
      p++
      const long = (t.suffix ?? '').includes('l') || (!t.float && Math.abs(t.value!) > (intBits === 16 ? 32767 : 2147483647))
      return { t: 'num', value: t.value!, float: !!t.float, long, unsigned: (t.suffix ?? '').includes('u'), line: t.line }
    }
    if (t.kind === 'str') {
      p++
      let value = t.text
      while (peek().kind === 'str') value += next().text // "a" "b" joins
      return { t: 'str', value, line: t.line }
    }
    if (t.kind === 'char') {
      p++
      return { t: 'char', value: t.text.charCodeAt(0) || 0, line: t.line }
    }
    if (accept('(')) {
      // (float) x
      if (startsType()) {
        const { kind } = readType()
        expect(')')
        return { t: 'cast', kind, a: unary(), line: t.line }
      }
      const e = expression()
      expect(')')
      return e
    }
    if (t.kind === 'id') {
      // int(x), float(x), String(x)
      if (TYPE_WORDS.has(t.text) && is('(', 1)) {
        const { kind } = readType()
        expect('(')
        const a = is(')') ? ({ t: 'str', value: '', line: t.line } as Expr) : expression()
        expect(')')
        return { t: 'cast', kind, a, line: t.line }
      }
      p++
      if (t.text === 'true' || t.text === 'false') return { t: 'num', value: t.text === 'true' ? 1 : 0, float: false, long: false, unsigned: false, line: t.line }
      if (accept('.') || accept('->')) {
        const method = ident()
        if (!is('(')) throw new CodeError('expected', peek().line, { what: '(', got: describe(peek()) })
        return { t: 'method', object: t.text, method, args: args(), line: t.line }
      }
      if (is('(')) return { t: 'call', name: t.text, args: args(), line: t.line }
      return { t: 'id', name: t.text, line: t.line }
    }
    throw new CodeError('unexpected_token', t.line, { got: describe(t) })
  }

  const args = (): Expr[] => {
    expect('(')
    const list: Expr[] = []
    if (!accept(')')) {
      do list.push(assignment())
      while (accept(','))
      expect(')')
    }
    return list
  }

  const postfix = (): Expr => {
    let e = primary()
    for (;;) {
      const line = peek().line
      if (accept('[')) {
        const index = expression()
        expect(']')
        e = { t: 'index', array: e, index, line }
      } else if (is('++') || is('--')) {
        e = { t: 'upd', op: next().text as '++' | '--', prefix: false, target: e, line }
      } else if (is('.') && e.t === 'index') {
        throw new CodeError('unexpected_token', line, { got: '.' })
      } else return e
    }
  }

  const unary = (): Expr => {
    const t = peek()
    if (t.kind === 'op' && (t.text === '++' || t.text === '--')) {
      p++
      return { t: 'upd', op: t.text as '++' | '--', prefix: true, target: unary(), line: t.line }
    }
    if (t.kind === 'op' && ['-', '+', '!', '~'].includes(t.text)) {
      p++
      return { t: 'un', op: t.text, a: unary(), line: t.line }
    }
    return postfix()
  }

  const binary = (min: number): Expr => {
    let a = unary()
    for (;;) {
      const t = peek()
      const prec = t.kind === 'op' ? PRECEDENCE[t.text] : undefined
      if (prec === undefined || prec < min) return a
      p++
      const b = binary(prec + 1)
      a = { t: 'bin', op: t.text, a, b, line: t.line }
    }
  }

  const conditional = (): Expr => {
    const test = binary(1)
    if (!is('?')) return test
    const line = next().line
    const a = assignment()
    expect(':')
    return { t: 'cond', test, a, b: assignment(), line }
  }

  const assignment = (): Expr => {
    const target = conditional()
    const t = peek()
    if (t.kind === 'op' && ASSIGN_OPS.has(t.text)) {
      p++
      if (target.t !== 'id' && target.t !== 'index') throw new CodeError('not_assignable', t.line)
      return { t: 'assign', op: t.text, target, value: assignment(), line: t.line }
    }
    return target
  }

  const expression = (): Expr => {
    let e = assignment()
    // The comma operator, as in `for (i = 0, j = 5; …)`: evaluate both, keep the last.
    while (is(',')) {
      const line = next().line
      e = { t: 'bin', op: ',', a: e, b: assignment(), line }
    }
    return e
  }

  // Statements
  const declaration = (type: { kind: Kind; isConst: boolean; line: number }): Stmt & { t: 'decl' } => {
    const items: Declarator[] = []
    do {
      const line = peek().line
      const name = ident()
      const d: Declarator = { name, line }
      if (accept('[')) {
        d.size = is(']') ? null : expression()
        expect(']')
      }
      if (type.kind === 'servo' && is('(')) args() // Servo s(); is unusual but harmless
      if (accept('=')) {
        if (accept('{')) {
          d.list = []
          if (!is('}')) {
            do {
              if (is('}')) break
              d.list.push(assignment())
            } while (accept(','))
          }
          expect('}')
        } else d.init = assignment()
      }
      items.push(d)
    } while (accept(','))
    expect(';')
    return { t: 'decl', kind: type.kind, isConst: type.isConst, items, line: type.line }
  }

  const statement = (): Stmt => {
    const t = peek()
    const line = t.line
    if (t.kind === 'op' && t.text === '{') return block()
    if (t.kind === 'op' && t.text === ';') {
      p++
      return { t: 'empty', line }
    }
    if (t.kind === 'id') {
      switch (t.text) {
        case 'if': {
          p++
          expect('(')
          const test = expression()
          expect(')')
          const then = statement()
          return accept('else') ? { t: 'if', test, then, else: statement(), line } : { t: 'if', test, then, line }
        }
        case 'while': {
          p++
          expect('(')
          const test = expression()
          expect(')')
          return { t: 'while', test, body: statement(), line }
        }
        case 'do': {
          p++
          const body = statement()
          expect('while')
          expect('(')
          const test = expression()
          expect(')')
          expect(';')
          return { t: 'do', test, body, line }
        }
        case 'for': {
          p++
          expect('(')
          let init: Stmt | undefined
          if (accept(';')) init = undefined
          else if (startsType()) init = declaration(readType())
          else {
            init = { t: 'expr', e: expression(), line }
            expect(';')
          }
          const test = is(';') ? undefined : expression()
          expect(';')
          const update = is(')') ? undefined : expression()
          expect(')')
          return { t: 'for', init, test, update, body: statement(), line }
        }
        case 'switch': {
          p++
          expect('(')
          const test = expression()
          expect(')')
          expect('{')
          const cases: { test: Expr | null; body: Stmt[] }[] = []
          while (!accept('}')) {
            if (accept('case')) {
              const value = conditional()
              expect(':')
              cases.push({ test: value, body: [] })
            } else if (accept('default')) {
              expect(':')
              cases.push({ test: null, body: [] })
            } else {
              if (!cases.length) throw new CodeError('expected', peek().line, { what: 'case', got: describe(peek()) })
              if (peek().kind === 'eof') throw new CodeError('expected', peek().line, { what: '}', got: '' })
              cases[cases.length - 1].body.push(statement())
            }
          }
          return { t: 'switch', test, cases, line }
        }
        case 'break':
          p++
          expect(';')
          return { t: 'break', line }
        case 'continue':
          p++
          expect(';')
          return { t: 'continue', line }
        case 'return': {
          p++
          if (accept(';')) return { t: 'return', line }
          const value = expression()
          expect(';')
          return { t: 'return', value, line }
        }
      }
      // `Servo myservo;` or `int x = 1;` — a type followed by a name.
      if (startsType() && !(TYPE_WORDS.has(t.text) && is('(', 1))) {
        const before = p
        const type = readType()
        // `void loop() {` inside a function: the function before it lacks its closing brace.
        if (peek().kind === 'id' && is('(', 1)) throw new CodeError('expected', before > 0 ? tokens[before - 1].line : line, { what: '}', got: '' })
        return declaration(type)
      }
    }
    const e = expression()
    expect(';')
    return { t: 'expr', e, line }
  }

  const block = (): Stmt & { t: 'block' } => {
    const line = expect('{').line
    const body: Stmt[] = []
    while (!accept('}')) {
      if (peek().kind === 'eof') throw new CodeError('expected', peek().line, { what: '}', got: '' })
      body.push(statement())
    }
    return { t: 'block', body, line }
  }

  const program: Program = { globals: [], functions: new Map() }
  while (peek().kind !== 'eof') {
    if (accept(';')) continue
    if (!startsType()) throw new CodeError('unexpected_token', peek().line, { got: describe(peek()) })
    const type = readType()
    // A function: type name ( … )
    if (peek().kind === 'id' && is('(', 1)) {
      const line = peek().line
      const name = ident()
      expect('(')
      const params: Param[] = []
      if (!accept(')')) {
        if (is('void') && is(')', 1)) {
          p++
        } else {
          do {
            const pt = readType()
            const ref = accept('&')
            const pname = ident()
            let array = false
            if (accept('[')) {
              if (!is(']')) expression()
              expect(']')
              array = true
            }
            params.push({ kind: pt.kind, name: pname, array, ref })
          } while (accept(','))
        }
        expect(')')
      }
      if (accept(';')) continue // a prototype
      const body = block()
      if (program.functions.has(name)) throw new CodeError('duplicate', line, { name })
      program.functions.set(name, { name, ret: type.kind, params, body, line })
      continue
    }
    program.globals.push(declaration(type))
  }
  return program
}
