<script lang="ts">
  import CodeEditor from './lib/CodeEditor.svelte'
  import {
    decodeBase64,
    decodeUrl,
    detectInput,
    encodeBase64,
    encodeUrl,
    formatCurl,
    indent,
    quoteJson,
    quoteShell,
    smartFormat,
    stripWrapper,
    toOneLine,
    type InputKind,
    unindent,
    unquoteJson,
  } from './lib/transforms'

  type Transform = (input: string) => string
  type Action = {
    label: string
    hint: string
    transform: Transform
    onlyFor?: InputKind
  }

  const SAMPLE = [
    '    curl --request POST \\',
    "      --header 'content-type: application/json' \\",
    "      --data '{\"hello\":\"world\"}' \\",
    '      https://api.example.com/messages',
  ].join('\n')

  const structureActions: Action[] = [
    {
      label: 'Curl → multiline',
      hint: 'Put standalone curl arguments on separate lines',
      transform: formatCurl,
      onlyFor: 'curl',
    },
    { label: 'One line', hint: 'Remove continuations and newlines', transform: toOneLine },
    { label: 'Indent', hint: 'Add two spaces to every line', transform: indent },
    { label: 'Unindent', hint: 'Remove one indentation level', transform: unindent },
    { label: 'Strip wrapper', hint: 'Remove Markdown fences and shell prompts', transform: stripWrapper },
  ]

  const encodingActions: Action[] = [
    { label: 'URL encode', hint: 'Encode as a URI component', transform: encodeUrl },
    { label: 'URL decode', hint: 'Decode a URI component', transform: decodeUrl },
    { label: 'Base64 encode', hint: 'Encode UTF-8 text as Base64', transform: encodeBase64 },
    { label: 'Base64 decode', hint: 'Decode Base64 as UTF-8 text', transform: decodeBase64 },
    { label: 'JSON quote', hint: 'Turn the input into a JSON string', transform: quoteJson },
    { label: 'JSON unquote', hint: 'Extract text from a JSON string', transform: unquoteJson },
    { label: 'Shell quote', hint: 'Safely single-quote the whole input', transform: quoteShell },
  ]

  let text = SAMPLE
  let notice = 'Sample loaded — paste over it or try Smart format.'
  let noticeKind: 'neutral' | 'success' | 'error' = 'neutral'

  $: detection = detectInput(text)
  $: lineCount = text === '' ? 0 : text.split('\n').length
  $: characterCount = text.length

  function applyTransform(label: string, transform: Transform) {
    if (text === '') {
      notice = 'Paste something into the editor first.'
      noticeKind = 'error'
      return
    }

    try {
      const next = transform(text)
      const changed = next !== text
      text = next
      notice = changed ? label + ' applied. Undo with Ctrl/⌘ Z.' : label + ' made no changes.'
      noticeKind = changed ? 'success' : 'neutral'
    } catch (error) {
      notice = error instanceof Error ? error.message : label + ' could not be applied.'
      noticeKind = 'error'
    }
  }

  async function copyText() {
    if (text === '') {
      notice = 'There is nothing to copy yet.'
      noticeKind = 'error'
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      notice = 'Copied to clipboard.'
      noticeKind = 'success'
    } catch {
      notice = 'Clipboard access was blocked. Select and copy the text manually.'
      noticeKind = 'error'
    }
  }

  function clearText() {
    text = ''
    notice = 'Editor cleared. Undo with Ctrl/⌘ Z.'
    noticeKind = 'neutral'
  }
</script>

<svelte:head>
  <title>cmdmorph — reshape commands and output</title>
  <meta
    name="description"
    content="A private, client-side workbench for formatting, joining, quoting, and encoding commands and agent output."
  />
</svelte:head>

<header class="site-header">
  <a class="brand" href="./" aria-label="cmdmorph home">
    <span class="brand-mark" aria-hidden="true">&gt;_</span>
    <span>cmdmorph</span>
  </a>
  <a
    class="source-link"
    href="https://github.com/elohmeier/cmdmorph"
    target="_blank"
    rel="noreferrer"
  >
    Source
    <span aria-hidden="true">↗</span>
  </a>
</header>

<main>
  <section class="intro" aria-labelledby="page-title">
    <div>
      <p class="eyebrow">Local text workbench</p>
      <h1 id="page-title">Shape commands.<br /><em>Keep your flow.</em></h1>
    </div>
    <div class="intro-copy">
      <p>
        Paste a command or agent output. Clean up its structure, collapse it to one line, or
        encode it without leaving your browser.
      </p>
      <p class="privacy-note">
        <span class="privacy-dot" aria-hidden="true"></span>
        Nothing is uploaded or stored
      </p>
    </div>
  </section>

  <section class="workspace" aria-label="Text transformation workbench">
    <div class="editor-panel">
      <div class="editor-bar">
        <div class="detection">
          <span class="detection-dot" aria-hidden="true"></span>
          Detected: <strong>{detection.label}</strong>
        </div>
        <div class="editor-meta">
          <span>{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>
          <span>{characterCount} chars</span>
          <button class="text-button" type="button" onclick={clearText}>Clear</button>
        </div>
      </div>

      <div class="editor-shell">
        <CodeEditor bind:value={text} language={detection.kind} />
      </div>

      <div class="status-bar">
        <p class:success={noticeKind === 'success'} class:error={noticeKind === 'error'} aria-live="polite">
          {notice}
        </p>
        <span>Changes stay undoable</span>
      </div>
    </div>

    <aside class="toolbox" aria-label="Transformations">
      <div class="primary-actions">
        <button
          class="primary-button"
          type="button"
          onclick={() => applyTransform('Smart format', smartFormat)}
        >
          <span>
            <small>Detected {detection.label}</small>
            Smart format
          </span>
          <span class="button-arrow" aria-hidden="true">→</span>
        </button>
        <button class="copy-button" type="button" onclick={copyText}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="8" y="8" width="11" height="11" rx="2"></rect>
            <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>
          </svg>
          Copy result
        </button>
      </div>

      <div class="tool-group">
        <div class="group-heading">
          <h2>Structure</h2>
          <span>05</span>
        </div>
        <div class="action-list">
          {#each structureActions as action}
            {@const unavailable = action.onlyFor !== undefined && action.onlyFor !== detection.kind}
            <button
              class="action-button"
              type="button"
              title={unavailable ? 'Available for standalone curl commands' : action.hint}
              disabled={unavailable}
              onclick={() => applyTransform(action.label, action.transform)}
            >
              <span>{action.label}</span>
              <span aria-hidden="true">{unavailable ? '—' : '＋'}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="tool-group">
        <div class="group-heading">
          <h2>Encode & quote</h2>
          <span>07</span>
        </div>
        <div class="action-list">
          {#each encodingActions as action}
            <button
              class="action-button"
              type="button"
              title={action.hint}
              onclick={() => applyTransform(action.label, action.transform)}
            >
              <span>{action.label}</span>
              <span aria-hidden="true">＋</span>
            </button>
          {/each}
        </div>
      </div>
    </aside>
  </section>
</main>

<footer class="site-footer">
  <p>Paste it. Morph it. Copy it.</p>
  <p>Client-side by design.</p>
</footer>
