# Phone and tablet remote: plan

This is a plan only. Nothing here is built yet. It is meant to be built after launch.

## What it does

Someone on the church Wi-Fi opens a web address on their phone or tablet, enters a PIN, and controls KVLOG. No app needs installing.

- **Operator remote:** Next / Previous, the slides of the live item (tap one to send it live), the service order, Blackout, Clear and the alerts.
- **Stage view:** the same picture as the stage display (words, chords, next slide, timer, alerts), for a pastor or band member who has no screen.
- **Alerts only:** a reduced page for nursery or ushers, with the ready messages and a Show / Hide button.

## How it works

1. KVLOG already runs a small local web server for the OBS lyric source (`electron/lyrics.ts`). The remote uses a second server on its own port (default 4460), so it can be switched off on its own.
2. It is off by default. Settings → **Remote control** turns it on and shows:
   - the address, e.g. `http://192.168.1.20:4460`, with a QR code,
   - a 6-digit PIN, which can be changed at any time (changing it signs out every phone).
3. The phone page is a small React page built with the rest of KVLOG and served by that server. It receives the same `OutputSnapshot` the stage display gets, over a WebSocket.
4. The phone sends **commands**, not state: `next`, `previous`, `goLive {itemId, slideIndex}`, `blackout`, `clear`, `showAlert {text}`, `hideAlert`. The main process passes each one to the main window, which runs it through the normal reducer. The rules are the same as when the operator clicks.

## Security

- It listens on the local network only, never on the internet. Windows Firewall asks the first time; the page explains to choose **Private networks**.
- Sign-in needs the PIN. After 5 wrong tries from one device, it is locked for 5 minutes.
- Each signed-in phone gets a random token, kept on the phone. Settings lists the connected devices, each with **Sign out**.
- Each device has a role: Operator, Stage view or Alerts only. Stage view cannot change anything.
- Commands are checked in the main process (known command, known item id, text length limit), the same way IPC calls are checked now.
- Traffic is plain HTTP on the local network, which is normal for church tools. HTTPS with a self-signed certificate is possible later, but phones show a warning for it.

## Work involved

| Part | Size |
| --- | --- |
| Remote server: HTTP + WebSocket, PIN, tokens, roles | 2–3 days |
| Command bridge from the main process to the reducer | 1 day |
| Phone pages: operator, stage, alerts (touch-sized, works one-handed) | 3–4 days |
| Settings card: on/off, address, QR code, PIN, devices | 1 day |
| Testing on Android and iPhone, on a busy church Wi-Fi | 2 days |

That is about two weeks in total. It needs one new package, `ws`, for the WebSocket server. The QR code can be drawn without a package.

## Open questions

- Should the remote also control OBS (scenes, Go live)? Leaving OBS out at first is safer.
- Should more than one Operator be allowed at the same time? Suggestion: yes, and the last command wins, as when two people press keys on the same keyboard.
