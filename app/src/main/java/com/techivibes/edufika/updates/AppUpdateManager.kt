package com.techivibes.edufika.updates

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.content.FileProvider
import com.techivibes.edufika.BuildConfig
import com.techivibes.edufika.data.SessionState
import com.techivibes.edufika.utils.TestConstants
import com.techivibes.edufika.utils.TestUtils
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.TimeUnit
import java.util.zip.ZipInputStream

class AppUpdateManager(
    private val appContext: Context,
    private val onProgress: (JSONObject) -> Unit = {}
) {

    private val httpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(12, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    fun checkForUpdates(baseUrlOverride: String?): JSONObject {
        emitProgress(
            stage = "checking",
            kind = "manifest",
            message = "Checking Edufika update channel...",
            progress = 0.08
        )
        val manifestUrl = buildManifestUrl(baseUrlOverride)
        val responseText = fetchText(manifestUrl)
        val manifest = UpdateManifest.fromJson(responseText)
        AppUpdateStore.writeManifest(appContext, responseText)
        AppUpdateStore.writeRemoteConfig(appContext, manifest.remoteConfig.toJson().toString())
        emitProgress(
            stage = "completed",
            kind = "manifest",
            message = "Update manifest synchronized.",
            progress = 1.0
        )
        return buildSnapshot(manifest)
    }

    fun getCachedSnapshot(): JSONObject {
        val manifest = readCachedManifest()
        return buildSnapshot(manifest)
    }

    fun getRemoteConfigJson(): String {
        val raw = AppUpdateStore.readRemoteConfig(appContext).trim()
        if (raw.isNotBlank()) {
            return raw
        }
        return UpdateManifest.empty().remoteConfig.toJson().toString()
    }

    fun startOtaUpdate(): JSONObject {
        if (SessionState.isStudentExamSessionActive()) {
            throw IllegalStateException("Updates are deferred while an exam session is active.")
        }
        val manifest = readRequiredManifest()
        val release = manifest.ota
            ?: throw IllegalStateException("No React Native OTA package is published.")
        if (!isOtaAvailable(release)) {
            emitProgress(
                stage = "completed",
                kind = "ota",
                message = "React Native bundle is already current.",
                progress = 1.0,
                versionLabel = release.version
            )
            return buildSnapshot(manifest)
        }
        if (BuildConfig.VERSION_CODE < release.minNativeVersionCode) {
            throw IllegalStateException(
                "This OTA package requires native build ${release.minNativeVersionCode} or newer."
            )
        }

        val packageDir = AppUpdateStore.otaPackageDir(appContext, release.version)
        if (packageDir.exists()) {
            deleteRecursively(packageDir)
        }
        packageDir.mkdirs()

        val tempZip = File(packageDir.parentFile, "${sanitizeVersion(release.version)}.zip")
        downloadFile(
            url = release.bundleUrl,
            targetFile = tempZip,
            expectedSha256 = release.sha256,
            kind = "ota",
            versionLabel = release.version
        )

        emitProgress(
            stage = "extracting",
            kind = "ota",
            message = "Extracting React Native update package...",
            progress = 0.92,
            versionLabel = release.version
        )
        unzip(tempZip, packageDir)
        runCatching { tempZip.delete() }

        val bundleFile = File(packageDir, UpdateConstants.OTA_BUNDLE_ENTRY)
        if (!bundleFile.exists() || !bundleFile.isFile) {
            deleteRecursively(packageDir)
            throw IOException("OTA package is missing ${UpdateConstants.OTA_BUNDLE_ENTRY}.")
        }

        AppUpdateStore.activateOtaPackage(
            context = appContext,
            version = release.version,
            packageDir = packageDir,
            bundleFile = bundleFile
        )
        emitProgress(
            stage = "applied",
            kind = "ota",
            message = "React Native update ready. Restart required.",
            progress = 1.0,
            versionLabel = release.version,
            restartRequired = true
        )
        return buildSnapshot(manifest)
    }

    fun startNativeUpdate(): JSONObject {
        if (SessionState.isStudentExamSessionActive()) {
            throw IllegalStateException("Updates are deferred while an exam session is active.")
        }
        val manifest = readRequiredManifest()
        val release = manifest.native
            ?: throw IllegalStateException("No native APK release is published.")
        if (!isNativeUpdateAvailable(release)) {
            emitProgress(
                stage = "completed",
                kind = "native",
                message = "Native shell is already current.",
                progress = 1.0,
                versionLabel = release.versionName
            )
            return buildSnapshot(manifest)
        }

        val apkFile = AppUpdateStore.nativeApkFile(
            context = appContext,
            versionCode = release.versionCode,
            versionName = release.versionName
        )
        downloadFile(
            url = release.apkUrl,
            targetFile = apkFile,
            expectedSha256 = release.sha256,
            kind = "native",
            versionLabel = "${release.versionName} (${release.versionCode})"
        )

        AppUpdateStore.writeNativeApk(
            context = appContext,
            versionCode = release.versionCode,
            versionName = release.versionName,
            sha256 = release.sha256,
            apkFile = apkFile
        )
        emitProgress(
            stage = "ready_to_install",
            kind = "native",
            message = "Native installer package downloaded.",
            progress = 1.0,
            versionLabel = "${release.versionName} (${release.versionCode})"
        )

        if (!canRequestPackageInstalls()) {
            emitProgress(
                stage = "needs_permission",
                kind = "native",
                message = "Allow app installs from Edufika to continue.",
                progress = 1.0,
                versionLabel = "${release.versionName} (${release.versionCode})"
            )
            return buildSnapshot(manifest)
        }

        installDownloadedNativeUpdate()
        return buildSnapshot(manifest)
    }

    fun installDownloadedNativeUpdate(): Boolean {
        val apkFile = AppUpdateStore.getDownloadedNativeApk(appContext) ?: return false
        val apkUri = FileProvider.getUriForFile(
            appContext,
            "${appContext.packageName}.fileprovider",
            apkFile
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(apkUri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        Handler(Looper.getMainLooper()).post {
            appContext.startActivity(intent)
        }
        emitProgress(
            stage = "installing",
            kind = "native",
            message = "Installer launched. Complete the Android install prompt.",
            progress = 1.0,
            versionLabel = AppUpdateStore.getDownloadedNativeVersionName(appContext),
            installerLaunched = true
        )
        return true
    }

    fun canRequestPackageInstalls(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            appContext.packageManager.canRequestPackageInstalls()
    }

    fun openUnknownAppSourcesSettings(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return false
        }
        val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
            data = Uri.parse("package:${appContext.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        appContext.startActivity(intent)
        return true
    }

    private fun readRequiredManifest(): UpdateManifest {
        return readCachedManifest()
            ?: throw IllegalStateException("Update manifest is not cached yet. Run a check first.")
    }

    private fun readCachedManifest(): UpdateManifest? {
        val raw = AppUpdateStore.readManifest(appContext).trim()
        if (raw.isBlank()) {
            return null
        }
        return runCatching { UpdateManifest.fromJson(raw) }.getOrNull()
    }

    private fun buildManifestUrl(baseUrlOverride: String?): String {
        val normalizedBase = normalizeBaseUrl(baseUrlOverride)
        return buildString {
            append(normalizedBase.trimEnd('/'))
            append("/updates/manifest")
            append("?platform=android")
            append("&channel=${BuildConfig.UPDATE_CHANNEL}")
            append("&version_code=${BuildConfig.VERSION_CODE}")
            append("&version_name=${Uri.encode(BuildConfig.VERSION_NAME)}")
            append("&package_name=${Uri.encode(BuildConfig.APPLICATION_ID)}")
        }
    }

    private fun normalizeBaseUrl(baseUrlOverride: String?): String {
        val raw = baseUrlOverride?.trim().orEmpty().ifBlank { TestConstants.SERVER_BASE_URL }
        return TestUtils.migrateBackendBaseUrl(raw)
    }

    private fun fetchText(url: String): String {
        val request = Request.Builder().url(url).get().build()
        httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("Update request failed with HTTP ${response.code}")
            }
            return response.body?.string()?.takeIf { it.isNotBlank() }
                ?: throw IOException("Update server returned an empty response.")
        }
    }

    private fun downloadFile(
        url: String,
        targetFile: File,
        expectedSha256: String,
        kind: String,
        versionLabel: String
    ) {
        val parentDir = targetFile.parentFile
        if (parentDir != null && !parentDir.exists()) {
            parentDir.mkdirs()
        }
        if (targetFile.exists()) {
            runCatching { targetFile.delete() }
        }

        val request = Request.Builder().url(url).get().build()
        httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("Download failed with HTTP ${response.code}")
            }

            val totalBytes = response.body?.contentLength() ?: -1L
            val body = response.body ?: throw IOException("No response body for download.")
            body.byteStream().use { input ->
                FileOutputStream(targetFile).use { output ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    var downloadedBytes = 0L
                    var read = input.read(buffer)
                    while (read >= 0) {
                        if (read > 0) {
                            output.write(buffer, 0, read)
                            downloadedBytes += read
                            val progress = when {
                                totalBytes > 0L -> downloadedBytes.toDouble() / totalBytes.toDouble()
                                else -> 0.0
                            }.coerceIn(0.0, 0.88)
                            emitProgress(
                                stage = "downloading",
                                kind = kind,
                                message = "Downloading $versionLabel...",
                                progress = progress,
                                totalBytes = totalBytes,
                                downloadedBytes = downloadedBytes,
                                versionLabel = versionLabel
                            )
                        }
                        read = input.read(buffer)
                    }
                    output.flush()
                }
            }
        }

        emitProgress(
            stage = "verifying",
            kind = kind,
            message = "Verifying package integrity...",
            progress = 0.9,
            versionLabel = versionLabel
        )
        val actualSha256 = sha256(targetFile)
        if (!actualSha256.equals(expectedSha256.trim(), ignoreCase = true)) {
            runCatching { targetFile.delete() }
            throw IOException("SHA-256 mismatch for downloaded $kind package.")
        }
    }

    private fun buildSnapshot(manifest: UpdateManifest?): JSONObject {
        val remoteConfig = runCatching {
            JSONObject(getRemoteConfigJson())
        }.getOrElse { UpdateManifest.empty().remoteConfig.toJson() }
        val otaRelease = manifest?.ota
        val nativeRelease = manifest?.native
        val activeOtaVersion = AppUpdateStore.getActiveOtaVersion(appContext)
        val downloadedNativeVersionCode = AppUpdateStore.getDownloadedNativeVersionCode(appContext)
        return JSONObject().apply {
            put("channel", manifest?.channel ?: BuildConfig.UPDATE_CHANNEL)
            put("generatedAt", manifest?.generatedAt ?: JSONObject.NULL)
            put(
                "current",
                JSONObject().apply {
                    put("versionCode", BuildConfig.VERSION_CODE)
                    put("versionName", BuildConfig.VERSION_NAME)
                    put("packageName", BuildConfig.APPLICATION_ID)
                    put("updateChannel", BuildConfig.UPDATE_CHANNEL)
                    put("activeOtaVersion", if (activeOtaVersion.isBlank()) JSONObject.NULL else activeOtaVersion)
                }
            )
            put("remoteConfig", remoteConfig)
            put(
                "ota",
                JSONObject().apply {
                    put("available", otaRelease?.let { isOtaAvailable(it) } == true)
                    put("version", otaRelease?.version ?: JSONObject.NULL)
                    put("mandatory", otaRelease?.mandatory ?: false)
                    put("notes", otaRelease?.notes ?: "")
                    put("minNativeVersionCode", otaRelease?.minNativeVersionCode ?: 0)
                }
            )
            put(
                "native",
                JSONObject().apply {
                    put("available", nativeRelease?.let { isNativeUpdateAvailable(it) } == true)
                    put("versionCode", nativeRelease?.versionCode ?: 0)
                    put("versionName", nativeRelease?.versionName ?: JSONObject.NULL)
                    put("packageName", nativeRelease?.packageName ?: JSONObject.NULL)
                    put("mandatory", nativeRelease?.mandatory ?: false)
                    put("notes", nativeRelease?.notes ?: "")
                    put("downloaded", downloadedNativeVersionCode == (nativeRelease?.versionCode ?: -1))
                    put("installerPermissionGranted", canRequestPackageInstalls())
                }
            )
            put("runtime", AppUpdateStore.buildRuntimeStateJson(appContext))
        }
    }

    private fun isOtaAvailable(release: OtaRelease): Boolean {
        if (BuildConfig.VERSION_CODE < release.minNativeVersionCode) {
            return false
        }
        return AppUpdateStore.getActiveOtaVersion(appContext) != release.version
    }

    private fun isNativeUpdateAvailable(release: NativeRelease): Boolean {
        if (!release.packageName.isNullOrBlank() && release.packageName != BuildConfig.APPLICATION_ID) {
            return false
        }
        return release.versionCode > BuildConfig.VERSION_CODE
    }

    private fun emitProgress(
        stage: String,
        kind: String,
        message: String,
        progress: Double,
        totalBytes: Long = -1L,
        downloadedBytes: Long = -1L,
        versionLabel: String = "",
        restartRequired: Boolean = false,
        installerLaunched: Boolean = false
    ) {
        onProgress(
            JSONObject().apply {
                put("stage", stage)
                put("kind", kind)
                put("message", message)
                put("progress", progress.coerceIn(0.0, 1.0))
                put("totalBytes", totalBytes)
                put("downloadedBytes", downloadedBytes)
                put("versionLabel", versionLabel)
                put("restartRequired", restartRequired)
                put("installerLaunched", installerLaunched)
                put("timestamp", System.currentTimeMillis())
            }
        )
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            var read = input.read(buffer)
            while (read >= 0) {
                if (read > 0) {
                    digest.update(buffer, 0, read)
                }
                read = input.read(buffer)
            }
        }
        return digest.digest().joinToString("") { byte ->
            String.format(Locale.US, "%02x", byte)
        }
    }

    private fun unzip(zipFile: File, destinationDir: File) {
        ZipInputStream(zipFile.inputStream().buffered()).use { zip ->
            var entry = zip.nextEntry
            while (entry != null) {
                val targetFile = File(destinationDir, entry.name).canonicalFile
                if (!targetFile.path.startsWith(destinationDir.canonicalPath + File.separator)) {
                    throw IOException("Blocked invalid zip entry: ${entry.name}")
                }
                if (entry.isDirectory) {
                    targetFile.mkdirs()
                } else {
                    targetFile.parentFile?.mkdirs()
                    FileOutputStream(targetFile).use { output ->
                        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                        var read = zip.read(buffer)
                        while (read >= 0) {
                            if (read > 0) {
                                output.write(buffer, 0, read)
                            }
                            read = zip.read(buffer)
                        }
                    }
                }
                zip.closeEntry()
                entry = zip.nextEntry
            }
        }
    }

    private fun sanitizeVersion(raw: String): String {
        return raw.replace(Regex("[^A-Za-z0-9._-]"), "_").ifBlank { "release" }
    }

    private fun deleteRecursively(file: File) {
        if (!file.exists()) {
            return
        }
        if (file.isDirectory) {
            file.listFiles()?.forEach(::deleteRecursively)
        }
        runCatching { file.delete() }
    }
}

