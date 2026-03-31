# Edufika Update Manual

This document is the operational manual for Edufika's update system.

It explains:

- what kinds of updates the app supports
- how automatic updates actually work
- what to change when you have a new build
- how to publish `stable` and `debug` updates
- how to configure the backend, VPS, Portainer, and Nginx
- how to troubleshoot when an update does not appear in the app

This guide assumes the current production setup is:

- backend/API runs in Docker via Portainer
- Nginx runs on the VPS host
- update files are stored on the VPS host in `/opt/edufika/updates`
- the public domain is `https://srv1536310.hstgr.cloud`
- release channel is `stable`
- debug channel is `debug`

## 1. Update System Overview

Edufika now supports 3 update lanes:

1. Remote config
   Use this for tiny changes such as flags, default URLs, banners, theme defaults, and feature switches.

2. React Native OTA updates
   Use this for JavaScript and UI-only changes. This includes most React Native screen changes, text changes, styling changes, and frontend logic changes that do not require new native Android code.

3. Native APK updates
   Use this for Kotlin code, Android manifest changes, permissions, native modules, CameraX, kiosk/security shell changes, package changes, or anything else that affects the native Android app shell.

Important behavior:

- The app checks for updates automatically at startup.
- The Settings screen also allows a manual update check.
- OTA updates are staged automatically and activate after app restart.
- Native APK updates still require Android's installer prompt.
- Updates are blocked during an active exam session.

## 2. Channels

There are 2 update channels:

- `stable`
  This is used by release builds.

- `debug`
  This is used by debug builds.

Why this matters:

- `stable` and `debug` are separate apps from Android's point of view.
- A debug APK cannot update a release install.
- A release APK cannot update a debug install.

Current channel wiring:

- release builds send `channel=stable`
- debug builds send `channel=debug`

Relevant files:

- `app/build.gradle.kts`
- `edufika-session-api/updates/manifest.json`
- `edufika-session-api/updates/manifest.debug.json`

## 3. How Automatic Updates Actually Work

### 3.1 Startup flow

When the app launches:

1. The splash screen finishes.
2. The app opens the update screen.
3. It calls:
   - `/updates/manifest` for release builds
   - `/updates/manifest?channel=debug` for debug builds
4. The backend returns:
   - `remoteConfig`
   - `ota`
   - `native`
5. The app decides what to do next.

### 3.2 Remote config behavior

`remoteConfig` is applied immediately after the manifest is downloaded.

This means you can change things like:

- `defaultBackendBaseUrl`
- `preferredThemeId`
- `statusBanner`
- `allowManualThemeSelection`
- `allowDeveloperAccess`

without rebuilding the app.

### 3.3 OTA behavior

If the manifest contains a valid `ota` block and the OTA version is newer than the currently active OTA package:

1. the app downloads the OTA zip
2. verifies SHA-256
3. extracts the bundle and assets into app-private storage
4. marks the new bundle as active
5. asks the user to restart the app

On the next launch:

- the app boots from the downloaded bundle instead of the embedded bundle
- if the OTA bundle crashes before confirming startup, the app rolls back automatically

### 3.4 Native APK behavior

If the manifest contains a valid `native` block and:

- `versionCode` is greater than the currently installed app version
- `packageName` matches the installed app

then the app treats it as a native update.

Behavior:

- optional native update:
  the app offers the update and the user can continue or install it

- mandatory native update:
  the native installer flow starts automatically

Android still requires the system package installer. So native installs are not silent.

### 3.5 Update priority

If both OTA and native are available at the same time, the app handles OTA first.

Typical sequence:

1. app detects OTA
2. app downloads OTA
3. app asks for restart
4. on next launch, app may still detect a native APK update

## 4. Backend Requirements

The backend must expose:

- `GET /updates/manifest`
- `GET /updates/manifest?channel=debug`
- `GET /updates/remote-config`
- static files under `/updates/files/...`

The relevant backend files are:

