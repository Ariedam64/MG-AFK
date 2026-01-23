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

## Multiple accounts

MG AFK supports running multiple sessions at the same time. Use the tabs bar to
add a new account (+) and switch between sessions. Each tab keeps its own
cookie, room code, and reconnect settings.

## How to get your `mc_jwt` token

The easiest way is to use a browser extension that can read cookies:

- Chrome: **Get cookies.txt (Clean)**  
  https://chromewebstore.google.com/detail/get-cookiestxt-clean/ahmnmhfbokciafffnknlekllgcnafnie
- Firefox: **Get Cookies**  
  https://addons.mozilla.org/en-US/firefox/addon/get_cookies/

Steps:
1) Install the extension.
2) Open Magic Garden (or the Discord activity) in your browser and log in.
3) Use the extension to list the cookies for the site.
4) Find the cookie named **`mc_jwt`**. It should start with something like **`eyJh...`**
   and it is very long.
5) Copy its value and paste it into MG AFK.

Manual method (no extension):
1) Open Magic Garden in your browser and log in.
2) Press `F12` to open DevTools.
3) Go to **Application** → **Cookies** → `https://magicgarden.gg`.
4) Copy the value of the **`mc_jwt`** cookie.

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

The portable `.exe` will be created in `dist/` (e.g. `mgafk-portable-1.0.0.exe`).

To download a ready-made `.exe`, go to the GitHub Releases section of the repo.
