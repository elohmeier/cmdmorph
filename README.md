# cmdmorph

A private, client-side workbench for reshaping commands and agent output.

Paste text into the CodeMirror editor, let cmdmorph detect its shape, and apply an explicit
transformation. Nothing is sent to a server or persisted in local storage.

## Features

- Detects curl commands, shell commands, JSON, and plain text
- Formats curl commands across lines or collapses continued commands to one line
- Indents, unindents, and removes Markdown fences and shell prompts
- Encodes and decodes URL components and Base64
- Quotes and unquotes JSON strings, plus safe whole-value shell quoting
- Keeps transformations in CodeMirror's undo history
- Runs entirely in the browser

## Development

    npm install
    npm run dev

Before pushing:

    npm test
    npm run check
    npm run build

## Deployment

Pushing `main` runs the GitHub Pages workflow in
`.github/workflows/deploy-pages.yml`. Vite uses relative asset paths, so the generated
`dist/` directory works under the `/cmdmorph/` project path.
