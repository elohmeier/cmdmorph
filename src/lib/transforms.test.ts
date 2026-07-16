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
})

describe('encoding', () => {
  it('round trips Unicode through base64', () => {
    expect(decodeBase64(encodeBase64('morph 🪄'))).toBe('morph 🪄')
  })
})
