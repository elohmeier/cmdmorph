import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
  decodeBase64,
  dedent,
  detectInput,
  encodeBase64,
  formatCurl,
  smartFormat,
  stripWrapper,
  toOneLine,
  unindent,
} from './transforms'

const SYNTHETIC_NESTED_SHELL = [
  'API_RESPONSE="$(',
  '  curl --silent \\',
  '    --data "$(',
  '      printf \'{"user":"%s"}\' "$EXAMPLE_USER"',
  '    )" \\',
  '    "${EXAMPLE_API_URL%/}/api/session"',
  ')"',
  '',
  'SESSION_TOKEN="$(',
  '  printf \'%s\' "$API_RESPONSE" |',
  '    head -n1',
  ')"',
  '',
  'test -n "$SESSION_TOKEN" || {',
  '  echo "Response contained no session token" >&2',
  '  exit 1',
  '}',
  '',
  'curl --silent \\',
  '  -H "X-Session-Token: $SESSION_TOKEN" \\',
  '  "${EXAMPLE_API_URL%/}/api/v1/report"',
  '',
  'unset SESSION_TOKEN API_RESPONSE',
].join('\n')

function expectValidShell(script: string) {
  const result = spawnSync('bash', ['-n'], { input: script, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr)
}

describe('input cleanup', () => {
  it('removes a Markdown fence and shell prompts', () => {
    const input = '\x60\x60\x60sh\n$ curl \\\n>   --silent example.com\n\x60\x60\x60'
    expect(stripWrapper(input)).toBe('curl \\\n  --silent example.com')
  })

  it('removes common indentation', () => {
    expect(dedent('    first\n      second')).toBe('first\n  second')
  })

  it('unindents one level without damaging flush lines', () => {
    expect(unindent('  first\nsecond\n\tthird')).toBe('first\nsecond\nthird')
  })
})

describe('detection and formatting', () => {
  it('detects curl through indentation and a code fence', () => {
    expect(detectInput('  \x60\x60\x60sh\n  curl example.com\n  \x60\x60\x60').kind).toBe('curl')
  })

  it('pretty prints JSON via smart format', () => {
    expect(smartFormat('  {"ok":true}')).toBe('{\n  "ok": true\n}')
  })

  it('formats a curl command into readable lines', () => {
    expect(formatCurl("curl -sS -X POST -H 'Accept: application/json' https://example.com")).toBe(
      "curl \\\n  -sS \\\n  -X POST \\\n  -H 'Accept: application/json' \\\n  https://example.com",
    )
  })

  it('joins continued shell lines', () => {
    expect(toOneLine('curl \\\n  --silent \\\n  https://example.com')).toBe(
      'curl --silent https://example.com',
    )
  })

  it('preserves shell separators when joining a nested script', () => {
    const result = toOneLine(SYNTHETIC_NESTED_SHELL)

    expect(result).not.toContain('\n')
    expect(result).toContain(';')
    expectValidShell(result)
  })

  it('does not treat a curl nested in a shell script as standalone curl input', () => {
    expect(formatCurl(SYNTHETIC_NESTED_SHELL)).toBe(SYNTHETIC_NESTED_SHELL)
    expectValidShell(formatCurl(SYNTHETIC_NESTED_SHELL))
  })
})

describe('encoding', () => {
  it('round trips Unicode through base64', () => {
    expect(decodeBase64(encodeBase64('morph 🪄'))).toBe('morph 🪄')
  })
})