private data class UpdateManifest(
    val channel: String,
    val generatedAt: String,
    val remoteConfig: RemoteConfig,
    val ota: OtaRelease?,
    val native: NativeRelease?
) {
    companion object {
        fun empty(): UpdateManifest {
            return UpdateManifest(
                channel = "stable",
                generatedAt = "",
                remoteConfig = RemoteConfig(version = "1", values = JSONObject()),
                ota = null,
                native = null
            )
        }

        fun fromJson(raw: String): UpdateManifest {
            val json = JSONObject(raw)
            return UpdateManifest(
                channel = json.optString("channel", "stable"),
                generatedAt = json.optString("generatedAt", ""),
                remoteConfig = RemoteConfig.fromJson(json.optJSONObject("remoteConfig")),
                ota = OtaRelease.fromJson(json.optJSONObject("ota")),
                native = NativeRelease.fromJson(json.optJSONObject("native"))
            )
        }
    }
}

private data class RemoteConfig(
    val version: String,
    val values: JSONObject
) {
    fun toJson(): JSONObject {
        return JSONObject().apply {
            put("version", version)
            put("values", values)
        }
    }

    companion object {
        fun fromJson(json: JSONObject?): RemoteConfig {
            return RemoteConfig(
                version = json?.optString("version", "1").orEmpty().ifBlank { "1" },
                values = json?.optJSONObject("values") ?: JSONObject()
            )
        }
    }
}

