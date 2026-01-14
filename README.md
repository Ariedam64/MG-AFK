# MG AFK

MG AFK is a lightweight, read-only desktop app that lets you stay connected to
Magic Garden without launching the game. It keeps a session open to display
pet ability logs while minimizing CPU/GPU usage. No in-game actions are
performed and no interaction with the game is possible.

## How it works

MG AFK connects to the game's WebSocket endpoint. You must provide your Discord
`mc_jwt` cookie token because the WebSocket requires it for authentication.
Incoming data is formatted and displayed in the interface (status, ability logs,
shops, pet hunger).

## Build

Prerequisites:
- Node.js (LTS recommended)

Install dependencies:
```bash
npm install
```

Run in dev:
```bash
npm start
```

Build portable Windows executable:
```bash
npm run dist
```

The portable `.exe` will be created in `dist/` (e.g. `mgafk-portable-1.0.0.exe`).
