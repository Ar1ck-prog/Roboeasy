# Android app (APK)

The APK in `public/download/roboeasy.apk` is the site packaged as a Trusted Web Activity
with [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap). It opens
`https://roboeasy.onrender.com/` full screen in Chrome's engine, so Web Bluetooth, the
microphone and the learner's progress work as on the site. Every site deploy updates the
app's content; the APK only needs rebuilding when its name, icon, colours or package change.

- Package: `kz.roboeasy.app`
- Start URL: `/app` — a loading screen (`components/app-splash.tsx`) that opens the app's
  home (`/[lang]/path`), not the site's landing. The landing also sends the app there
  (`components/app-redirect.tsx`), which covers the 1.0.0 APK that still starts at `/`.
- Signing key: `roboeasy.keystore`, alias `roboeasy`. It is kept **outside the repository**
  (on the author's machine, with its password file). Without it an update cannot be
  installed over the existing app: keep a backup.
- `public/.well-known/assetlinks.json` holds the key's SHA-256 fingerprint. If it does not
  match, Android shows the app with a browser address bar.

## Rebuild

1. Tools: JDK 17 and the Android command-line tools (build-tools 36.1.0, platform 36),
   paths in `~/.bubblewrap/config.json`. On Windows use paths without spaces (8.3 names).
2. In the project folder (with `twa-manifest.json`): raise `appVersionCode` and
   `appVersionName`, then `bubblewrap update` and `bubblewrap build`
   (passwords via `BUBBLEWRAP_KEYSTORE_PASSWORD` / `BUBBLEWRAP_KEY_PASSWORD`).
3. Copy `app-release-signed.apk` to `public/download/roboeasy.apk` and update
   `APK` (version, size) in `lib/i18n/app-download.ts`.

Desktop computers do not use the APK: the landing's "Install on this computer" button
installs the site as an app through Chrome or Edge (web app manifest + `public/sw.js`).