private data class OtaRelease(
    val version: String,
    val mandatory: Boolean,
    val minNativeVersionCode: Int,
    val bundleUrl: String,
    val sha256: String,
    val notes: String
) {
    companion object {
        fun fromJson(json: JSONObject?): OtaRelease? {
            if (json == null) {
                return null
            }
            val version = json.optString("version").trim()
            val bundleUrl = json.optString("bundleUrl").trim()
            val sha256 = json.optString("sha256").trim()
            if (version.isBlank() || bundleUrl.isBlank() || sha256.isBlank()) {
                return null
            }
            return OtaRelease(
                version = version,
                mandatory = json.optBoolean("mandatory", false),
                minNativeVersionCode = json.optInt("minNativeVersionCode", 0),
                bundleUrl = bundleUrl,
                sha256 = sha256,
                notes = json.optString("notes", "")
            )
        }
    }
}

private data class NativeRelease(
    val versionCode: Int,
    val versionName: String,
    val mandatory: Boolean,
    val apkUrl: String,
    val sha256: String,
    val notes: String,
    val packageName: String?
) {
    companion object {
        fun fromJson(json: JSONObject?): NativeRelease? {
            if (json == null) {
                return null
            }
            val versionCode = json.optInt("versionCode", 0)
            val versionName = json.optString("versionName").trim()
            val apkUrl = json.optString("apkUrl").trim()
            val sha256 = json.optString("sha256").trim()
            if (versionCode <= 0 || versionName.isBlank() || apkUrl.isBlank() || sha256.isBlank()) {
                return null
            }
            return NativeRelease(
                versionCode = versionCode,
                versionName = versionName,
                mandatory = json.optBoolean("mandatory", false),
                apkUrl = apkUrl,
                sha256 = sha256,
                notes = json.optString("notes", ""),
                packageName = json.optString("packageName").trim().ifBlank { null }
            )
        }
    }
}
