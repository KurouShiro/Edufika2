package com.techivibes.edufika.updates

object UpdateConstants {
    const val MODULE_NAME = "EdufikaUpdates"
    const val EVENT_PROGRESS = "EdufikaUpdateProgress"

    const val PREF_UPDATE_MANIFEST_JSON = "pref_update_manifest_json"
    const val PREF_UPDATE_MANIFEST_FETCHED_AT = "pref_update_manifest_fetched_at"
    const val PREF_REMOTE_CONFIG_JSON = "pref_remote_config_json"
    const val PREF_REMOTE_CONFIG_FETCHED_AT = "pref_remote_config_fetched_at"
    const val PREF_OTA_ACTIVE_VERSION = "pref_ota_active_version"
    const val PREF_OTA_ACTIVE_PACKAGE_DIR = "pref_ota_active_package_dir"
    const val PREF_OTA_ACTIVE_BUNDLE_PATH = "pref_ota_active_bundle_path"
    const val PREF_OTA_PENDING_CONFIRM_VERSION = "pref_ota_pending_confirm_version"
    const val PREF_OTA_PENDING_CONFIRM_ATTEMPTED = "pref_ota_pending_confirm_attempted"
    const val PREF_NATIVE_APK_PATH = "pref_native_apk_path"
    const val PREF_NATIVE_APK_VERSION_CODE = "pref_native_apk_version_code"
    const val PREF_NATIVE_APK_VERSION_NAME = "pref_native_apk_version_name"
    const val PREF_NATIVE_APK_SHA256 = "pref_native_apk_sha256"

    const val UPDATE_ROOT_DIR = "updates"
    const val OTA_PACKAGES_DIR = "ota_packages"
    const val NATIVE_PACKAGES_DIR = "native_packages"
    const val OTA_BUNDLE_ENTRY = "index.android.bundle"
}
