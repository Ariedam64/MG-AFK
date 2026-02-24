# MG AFK

MG AFK is a lightweight, read-only desktop app that lets you stay connected to
Magic Garden without launching the game. It keeps a session open to display
pet ability logs while minimizing CPU/GPU usage. No in-game actions are
performed and no interaction with the game is possible.

## How it works

MG AFK connects to the game's WebSocket endpoint and authenticates using your
Discord account. Incoming data is formatted and displayed in the interface
(status, ability logs, shops, pet hunger).

## Login

Click the **Login** button in the Connection card. A browser window will open
directly on Discord's OAuth page — log in with Discord and the app captures
your session token automatically. The token is stored persistently so you only
need to log in once.

To log out, click **Logout**. This clears the stored token from the app.

## Multiple accounts

MG AFK supports running multiple sessions at the same time. Use the tabs bar to
add a new account (+) and switch between sessions. Each tab keeps its own
login, room code, and reconnect settings.

## Alerts

MG AFK can notify you about shop items, weather changes, and pet hunger. You can
choose Windows notifications or a sound alert.

## Screenshot

![MG AFK UI](https://i.imgur.com/3txyFSw.png)

### Reconnect on (Superseded)

The Superseded option is useful if you occasionally open the real game to take
quick actions (feed pets at 0% hunger, buy a rare shop item, etc.). When MG AFK
detects that your session was replaced by another device, it waits for the
delay you set and reconnects automatically. This lets you briefly open the
game, do what you need, close it, and the app resumes the idle session on its own.

### Reconnect on (Other disconnects)

Other disconnects controls the common server-side disconnect codes (timeouts,
network blips, server restarts, etc.). If enabled, MG AFK will automatically
reconnect after the delay you set. Disable it if you want a hard stop for any
unexpected disconnects.

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

The portable `.exe` will be created in `dist/` (e.g. `mgafk-portable-1.5.0.exe`).

To download a ready-made `.exe`, go to the GitHub Releases section of the repo.
