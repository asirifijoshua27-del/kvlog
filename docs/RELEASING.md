# Releasing KVLOG

## One-time setup

1. Create a GitHub repository named `kvlog` and push this folder to it.
2. In `package.json`, replace `YOUR-GITHUB-NAME` (two places: `homepage` and `build.publish`) with your GitHub user or organisation name.
3. Keep the repository **public**. Installed copies download updates from its Releases page; a private repository would need a token on every church's PC.

## Making a release

1. Raise `version` in `package.json`, e.g. `1.0.0` → `1.0.1`. Each release needs a higher number.
2. Commit, then tag and push:
   ```
   git tag v1.0.1
   git push origin main --tags
   ```
3. GitHub Actions (`.github/workflows/release.yml`) runs the checks and tests, builds `KVLOG-Setup-1.0.1.exe` and publishes the release.
4. Open the release on GitHub, write what changed, and keep it as a normal (not draft) release.

Churches running KVLOG get it within a few hours. It downloads in the background and installs when KVLOG is closed, or when they click **Settings → Updates → Restart and update**. It never restarts during a service.

## Building on your own PC

```
npm install
npm run dist
```
The installer is in `release\\KVLOG-Setup-<version>.exe`. Give this file to a church for a first install.

## Windows "unknown publisher" warning

The installer is not code-signed yet, so Windows SmartScreen shows **"Windows protected your PC"**. Tell churches to click **More info → Run anyway**. Once enough people have installed it, the warning appears less often.

To remove the warning, buy a code-signing certificate (an OV or EV certificate from a provider such as Sectigo or DigiCert, or Azure Trusted Signing), then add to `build.win` in `package.json`:
```json
"publisherName": "<the exact name on the certificate>"
```
and set the signing secrets (`CSC_LINK`, `CSC_KEY_PASSWORD`) in the GitHub repository settings. **Only add `publisherName` together with a certificate**: with it set, unsigned updates are refused.

## Tests

- `npm test`: unit tests (slides, chords, song import, timing, margins). A few seconds.
- `npm run test:e2e`: builds KVLOG and drives the real app: creating a song, autosave, going live, blackout, alerts, the stage display and Settings. It uses its own empty data folder, so your library is never touched. The first time, run `npx playwright install` if it asks.
