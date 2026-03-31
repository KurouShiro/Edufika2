# Auto-Update Rollout

Edufika now supports three update lanes:

- Remote config: small switches and text changes from the backend manifest.
- React Native OTA: JS/UI-only updates delivered as a zip with `index.android.bundle` and assets.
- Native APK updates: full Android shell updates for Kotlin, manifest, permissions, and native modules.

## Channels

- Release builds request the `stable` channel automatically.
- Debug builds request the `debug` channel automatically.
- Stable manifest file: [edufika-session-api/updates/manifest.json](/d:/Edufika/Edufika2/edufika-session-api/updates/manifest.json)
- Debug manifest file: [edufika-session-api/updates/manifest.debug.json](/d:/Edufika/Edufika2/edufika-session-api/updates/manifest.debug.json)

## App Changes Already Wired

- The Android app fetches `/updates/manifest?channel=<stable|debug>`.
- OTA bundles are loaded from disk on restart and roll back automatically if the new bundle never confirms startup.
- Native APK downloads are verified with SHA-256 before Android install handoff.
- The React Native startup flow shows the new CRT update screen and runs update checks before entering the app.
- Updates are deferred while an exam session is active.

## Backend Setup

1. Deploy the updated `edufika-session-api` image or source code.
2. Set these environment variables on the backend container:

```env
HOST=0.0.0.0
PORT=8091
NODE_ENV=production
PUBLIC_BASE_URL=https://srv1536310.hstgr.cloud
UPDATE_DEFAULT_CHANNEL=stable
```

3. Mount a persistent updates directory into the API container:

```yaml
volumes:
  - /opt/edufika/updates:/app/updates
```

4. Make sure these files exist on the VPS host:

```text
/opt/edufika/updates/manifest.json
/opt/edufika/updates/manifest.debug.json
/opt/edufika/updates/files/native/app-release.apk
/opt/edufika/updates/files/native/app-debug.apk
/opt/edufika/updates/files/ota/edufika-rn-stable-update.zip
/opt/edufika/updates/files/ota/edufika-rn-debug-update.zip
```

5. Verify the API routes:

```bash
curl https://srv1536310.hstgr.cloud/updates/manifest
curl "https://srv1536310.hstgr.cloud/updates/manifest?channel=debug"
curl https://srv1536310.hstgr.cloud/updates/remote-config
curl "https://srv1536310.hstgr.cloud/updates/remote-config?channel=debug"
```

## VPS / Nginx Setup

Your host Nginx must proxy `/updates/` to the API container on `127.0.0.1:8091`.

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

Keep the rest of your reverse proxy rules unchanged.

## Building Update Artifacts

Use the new helper script from the repo root.

Stable:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-update-artifacts.ps1 -Channel stable -BaseUrl "https://srv1536310.hstgr.cloud"
```

Debug:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-update-artifacts.ps1 -Channel debug -BaseUrl "https://srv1536310.hstgr.cloud"
```

The script builds the APK, packages the OTA zip, computes SHA-256 hashes, and writes a manifest snippet here:

- [app/build/outputs/updates/stable](/d:/Edufika/Edufika2/app/build/outputs/updates/stable)
- [app/build/outputs/updates/debug](/d:/Edufika/Edufika2/app/build/outputs/updates/debug)

## Publishing An Update

1. Run the packaging script for the channel you want.
2. Upload the generated APK and OTA zip to `/opt/edufika/updates/files/...` on the VPS.
3. Copy the generated hash values into the matching manifest file.
4. Set `packageName` in the native section:
   - `com.techivibes.edufika` for stable
   - `com.techivibes.edufika.debug` for debug
5. Restart or redeploy the backend only if the API image changed.
   If you only changed manifest files or update artifacts in the mounted folder, no image rebuild is required.

Example native section:

```json
{
  "versionCode": 10001,
  "versionName": "1.0.1",
  "mandatory": false,
  "apkUrl": "/updates/files/native/app-release.apk",
  "packageName": "com.techivibes.edufika",
  "sha256": "lowercase_hex_sha256",
  "notes": "Native runtime update"
}
```

## Portainer Checklist

- App container publishes `127.0.0.1:8091:8091`
- App container mounts `/opt/edufika/updates:/app/updates`
- App container includes `PUBLIC_BASE_URL=https://srv1536310.hstgr.cloud`
- Host Nginx proxies `/health`, `/api/`, `/updates/`, and `/ws`
- MariaDB does not need any updater-specific changes

## How The App Behaves

- On startup, the app downloads the current manifest and remote config.
- If an OTA package is available and compatible, it downloads first and activates on restart.
- If a native APK update is available, the app downloads it and launches the Android installer flow.
- Manual update checks are also available from Settings.
- The updater will refuse to install during an active exam session.
