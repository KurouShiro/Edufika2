package com.techivibes.edufika.updates

import android.content.Context
import com.techivibes.edufika.utils.TestConstants
import org.json.JSONObject
import java.io.File

object AppUpdateStore {

    @Volatile
    private var launchPreparedForVersion: String? = null

    fun writeManifest(context: Context, manifestJson: String) {
        prefs(context).edit()
            .putString(UpdateConstants.PREF_UPDATE_MANIFEST_JSON, manifestJson)
            .putLong(UpdateConstants.PREF_UPDATE_MANIFEST_FETCHED_AT, System.currentTimeMillis())
            .apply()
    }

    fun readManifest(context: Context): String {
        return prefs(context).getString(UpdateConstants.PREF_UPDATE_MANIFEST_JSON, "") ?: ""
    }

    fun manifestFetchedAt(context: Context): Long {
        return prefs(context).getLong(UpdateConstants.PREF_UPDATE_MANIFEST_FETCHED_AT, 0L)
    }

    fun writeRemoteConfig(context: Context, remoteConfigJson: String) {
        prefs(context).edit()
            .putString(UpdateConstants.PREF_REMOTE_CONFIG_JSON, remoteConfigJson)
            .putLong(UpdateConstants.PREF_REMOTE_CONFIG_FETCHED_AT, System.currentTimeMillis())
            .apply()
    }

    fun readRemoteConfig(context: Context): String {
        return prefs(context).getString(UpdateConstants.PREF_REMOTE_CONFIG_JSON, "") ?: ""
    }

    fun remoteConfigFetchedAt(context: Context): Long {
        return prefs(context).getLong(UpdateConstants.PREF_REMOTE_CONFIG_FETCHED_AT, 0L)
    }

    fun activateOtaPackage(
        context: Context,
        version: String,
        packageDir: File,
        bundleFile: File
    ) {
        prefs(context).edit()
            .putString(UpdateConstants.PREF_OTA_ACTIVE_VERSION, version)
            .putString(UpdateConstants.PREF_OTA_ACTIVE_PACKAGE_DIR, packageDir.absolutePath)
            .putString(UpdateConstants.PREF_OTA_ACTIVE_BUNDLE_PATH, bundleFile.absolutePath)
            .putString(UpdateConstants.PREF_OTA_PENDING_CONFIRM_VERSION, version)
            .putBoolean(UpdateConstants.PREF_OTA_PENDING_CONFIRM_ATTEMPTED, false)
            .apply()
        launchPreparedForVersion = null
    }

    fun getActiveOtaVersion(context: Context): String {
        return prefs(context).getString(UpdateConstants.PREF_OTA_ACTIVE_VERSION, "") ?: ""
    }

    fun getActiveBundleFile(context: Context): File? {
        val rawPath = prefs(context).getString(UpdateConstants.PREF_OTA_ACTIVE_BUNDLE_PATH, null)
        val path = rawPath?.trim().orEmpty()
        if (path.isBlank()) {
            return null
        }
        val bundleFile = File(path)
        return bundleFile.takeIf { it.exists() && it.isFile }
    }

    fun confirmActiveBundle(context: Context) {
        prefs(context).edit()
            .remove(UpdateConstants.PREF_OTA_PENDING_CONFIRM_VERSION)
            .putBoolean(UpdateConstants.PREF_OTA_PENDING_CONFIRM_ATTEMPTED, false)
            .apply()
        launchPreparedForVersion = null
    }

    fun prepareBundleForLaunch(context: Context): File? {
        val bundleFile = getActiveBundleFile(context) ?: return null
        val prefs = prefs(context)
        val activeVersion = getActiveOtaVersion(context)
        val pendingVersion = prefs.getString(UpdateConstants.PREF_OTA_PENDING_CONFIRM_VERSION, "") ?: ""
        if (pendingVersion.isBlank() || pendingVersion != activeVersion) {
            return bundleFile
        }

        if (launchPreparedForVersion == activeVersion) {
            return bundleFile
        }

        val attempted = prefs.getBoolean(UpdateConstants.PREF_OTA_PENDING_CONFIRM_ATTEMPTED, false)
        if (attempted) {
            rollbackActiveBundle(context)
            return null
        }

        prefs.edit()
            .putBoolean(UpdateConstants.PREF_OTA_PENDING_CONFIRM_ATTEMPTED, true)
            .apply()
        launchPreparedForVersion = activeVersion
        return bundleFile
    }

