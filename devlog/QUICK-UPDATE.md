# Quick Update Steps

Use this file when you want the shortest possible checklist for publishing a new Edufika app update.

## 1. Increase Native Version

Open:

```text
gradle.properties
```

Increase:

```properties
APP_VERSION_CODE=10002
APP_VERSION_NAME=1.0.2
```

Important:

- increase `APP_VERSION_CODE` every time you want devices to see a new native APK update
- if `APP_VERSION_CODE` does not change, installed devices will not treat the APK as a newer native build

## 2. Build Stable And Debug Update Artifacts

From the repo root:

```powershell
cd D:\Edufika\Edufika2
powershell -ExecutionPolicy Bypass -File .\scripts\build-update-artifacts.ps1 -Channel stable -BaseUrl "https://srv1536310.hstgr.cloud"
powershell -ExecutionPolicy Bypass -File .\scripts\build-update-artifacts.ps1 -Channel debug -BaseUrl "https://srv1536310.hstgr.cloud"
```

This generates:

- stable APK
- stable OTA zip
- stable manifest snippet
- debug APK
- debug OTA zip
- debug manifest snippet

Output folders:

- `app/build/outputs/updates/stable`
- `app/build/outputs/updates/debug`

## 3. Update The Manifests

Open these generated files:

- `app/build/outputs/updates/stable/manifest-snippet.stable.json`
- `app/build/outputs/updates/debug/manifest-snippet.debug.json`

Copy the new values into:

- `edufika-session-api/updates/manifest.json`
- `edufika-session-api/updates/manifest.debug.json`

At minimum, update:

- `generatedAt`
- `remoteConfig`
- `ota`
- `native`

## 4. Upload The Files To The VPS

From Windows `cmd`:

```cmd
scp "D:\Edufika\Edufika2\edufika-session-api\updates\manifest.json" root@76.13.21.65:/tmp/manifest.json
scp "D:\Edufika\Edufika2\edufika-session-api\updates\manifest.debug.json" root@76.13.21.65:/tmp/manifest.debug.json
scp "D:\Edufika\Edufika2\app\build\outputs\updates\stable\app-release.apk" root@76.13.21.65:/tmp/app-release.apk
scp "D:\Edufika\Edufika2\app\build\outputs\updates\stable\edufika-rn-stable-update.zip" root@76.13.21.65:/tmp/edufika-rn-stable-update.zip
scp "D:\Edufika\Edufika2\app\build\outputs\updates\debug\app-debug.apk" root@76.13.21.65:/tmp/app-debug.apk
scp "D:\Edufika\Edufika2\app\build\outputs\updates\debug\edufika-rn-debug-update.zip" root@76.13.21.65:/tmp/edufika-rn-debug-update.zip
```

## 5. Move The Files Into The Server Update Folder

On the VPS:

```bash
ssh root@76.13.21.65
mv /tmp/manifest.json /opt/edufika/updates/manifest.json
mv /tmp/manifest.debug.json /opt/edufika/updates/manifest.debug.json
mv /tmp/app-release.apk /opt/edufika/updates/files/native/app-release.apk
mv /tmp/edufika-rn-stable-update.zip /opt/edufika/updates/files/ota/edufika-rn-stable-update.zip
mv /tmp/app-debug.apk /opt/edufika/updates/files/native/app-debug.apk
mv /tmp/edufika-rn-debug-update.zip /opt/edufika/updates/files/ota/edufika-rn-debug-update.zip
```

## 6. Verify The Live Endpoints

From your PC:

```cmd
curl https://srv1536310.hstgr.cloud/updates/manifest
curl "https://srv1536310.hstgr.cloud/updates/manifest?channel=debug"
curl -I https://srv1536310.hstgr.cloud/updates/files/native/app-release.apk
curl -I https://srv1536310.hstgr.cloud/updates/files/ota/edufika-rn-stable-update.zip
curl -I https://srv1536310.hstgr.cloud/updates/files/native/app-debug.apk
curl -I https://srv1536310.hstgr.cloud/updates/files/ota/edufika-rn-debug-update.zip
```

## 7. Test In The App

On a device:

1. open the app
2. go to Settings
3. tap `Check Updates`

Expected:

- release app reads `stable`
- debug app reads `debug`
- OTA update downloads first if available
- native APK update appears if the installed `versionCode` is lower than the manifest `versionCode`

## Quick Rules

- React Native-only change:
  publish OTA zip

- Native Android change:
  increase `APP_VERSION_CODE` and publish APK

- Backend change:
  redeploy backend container

- Tiny config/text change:
  update manifest only

## Most Important Reminder

A new local build does nothing until:

1. you upload the APK/OTA files
2. you upload the updated manifest
3. the app checks the live VPS manifest again
