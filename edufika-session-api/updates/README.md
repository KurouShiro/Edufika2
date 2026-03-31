## Update Assets

Place distributable files here for the in-app updater.

- `manifest.json` is the default `stable` channel manifest.
- `manifest.debug.json` is the optional `debug` channel manifest.
- `files/` is exposed by the API at `/updates/files/...`.
- The app requests `/updates/manifest?channel=stable` for release builds and `/updates/manifest?channel=debug` for debug builds.

Expected manifest fields:

```json
{
  "channel": "stable",
  "generatedAt": "2026-03-31T00:00:00.000Z",
  "remoteConfig": {
    "version": "2026.03.31.1",
    "values": {
      "defaultBackendBaseUrl": "https://example.com",
      "preferredThemeId": "matrix"
    }
  },
  "ota": {
    "version": "2026.03.31-rn1",
    "mandatory": false,
    "minNativeVersionCode": 10001,
    "bundleUrl": "/updates/files/ota/edufika-rn-update.zip",
    "sha256": "lowercase_hex_sha256",
    "notes": "JS/UI refresh"
  },
  "native": {
    "versionCode": 10002,
    "versionName": "1.0.2",
    "mandatory": false,
    "apkUrl": "/updates/files/native/app-release.apk",
    "packageName": "com.techivibes.edufika",
    "sha256": "lowercase_hex_sha256",
    "notes": "Native runtime update"
  }
}
```

Suggested OTA zip layout:

```text
index.android.bundle
assets/...
```

Suggested file layout:

```text
updates/
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
