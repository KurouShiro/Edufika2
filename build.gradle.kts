// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    id("com.facebook.react.rootproject")
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
}

extra["minSdkVersion"] = 29
extra["targetSdkVersion"] = 36
extra["compileSdkVersion"] = 36
extra["kotlinVersion"] = "2.0.21"
extra["ndkVersion"] = "29.0.14206865"