- `edufika-session-api/src/routes/update.ts`
- `edufika-session-api/src/server.ts`
- `edufika-session-api/src/config.ts`

### 4.1 Required backend environment variables

Set these in Portainer for the API container:

```env
HOST=0.0.0.0
PORT=8091
NODE_ENV=production
PUBLIC_BASE_URL=https://srv1536310.hstgr.cloud
UPDATE_DEFAULT_CHANNEL=stable
```

Important:

- `PUBLIC_BASE_URL` should be the public domain seen by the app
- if this is missing, generated manifest URLs may be wrong behind reverse proxy

## 5. VPS File Layout

The backend container must mount this host directory:

```text
/opt/edufika/updates
```

Recommended final layout:

```text
/opt/edufika/updates/
  manifest.json
  manifest.debug.json
  files/
    native/
      app-release.apk
      app-debug.apk
    ota/
      edufika-rn-stable-update.zip
      edufika-rn-debug-update.zip
```

### 5.1 Create folders on the VPS

Run:

```bash
mkdir -p /opt/edufika/updates/files/native
mkdir -p /opt/edufika/updates/files/ota
chmod 755 /opt/edufika
chmod 755 /opt/edufika/updates
chmod 755 /opt/edufika/updates/files
chmod 755 /opt/edufika/updates/files/native
chmod 755 /opt/edufika/updates/files/ota
```

## 6. Portainer Configuration

The backend container should:

- publish `127.0.0.1:8091:8091`
- mount `/opt/edufika/updates:/app/updates`
- include the environment variables listed above

Typical important pieces:

```yaml
ports:
  - "127.0.0.1:8091:8091"
volumes:
  - /opt/edufika/updates:/app/updates
environment:
  HOST: 0.0.0.0
  PORT: 8091
  NODE_ENV: production
  PUBLIC_BASE_URL: https://srv1536310.hstgr.cloud
  UPDATE_DEFAULT_CHANNEL: stable
```

## 7. Nginx Configuration

Host Nginx must proxy `/updates/` to the backend container on `127.0.0.1:8091`.

Add this inside the correct `server {}` block:

```nginx
location /updates/ {
    proxy_pass http://127.0.0.1:8091;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_buffering off;
}
```

After editing:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 8. Manifest Files

### 8.1 Stable manifest

Stable manifest file:

```text
edufika-session-api/updates/manifest.json
```

This is what release builds use.

### 8.2 Debug manifest

Debug manifest file:

```text
edufika-session-api/updates/manifest.debug.json
```

This is what debug builds use.

### 8.3 Manifest structure

Each manifest contains:

- `channel`
- `generatedAt`
- `remoteConfig`
- `ota`
- `native`

Example:

```json
{
  "channel": "stable",
  "generatedAt": "2026-03-31T06:07:38.955Z",
  "remoteConfig": {
    "version": "2026.03.31.0607",
    "values": {
      "defaultBackendBaseUrl": "https://srv1536310.hstgr.cloud"
    }
  },
  "ota": {
    "version": "2026.03.31-0607-stable",
    "mandatory": false,
    "minNativeVersionCode": 10001,
    "bundleUrl": "/updates/files/ota/edufika-rn-stable-update.zip",
    "sha256": "lowercase_hex_sha256",
    "notes": "React Native OTA package for the stable channel."
  },
  "native": {
    "versionCode": 10001,
    "versionName": "1.0.1",
    "mandatory": false,
    "apkUrl": "/updates/files/native/app-release.apk",
    "packageName": "com.techivibes.edufika",
    "sha256": "lowercase_hex_sha256",
    "notes": "Native APK package for the stable channel."
  }
}
```

### 8.4 When `ota` or `native` can be `null`

Use `null` when you do not want to publish that update lane.

Examples:

- only remote config:
  `ota: null`, `native: null`

- OTA only:
  fill `ota`, set `native: null`

- native only:
  set `ota: null`, fill `native`

## 9. Versioning Rules

