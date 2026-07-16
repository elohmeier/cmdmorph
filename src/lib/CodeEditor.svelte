<script lang="ts">
  import { basicSetup } from 'codemirror'
  import { indentWithTab } from '@codemirror/commands'
  import { json } from '@codemirror/lang-json'
  import { StreamLanguage } from '@codemirror/language'
  import { shell } from '@codemirror/legacy-modes/mode/shell'
  import { Compartment, EditorState, type Extension } from '@codemirror/state'
  import { EditorView, keymap, placeholder } from '@codemirror/view'
  import { onMount } from 'svelte'
  import type { InputKind } from './transforms'

  export let value = ''
  export let language: InputKind = 'text'

  let host: HTMLDivElement
  let view: EditorView | undefined
  let activeLanguage = language
  const languageCompartment = new Compartment()

  const languageExtension = (kind: InputKind): Extension => {
    if (kind === 'json') return json()
    if (kind === 'curl' || kind === 'shell') return StreamLanguage.define(shell)
    return []
  }

  onMount(() => {
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          EditorState.tabSize.of(2),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            'aria-label': 'Command or output to transform',
            spellcheck: 'false',
          }),
          placeholder('Paste a command, JSON, or agent output…'),
          languageCompartment.of(languageExtension(language)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) value = update.state.doc.toString()
          }),
          EditorView.theme({
            '&': {
              height: '100%',
              backgroundColor: 'transparent',
              color: 'var(--ink)',
              fontSize: '15px',
            },
            '&.cm-focused': { outline: 'none' },
            '.cm-scroller': {
              fontFamily: 'var(--mono)',
              lineHeight: '1.65',
              padding: '16px 0',
            },
            '.cm-content': { padding: '0 18px', caretColor: 'var(--accent)' },
            '.cm-line': { padding: '0 4px' },
            '.cm-gutters': {
              backgroundColor: 'transparent',
              color: 'var(--muted-2)',
              border: 'none',
              paddingLeft: '8px',
            },
            '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--active-line)' },
            '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
              backgroundColor: 'var(--selection)',
            },
            '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
            '.cm-placeholder': { color: 'var(--muted-2)', fontStyle: 'normal' },
          }),
        ],
      }),
    })

    return () => view?.destroy()
  })

  $: if (view && value !== view.state.doc.toString()) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    })
  }

  $: if (view && language !== activeLanguage) {
    activeLanguage = language
    view.dispatch({
      effects: languageCompartment.reconfigure(languageExtension(language)),
    })
  }
</script>

<div class="editor-host" bind:this={host}></div>

<style>
  .editor-host {
    height: 100%;
    min-height: 23rem;
  }

  @media (max-width: 680px) {
    .editor-host {
      min-height: 19rem;
    }
  }
</style>
