import java.io.File
import java.util.Properties
import org.gradle.api.GradleException
import org.gradle.api.tasks.Copy

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    id("com.facebook.react")
}

react {
    root.set(file("../react-native"))
    reactNativeDir.set(file("../react-native/node_modules/react-native"))
    codegenDir.set(file("../react-native/node_modules/@react-native/codegen"))
    cliFile.set(file("../react-native/node_modules/react-native/cli.js"))
    entryFile.set(file("../react-native/index.js"))
    debuggableVariants.set(listOf())
    autolinkLibrariesWithApp()
}

val ndkVersionValue = "29.0.14206865"
val appVersionCode = (findProperty("APP_VERSION_CODE") as String?)?.toIntOrNull() ?: 2
val appVersionName = (findProperty("APP_VERSION_NAME") as String?)?.trim()?.takeIf { it.isNotEmpty() } ?: "1.0.1"
val signingPropertiesFile = listOf(
    rootProject.file("keystore.properties"),
    rootProject.file("keystone.properties")
).firstOrNull { it.exists() }
val signingProperties = Properties()
if (signingPropertiesFile != null) {
    signingPropertiesFile.inputStream().use { signingProperties.load(it) }
}
val hasReleaseSigning = listOf("storeFile", "storePassword", "keyAlias", "keyPassword").all { key ->
    !signingProperties.getProperty(key).isNullOrBlank()
}
val releaseTaskRequested = gradle.startParameter.taskNames.any { taskName ->
    taskName.contains("Release", ignoreCase = true)
}
if (releaseTaskRequested && !hasReleaseSigning) {
    throw GradleException(
        "Release signing is not configured. Define storeFile/storePassword/keyAlias/keyPassword " +
            "in keystore.properties (or keystone.properties) at repo root."
    )
}

val generatedLibcxxDir = layout.buildDirectory.dir("generated/libcxx")
val abiToNdkTriplesAll = mapOf(
    "arm64-v8a" to "aarch64-linux-android",
    "armeabi-v7a" to "arm-linux-androideabi",
    "x86" to "i686-linux-android",
    "x86_64" to "x86_64-linux-android"
)
val configuredReactNativeArchitectures = (findProperty("reactNativeArchitectures") as String?)
    ?.split(",")
    ?.map { it.trim() }
    ?.filter { it.isNotEmpty() }
    ?.toSet()
    ?: setOf("armeabi-v7a", "arm64-v8a", "x86", "x86_64")
val abiToNdkTriples = abiToNdkTriplesAll.filterKeys { configuredReactNativeArchitectures.contains(it) }

val copyNdkLibcxx by tasks.registering(Copy::class) {
    val sdkRoot = File(System.getenv("LOCALAPPDATA"), "Android/Sdk")
    val ndkLibRoot = File(
        sdkRoot,
        "ndk/$ndkVersionValue/toolchains/llvm/prebuilt/windows-x86_64/sysroot/usr/lib"
    )
    into(generatedLibcxxDir)
    doFirst {
        abiToNdkTriples.forEach { (abi, triple) ->
            val source = File(ndkLibRoot, "$triple/libc++_shared.so")
            if (!source.exists()) {
                throw GradleException("Missing libc++_shared.so for ABI $abi at ${source.absolutePath}")
            }
        }
    }
    abiToNdkTriples.forEach { (abi, triple) ->
        from(File(ndkLibRoot, "$triple/libc++_shared.so")) {
            into(abi)
        }
    }
}