    fun rollbackActiveBundle(context: Context) {
        val prefs = prefs(context)
        val packageDir = prefs.getString(UpdateConstants.PREF_OTA_ACTIVE_PACKAGE_DIR, null)
            ?.trim()
            .orEmpty()
        prefs.edit()
            .remove(UpdateConstants.PREF_OTA_ACTIVE_VERSION)
            .remove(UpdateConstants.PREF_OTA_ACTIVE_PACKAGE_DIR)
            .remove(UpdateConstants.PREF_OTA_ACTIVE_BUNDLE_PATH)
            .remove(UpdateConstants.PREF_OTA_PENDING_CONFIRM_VERSION)
            .putBoolean(UpdateConstants.PREF_OTA_PENDING_CONFIRM_ATTEMPTED, false)
            .apply()
        launchPreparedForVersion = null
        if (packageDir.isNotBlank()) {
            deleteRecursively(File(packageDir))
        }
    }

    fun writeNativeApk(
        context: Context,
        versionCode: Int,
        versionName: String,
        sha256: String,
        apkFile: File
    ) {
        prefs(context).edit()
            .putInt(UpdateConstants.PREF_NATIVE_APK_VERSION_CODE, versionCode)
            .putString(UpdateConstants.PREF_NATIVE_APK_VERSION_NAME, versionName)
            .putString(UpdateConstants.PREF_NATIVE_APK_SHA256, sha256)
            .putString(UpdateConstants.PREF_NATIVE_APK_PATH, apkFile.absolutePath)
            .apply()
    }

    fun getDownloadedNativeApk(context: Context): File? {
        val rawPath = prefs(context).getString(UpdateConstants.PREF_NATIVE_APK_PATH, null)
        val path = rawPath?.trim().orEmpty()
        if (path.isBlank()) {
            return null
        }
        val apkFile = File(path)
        return apkFile.takeIf { it.exists() && it.isFile }
    }

    fun getDownloadedNativeVersionCode(context: Context): Int {
        return prefs(context).getInt(UpdateConstants.PREF_NATIVE_APK_VERSION_CODE, 0)
    }

    fun getDownloadedNativeVersionName(context: Context): String {
        return prefs(context).getString(UpdateConstants.PREF_NATIVE_APK_VERSION_NAME, "") ?: ""
    }

    fun updateRootDir(context: Context): File {
        val root = File(context.filesDir, UpdateConstants.UPDATE_ROOT_DIR)
        if (!root.exists()) {
            root.mkdirs()
        }
        return root
    }

    fun otaPackagesDir(context: Context): File {
        val dir = File(updateRootDir(context), UpdateConstants.OTA_PACKAGES_DIR)
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return dir
    }

    fun nativePackagesDir(context: Context): File {
        val dir = File(updateRootDir(context), UpdateConstants.NATIVE_PACKAGES_DIR)
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return dir
    }

    fun otaPackageDir(context: Context, version: String): File {
        return File(otaPackagesDir(context), sanitizeVersion(version))
    }

    fun nativeApkFile(context: Context, versionCode: Int, versionName: String): File {
        val safeName = sanitizeVersion("$versionName-$versionCode")
        return File(nativePackagesDir(context), "edufika-$safeName.apk")
    }

    fun buildRuntimeStateJson(context: Context): JSONObject {
        return JSONObject().apply {
            put("activeOtaVersion", getActiveOtaVersion(context))
            put("activeBundlePath", getActiveBundleFile(context)?.absolutePath ?: JSONObject.NULL)
            put("manifestFetchedAt", manifestFetchedAt(context))
            put("remoteConfigFetchedAt", remoteConfigFetchedAt(context))
            put("downloadedNativeVersionCode", getDownloadedNativeVersionCode(context))
            val nativeVersionName = getDownloadedNativeVersionName(context)
            put(
                "downloadedNativeVersionName",
                if (nativeVersionName.isBlank()) JSONObject.NULL else nativeVersionName
            )
        }
    }

    private fun prefs(context: Context) =
        context.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)

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
