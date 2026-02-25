// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    id("com.facebook.react.rootproject")
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
}

val supportedAndroidAbis = listOf("arm64-v8a", "armeabi-v7a", "x86_64", "x86", "riscv64")
val rawReactNativeArchitectures = providers.gradleProperty("reactNativeArchitectures").orNull
val sanitizedReactNativeArchitectures = rawReactNativeArchitectures
    ?.trim()
    ?.let { raw ->
        supportedAndroidAbis
            .asSequence()
            .flatMap { abi ->
                Regex(Regex.escape(abi)).findAll(raw).map { abi }
            }
            .distinct()
            .joinToString(",")
            .takeIf { it.isNotBlank() }
    }

if (!sanitizedReactNativeArchitectures.isNullOrBlank()) {
    if (rawReactNativeArchitectures?.trim() != sanitizedReactNativeArchitectures) {
        logger.warn(
            "Sanitized reactNativeArchitectures from " +
                "\"${rawReactNativeArchitectures?.trim()}\" to \"$sanitizedReactNativeArchitectures\"."
        )
    }
    extra["reactNativeArchitectures"] = sanitizedReactNativeArchitectures
    allprojects {
        extensions.extraProperties["reactNativeArchitectures"] = sanitizedReactNativeArchitectures
    }
}

extra["minSdkVersion"] = 29
extra["targetSdkVersion"] = 36
extra["compileSdkVersion"] = 36
extra["kotlinVersion"] = "2.0.21"
extra["ndkVersion"] = "29.0.14206865"
