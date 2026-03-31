package com.techivibes.edufika.rn

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.techivibes.edufika.updates.AppRestartHelper
import com.techivibes.edufika.updates.AppUpdateManager
import com.techivibes.edufika.updates.AppUpdateStore
import com.techivibes.edufika.updates.UpdateConstants
import java.util.concurrent.Executors

class UpdateBridgeModule(
    private val appContext: ReactApplicationContext
) : ReactContextBaseJavaModule(appContext) {

    private val executor = Executors.newSingleThreadExecutor()

    private val updateManager: AppUpdateManager by lazy {
        AppUpdateManager(appContext) { payload ->
            emitProgress(payload.toString())
        }
    }

    override fun getName(): String = UpdateConstants.MODULE_NAME

    override fun invalidate() {
        executor.shutdownNow()
        super.invalidate()
    }

    @ReactMethod
    fun checkForUpdates(baseUrl: String?, promise: Promise) {
        executor.execute {
            runCatching {
                updateManager.checkForUpdates(baseUrl).toString()
            }.onSuccess { payload ->
                promise.resolve(payload)
            }.onFailure { error ->
                promise.reject("update_check_failed", error)
            }
        }
    }

    @ReactMethod
    fun getCachedUpdateSnapshot(promise: Promise) {
        executor.execute {
            runCatching {
                updateManager.getCachedSnapshot().toString()
            }.onSuccess { payload ->
                promise.resolve(payload)
            }.onFailure { error ->
                promise.reject("cached_update_snapshot_failed", error)
            }
        }
    }

    @ReactMethod
    fun getRemoteConfig(promise: Promise) {
        executor.execute {
            runCatching {
                updateManager.getRemoteConfigJson()
            }.onSuccess { payload ->
                promise.resolve(payload)
            }.onFailure { error ->
                promise.reject("remote_config_read_failed", error)
            }
        }
    }

    @ReactMethod
    fun startOtaUpdate(promise: Promise) {
        executor.execute {
            runCatching {
                updateManager.startOtaUpdate().toString()
            }.onSuccess { payload ->
                promise.resolve(payload)
            }.onFailure { error ->
                promise.reject("ota_update_failed", error)
            }
        }
    }

    @ReactMethod
    fun startNativeUpdate(promise: Promise) {
        executor.execute {
            runCatching {
                updateManager.startNativeUpdate().toString()
            }.onSuccess { payload ->
                promise.resolve(payload)
            }.onFailure { error ->
                promise.reject("native_update_failed", error)
            }
        }
    }

    @ReactMethod
    fun installDownloadedNativeUpdate(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            runCatching {
                updateManager.installDownloadedNativeUpdate()
            }.onSuccess { launched ->
                promise.resolve(launched)
            }.onFailure { error ->
                promise.reject("native_installer_launch_failed", error)
            }
        }
    }

    @ReactMethod
    fun canInstallUnknownApps(promise: Promise) {
        runCatching {
            promise.resolve(updateManager.canRequestPackageInstalls())
        }.onFailure { error ->
            promise.reject("unknown_apps_permission_read_failed", error)
        }
    }

    @ReactMethod
    fun openUnknownAppSourcesSettings(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            runCatching {
                updateManager.openUnknownAppSourcesSettings()
            }.onSuccess { opened ->
                promise.resolve(opened)
            }.onFailure { error ->
                promise.reject("unknown_apps_settings_failed", error)
            }
        }
    }

    @ReactMethod
    fun confirmCurrentBundleReady() {
        AppUpdateStore.confirmActiveBundle(appContext)
    }

    @ReactMethod
    fun restartApp() {
        AppRestartHelper.restart(appContext)
    }

    private fun emitProgress(payload: String) {
        if (!appContext.hasActiveReactInstance()) {
            return
        }
        runCatching {
            appContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(UpdateConstants.EVENT_PROGRESS, payload)
        }
    }
}
