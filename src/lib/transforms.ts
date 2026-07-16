export type InputKind = 'curl' | 'json' | 'shell' | 'text'

export type Detection = {
  kind: InputKind
  label: string
}

const SHELL_COMMAND =
  /^(?:sudo\s+)?(?:bash|cat|cd|chmod|curl|docker|echo|git|gh|grep|helm|jq|kubectl|make|npm|npx|pnpm|python|rg|ssh|tar|uv|wget|yarn)\b/

export function stripWrapper(input: string): string {
  const lines = input.replace(/\r\n?/g, '\n').split('\n')
  const firstContent = lines.findIndex((line) => line.trim() !== '')
  const lastContent = lines.findLastIndex((line) => line.trim() !== '')

  if (
    firstContent >= 0 &&
    lastContent > firstContent &&
    /^(\s*)\x60\x60\x60/.test(lines[firstContent]) &&
    /^\s*\x60\x60\x60\s*$/.test(lines[lastContent])
  ) {
    lines.splice(lastContent, 1)
    lines.splice(firstContent, 1)
  }

  const nonEmpty = lines.filter((line) => line.trim() !== '')
  if (nonEmpty[0]?.trimStart().startsWith('$ ')) {
    return lines
      .map((line, index) => {
        if (index === lines.indexOf(nonEmpty[0])) {
          return line.replace(/^(\s*)\$\s?/, '$1')
        }
        return line.replace(/^(\s*)>\s?/, '$1')
      })
      .join('\n')
      .trim()
  }

  return lines.join('\n').trim()
}

export function dedent(input: string): string {
  const lines = input.replace(/\r\n?/g, '\n').split('\n')
  const indents = lines
    .filter((line) => line.trim() !== '')
    .map((line) => line.match(/^[\t ]*/)?.[0].length ?? 0)
  const common = indents.length > 0 ? Math.min(...indents) : 0

  return common > 0 ? lines.map((line) => line.slice(common)).join('\n') : lines.join('\n')
}

export function detectInput(input: string): Detection {
  const clean = dedent(stripWrapper(input)).trim()

  if (/^(?:sudo\s+)?curl(?:\s|\\|$)/.test(clean)) {
    return { kind: 'curl', label: 'curl command' }
  }

  if (/^[{[]/.test(clean)) {
    try {
      JSON.parse(clean)
      return { kind: 'json', label: 'JSON' }
    } catch {
      // It only looked like JSON; continue with the less specific checks.
    }
  }

  if (
    SHELL_COMMAND.test(clean) ||
    /\\\s*\n/.test(clean) ||
    /(?:^|\s)(?:&&|\|\||\|)(?:\s|$)/.test(clean)
  ) {
    return { kind: 'shell', label: 'shell command' }
  }

  return { kind: 'text', label: 'plain text' }
}

export function indent(input: string, width = 2): string {
  const prefix = ' '.repeat(width)
  return input
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => (line.length > 0 ? prefix + line : line))
    .join('\n')
}

export function unindent(input: string, width = 2): string {
  return input
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      if (line.startsWith('\t')) return line.slice(1)
      const removable = Math.min(line.match(/^ */)?.[0].length ?? 0, width)
      return line.slice(removable)
    })
    .join('\n')
}

export function toOneLine(input: string): string {
  const clean = dedent(stripWrapper(input))
  const lines = clean
    .replace(/[ \t]*\\[ \t]*\n[ \t]*/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length <= 1) return lines[0] ?? ''

  const detection = detectInput(clean)
  if (detection.kind !== 'curl' && detection.kind !== 'shell') {
    return lines.join(' ')
  }

  return lines.reduce((result, line) => {
    if (result === '') return line

    const continuesFromPrevious =
      /(?:\||\|\||&&|\(|\$\(|\{|then|do|else|in)\s*$/.test(result) ||
      /^(?:\||\|\||&&)\s*/.test(line)
    const alreadySeparated = /(?:;|&)\s*$/.test(result)
    const separator = continuesFromPrevious || alreadySeparated ? ' ' : '; '

    return result + separator + line
  }, '')
}

function tokenizeShell(input: string): string[] {
  const tokens: string[] = []
  let token = ''
  let quote: "'" | '"' | null = null

  const flush = () => {
    if (token !== '') {
      tokens.push(token)
      token = ''
    }
  }

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const next = input[index + 1]

    if (char === '\\' && next === '\n' && quote !== "'") {
      index += 1
      continue
    }

    if (quote) {
      token += char
      if (char === '\\' && quote === '"' && next) {
        token += next
        index += 1
      } else if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === "'" || char === '"') {
      quote = char
      token += char
    } else if (/\s/.test(char)) {
      flush()
    } else {
      token += char
    }
  }

  flush()
  return tokens
}

const CURL_FLAGS_WITHOUT_VALUE = new Set([
  '-i',
  '-I',
  '-k',
  '-L',
  '-s',
  '-S',
  '-v',
  '--compressed',
  '--fail',
  '--fail-with-body',
  '--head',
  '--include',
  '--insecure',
  '--location',
  '--no-buffer',
  '--show-error',
  '--silent',
  '--verbose',
])

export function formatCurl(input: string): string {
  const clean = dedent(stripWrapper(input)).trim()

  if (!/^(?:sudo\s+)?curl(?:\s|\\|$)/.test(clean)) {
    return clean
  }

  const tokens = tokenizeShell(clean)
  const curlIndex = tokens.findIndex((token) => token === 'curl')

  if (curlIndex < 0 || tokens.length <= curlIndex + 1) {
    return clean
  }

  const command = tokens.slice(0, curlIndex + 1).join(' ')
  const parts: string[] = []

  for (let index = curlIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index]
    const isOption = token.startsWith('-')
    const next = tokens[index + 1]
    const optionHasInlineValue = token.includes('=') || /^-[A-Za-z].+/.test(token)

    if (
      isOption &&
      !optionHasInlineValue &&
      !CURL_FLAGS_WITHOUT_VALUE.has(token) &&
      next &&
      !next.startsWith('-')
    ) {
      parts.push(token + ' ' + next)
      index += 1
    } else {
      parts.push(token)
    }
  }

  return [command, ...parts]
    .map((part, index, all) => {
      const continuation = index < all.length - 1 ? ' \\' : ''
      return (index === 0 ? part : '  ' + part) + continuation
    })
    .join('\n')
}

export function prettyJson(input: string): string {
  return JSON.stringify(JSON.parse(stripWrapper(input)), null, 2)
}

export function smartFormat(input: string): string {
  const clean = dedent(stripWrapper(input))
  const detection = detectInput(clean)

  if (detection.kind === 'curl') return formatCurl(clean)
  if (detection.kind === 'json') return prettyJson(clean)
  return clean
}

export function encodeUrl(input: string): string {
  return encodeURIComponent(input)
}

export function decodeUrl(input: string): string {
  return decodeURIComponent(input)
}

export function encodeBase64(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function decodeBase64(input: string): string {
  const binary = atob(input.trim())
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

export function quoteJson(input: string): string {
  return JSON.stringify(input)
}

export function unquoteJson(input: string): string {
  const value: unknown = JSON.parse(input)
  if (typeof value !== 'string') throw new Error('Input is valid JSON, but it is not a JSON string.')
  return value
}

export function quoteShell(input: string): string {
  return "'" + input.replaceAll("'", "'\"'\"'") + "'"
}