android {
    namespace = "com.techivibes.edufika"
    compileSdk = 36

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = rootProject.file(signingProperties.getProperty("storeFile"))
                storePassword = signingProperties.getProperty("storePassword")
                keyAlias = signingProperties.getProperty("keyAlias")
                keyPassword = signingProperties.getProperty("keyPassword")
            }
        }
    }

    defaultConfig {
        applicationId = "com.techivibes.edufika"
        // CameraX scanner supports Android 9+.
        minSdk = 28
        targetSdk = 36
        versionCode = appVersionCode
        versionName = appVersionName
        ndk {
            abiFilters += configuredReactNativeArchitectures
        }

        testInstrumentationRunner = "com.techivibes.edufika.runners.CustomTestRunner"
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            isMinifyEnabled = false
            isShrinkResources = false
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            buildConfigField("boolean", "DEV_TOOLS_ENABLED", "true")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            manifestPlaceholders["usesCleartextTraffic"] = "false"
            buildConfigField("boolean", "DEV_TOOLS_ENABLED", "false")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
        viewBinding = true
    }
    sourceSets {
        getByName("main") {
            jniLibs.srcDir(generatedLibcxxDir)
        }
    }
    splits {
        abi {
            // Build a single installable APK to avoid split-install parse failures on tester devices.
            isEnable = false
        }
    }
    packaging {
        jniLibs {
            pickFirsts += "**/libc++_shared.so"
        }
    }
}

tasks.named("preBuild").configure {
    dependsOn(copyNdkLibcxx)
}

val verifyReleaseJsBundle by tasks.registering {
    group = "verification"
    description = "Ensures the embedded React Native release bundle exists for non-Metro startup."

    val releaseBundle = layout.buildDirectory.file("generated/assets/react/release/index.android.bundle")
    dependsOn("createBundleReleaseJsAndAssets")

    doLast {
        val bundleFile = releaseBundle.get().asFile
        if (!bundleFile.exists() || bundleFile.length() <= 0L) {
            throw GradleException(
                "Missing React Native release bundle at ${bundleFile.absolutePath}. " +
                    "Release builds must embed index.android.bundle for offline startup."
            )
        }
        logger.lifecycle(
            "Verified embedded RN release bundle: ${bundleFile.absolutePath} (${bundleFile.length()} bytes)"
        )
    }
}

tasks.matching { it.name == "assembleRelease" || it.name == "bundleRelease" }.configureEach {
    dependsOn(verifyReleaseJsBundle)
}

val assembleTesterRelease by tasks.registering {
    group = "build"
    description = "Builds release APK and verifies the installer artifact used for broad tester installs."
    dependsOn("assembleRelease")
    doLast {
        val outputDir = layout.buildDirectory.dir("outputs/apk/release").get().asFile
        val releaseApk = outputDir
            .listFiles()
            ?.firstOrNull { file ->
                file.isFile &&
                    file.extension == "apk" &&
                    (
                        file.name.equals("app-release.apk", ignoreCase = true) ||
                            file.name.contains("universal", ignoreCase = true)
                    )
            }
        if (releaseApk == null) {
            throw GradleException(
                "Release APK not found in ${outputDir.absolutePath}. " +
                    "Use the assembled release APK for tester distribution."
            )
        }
        logger.lifecycle("Use this tester APK for distribution: ${releaseApk.absolutePath}")
    }
}

dependencies {
    implementation("com.facebook.react:react-android")
    val hermesEnabled = (findProperty("hermesEnabled")?.toString()?.toBooleanStrictOrNull()) ?: true
    if (hermesEnabled) {
        implementation("com.facebook.react:hermes-android")
    } else {
        implementation("org.webkit:android-jsc:+")
    }

    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("com.google.android.material:material:1.13.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.1")
    implementation("androidx.fragment:fragment-ktx:1.8.9")
    implementation("androidx.navigation:navigation-fragment-ktx:2.9.0")
    implementation("androidx.navigation:navigation-ui-ktx:2.9.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.10.0")
    implementation("androidx.lifecycle:lifecycle-livedata-ktx:2.10.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("androidx.media3:media3-exoplayer:1.5.1")
    implementation("androidx.webkit:webkit:1.13.0")
    implementation("androidx.camera:camera-core:1.4.2")
    implementation("androidx.camera:camera-camera2:1.4.2")
    implementation("androidx.camera:camera-lifecycle:1.4.2")
    implementation("androidx.camera:camera-view:1.4.2")
    implementation("com.google.mlkit:barcode-scanning:17.3.0")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    implementation("io.github.webrtc-sdk:android:137.7151.05")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
}
