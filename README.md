# The Room Protocol

Whitepaper for the Room Protocol, the design behind roomd.

## Contents

- `the-room-protocol-whitepaper.md`: full paper source
- `01-problem-and-contributions.md`: older problem/contributions draft
- `build-paper.cjs`: builds HTML (and optional PDF)

## Build

```bash
npm install
npm run build        # → the-room-protocol.html
npm run build:pdf    # → HTML + PDF (needs Chrome/Chromium)
```

The reference implementation lives in the `roomd` repo; the dashboard in `roomd-web`.
