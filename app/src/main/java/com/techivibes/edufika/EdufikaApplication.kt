package com.techivibes.edufika

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import com.techivibes.edufika.data.SessionStateStore
import com.techivibes.edufika.rn.SecurityBridgePackage

class EdufikaApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages() = PackageList(this).packages.apply {
                add(SecurityBridgePackage())
            }

            override fun getJSMainModuleName(): String = "index"

            // Use embedded bundle when available, fallback to Metro in debug if bundle is missing.
            override fun getUseDeveloperSupport(): Boolean {
                val hasEmbeddedBundle = runCatching {
                    assets.open("index.android.bundle").use { }
                    true
                }.getOrDefault(false)
                return BuildConfig.DEBUG && !hasEmbeddedBundle
            }

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED

            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }

    override val reactHost: ReactHost
        get() = DefaultReactHost.getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        SessionStateStore.bind(this)
        SoLoader.init(this, OpenSourceMergedSoMapping)
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            DefaultNewArchitectureEntryPoint.load()
        }
    }
}