### 9.1 Native versioning

Native APK updates require a higher `versionCode` than the currently installed app.

Current versioning source:

```text
gradle.properties
```

Current fields:

```text
APP_VERSION_CODE=10001
APP_VERSION_NAME=1.0.1
```

Rule:

- increase `APP_VERSION_CODE` for every distributed native build
- update `APP_VERSION_NAME` when you want a new human-readable version label

If you rebuild the APK without increasing `APP_VERSION_CODE`, the app will not offer it as a native update.

### 9.2 OTA versioning

OTA updates use `ota.version`, not Android `versionCode`.

The packaging script generates a fresh OTA version automatically using UTC time and channel, for example:

```text
2026.03.31-0607-stable
```

If `ota.version` does not change, the app will treat it as the same OTA package.

## 10. Build Commands

### 10.1 Important working directory

Run build commands from the repo root:

```text
D:\Edufika\Edufika2
```

Do not run them from `C:\Users\USER` or another folder.

### 10.2 Packaging script

The script is:

```text
scripts/build-update-artifacts.ps1
```

Stable build:

```powershell
cd D:\Edufika\Edufika2
powershell -ExecutionPolicy Bypass -File .\scripts\build-update-artifacts.ps1 -Channel stable -BaseUrl "https://srv1536310.hstgr.cloud"
```

Debug build:

```powershell
cd D:\Edufika\Edufika2
powershell -ExecutionPolicy Bypass -File .\scripts\build-update-artifacts.ps1 -Channel debug -BaseUrl "https://srv1536310.hstgr.cloud"
```

### 10.3 What the script produces

For `stable`:

```text
app/build/outputs/updates/stable/
  app-release.apk
  edufika-rn-stable-update.zip
  manifest-snippet.stable.json
```

For `debug`:

```text
app/build/outputs/updates/debug/
  app-debug.apk
  edufika-rn-debug-update.zip
  manifest-snippet.debug.json
```

The script also:

- builds the APK
- packages the React Native OTA zip
- calculates SHA-256 hashes
- writes a manifest snippet with correct values

## 11. First-Time Publish Procedure

Do this once to make the updater live with real files.

### 11.1 Build stable and debug packages

```powershell
cd D:\Edufika\Edufika2
powershell -ExecutionPolicy Bypass -File .\scripts\build-update-artifacts.ps1 -Channel stable -BaseUrl "https://srv1536310.hstgr.cloud"
powershell -ExecutionPolicy Bypass -File .\scripts\build-update-artifacts.ps1 -Channel debug -BaseUrl "https://srv1536310.hstgr.cloud"
```

### 11.2 Upload to the VPS

From Windows `cmd`:

```cmd
scp "D:\Edufika\Edufika2\edufika-session-api\updates\manifest.json" root@76.13.21.65:/tmp/manifest.json
scp "D:\Edufika\Edufika2\edufika-session-api\updates\manifest.debug.json" root@76.13.21.65:/tmp/manifest.debug.json
scp "D:\Edufika\Edufika2\app\build\outputs\updates\stable\app-release.apk" root@76.13.21.65:/tmp/app-release.apk
scp "D:\Edufika\Edufika2\app\build\outputs\updates\stable\edufika-rn-stable-update.zip" root@76.13.21.65:/tmp/edufika-rn-stable-update.zip
scp "D:\Edufika\Edufika2\app\build\outputs\updates\debug\app-debug.apk" root@76.13.21.65:/tmp/app-debug.apk
scp "D:\Edufika\Edufika2\app\build\outputs\updates\debug\edufika-rn-debug-update.zip" root@76.13.21.65:/tmp/edufika-rn-debug-update.zip
```

### 11.3 Move files into the mounted updates folder

On the VPS:

```bash
ssh root@76.13.21.65
mkdir -p /opt/edufika/updates/files/native
mkdir -p /opt/edufika/updates/files/ota

mv /tmp/manifest.json /opt/edufika/updates/manifest.json
mv /tmp/manifest.debug.json /opt/edufika/updates/manifest.debug.json
mv /tmp/app-release.apk /opt/edufika/updates/files/native/app-release.apk
mv /tmp/edufika-rn-stable-update.zip /opt/edufika/updates/files/ota/edufika-rn-stable-update.zip
mv /tmp/app-debug.apk /opt/edufika/updates/files/native/app-debug.apk
mv /tmp/edufika-rn-debug-update.zip /opt/edufika/updates/files/ota/edufika-rn-debug-update.zip

chmod 644 /opt/edufika/updates/manifest.json
chmod 644 /opt/edufika/updates/manifest.debug.json
chmod 644 /opt/edufika/updates/files/native/app-release.apk
chmod 644 /opt/edufika/updates/files/native/app-debug.apk
chmod 644 /opt/edufika/updates/files/ota/edufika-rn-stable-update.zip
chmod 644 /opt/edufika/updates/files/ota/edufika-rn-debug-update.zip
```

### 11.4 Verify endpoints

From your PC:

```cmd
curl https://srv1536310.hstgr.cloud/updates/manifest
curl "https://srv1536310.hstgr.cloud/updates/manifest?channel=debug"
curl https://srv1536310.hstgr.cloud/updates/remote-config
curl -I https://srv1536310.hstgr.cloud/updates/files/native/app-release.apk
curl -I https://srv1536310.hstgr.cloud/updates/files/native/app-debug.apk
curl -I https://srv1536310.hstgr.cloud/updates/files/ota/edufika-rn-stable-update.zip
curl -I https://srv1536310.hstgr.cloud/updates/files/ota/edufika-rn-debug-update.zip
```

## 12. Normal Publishing Workflow

When you make a new change, choose the appropriate update type.

### 12.1 Remote config only

Use this when only small flags or text changed.

Steps:

1. edit `manifest.json` and/or `manifest.debug.json`
2. update the `remoteConfig.version`
3. upload the changed manifest(s) to `/opt/edufika/updates`
4. test `/updates/remote-config`

No APK rebuild.
No OTA zip rebuild.
No backend redeploy needed.

### 12.2 React Native-only update

Use this when only React Native UI or JS logic changed.

Steps:

1. update code in `react-native/`
2. run the packaging script for the target channel
3. upload the new OTA zip
4. copy the generated `ota` section into the channel manifest
5. upload the manifest
6. launch the app and run a manual update check or restart the app

If the OTA version is newer than the currently active package, the app downloads it automatically and asks for restart.

### 12.3 Native Android update

Use this when Kotlin or native shell code changed.

Steps:

1. increase `APP_VERSION_CODE` in `gradle.properties`
2. optionally update `APP_VERSION_NAME`
3. run the packaging script
4. upload the new APK
5. update the `native` section in the manifest
6. upload the manifest
7. test on a device that has an older installed build

Important:

- if `APP_VERSION_CODE` is not higher, the app will not offer the native update

### 12.4 Backend/API update

Use this when backend code changed.

Steps:

1. build and push the new backend image
2. redeploy the backend container in Portainer
3. if manifests or update files also changed, upload them to `/opt/edufika/updates`
4. test `/health`, `/updates/manifest`, and `/updates/remote-config`

The updater cannot deploy backend code to devices. Backend changes always require a normal backend redeploy.

### 12.5 Full release

Use this when frontend, native app, and backend all changed.

Order:

1. update backend code
2. update app code
3. increase `APP_VERSION_CODE`
4. build stable and/or debug artifacts
5. redeploy backend
6. upload APK/OTA/manifest files
7. verify endpoints
8. test on device

## 13. Manual Update Testing

### 13.1 Testing stable

Use a release build installed on a device.

Then:

1. open the app
2. let startup updater run
3. or open Settings and tap `Check Updates`

Expected:

- if remote config changed:
  the app syncs config

- if OTA is newer:
  the app downloads OTA and asks for restart

- if native is newer:
  the app offers native install or starts it if mandatory

### 13.2 Testing debug

Use a debug build installed on a device.

The app will request:

```text
/updates/manifest?channel=debug
```

Expected behavior is the same, but it uses the debug manifest and debug artifacts.

## 14. Current Published Manifest Values

At the time this guide was written, the local manifests were prepared with:

### Stable

- `versionCode`: `10001`
- `versionName`: `1.0.1`
- `packageName`: `com.techivibes.edufika`
- OTA file:
  `edufika-rn-stable-update.zip`
- APK file:
  `app-release.apk`

### Debug

- `versionCode`: `10001`
- `versionName`: `1.0.1-debug`
- `packageName`: `com.techivibes.edufika.debug`
- OTA file:
  `edufika-rn-debug-update.zip`
- APK file:
  `app-debug.apk`

Important note:

If a device already has build `10001`, it will not see a native APK update until `APP_VERSION_CODE` is increased beyond `10001`.

## 15. Troubleshooting

### 15.1 `/updates/manifest` returns `Cannot GET`

Cause:

- the backend running on the VPS is still the old version

Fix:

- redeploy the updated backend container

### 15.2 `/updates/manifest` returns `{"error":"Internal server error"}`

Likely causes:

- `/opt/edufika/updates/manifest.json` is missing
- `/opt/edufika/updates/manifest.debug.json` is missing
- permissions do not allow the container to read the files
- invalid JSON syntax in the manifest

Check:

```bash
docker logs <app_container_name> --tail 100
ls -lah /opt/edufika/updates
cat /opt/edufika/updates/manifest.json
cat /opt/edufika/updates/manifest.debug.json
```

### 15.3 The app checks for updates but no native update appears

Likely causes:

- the installed app already has the same or higher `versionCode`
- `packageName` in the manifest does not match the installed app
- you forgot to increase `APP_VERSION_CODE`

### 15.4 The app checks for updates but no OTA update appears

Likely causes:

- `ota.version` did not change
- `ota` is `null`
- `minNativeVersionCode` is higher than the installed native app version
- the OTA zip URL is wrong

### 15.5 APK installer does not launch

Likely causes:

- Android unknown app sources permission is not granted
- APK download failed hash verification
- the file URL is not accessible

### 15.6 OTA downloads but the app does not load the new bundle

Likely causes:

- bundle extraction failed
- zip layout is wrong
- OTA bundle crashed before confirming startup

Expected zip layout:

```text
index.android.bundle
assets/...
```

## 16. Safe Release Checklist

Before every release:

1. decide whether the change is:
   - remote config only
   - OTA only
   - native APK
   - backend/API
   - full release

2. if native changed:
   increase `APP_VERSION_CODE`

3. run the packaging script for the correct channel

4. upload files to the VPS

5. verify:
   - `/updates/manifest`
   - `/updates/manifest?channel=debug`
   - `/updates/remote-config`
   - OTA zip URL
   - APK URL

6. test on a real device

7. confirm:
   - OTA restart flow works
   - native installer flow works
   - no update runs during active exam session

## 17. Practical Rule Of Thumb

Use this quick rule:

- changed only text, flags, banner, URLs:
  edit manifest only

- changed only React Native screens or JS logic:
  publish OTA zip

- changed Kotlin, Android shell, manifest, permissions, native modules:
  publish new APK and increase `APP_VERSION_CODE`

- changed backend routes or database logic:
  redeploy backend container

- changed everything:
  do all of the above

## 18. Most Important Things To Remember

1. The updater is automatic only after you publish the new manifest and files.
2. A new build on your PC does nothing until you upload it to the VPS.
3. Native APK updates require a higher `APP_VERSION_CODE`.
4. OTA updates require a new `ota.version`.
5. `stable` and `debug` are separate channels and separate Android package names.
6. Backend changes still require a backend redeploy.
7. The mounted VPS folder `/opt/edufika/updates` is the source of truth in production.
