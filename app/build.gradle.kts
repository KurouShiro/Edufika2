import java.io.File
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
val generatedLibcxxDir = layout.buildDirectory.dir("generated/libcxx")
val abiToNdkTriples = mapOf(
    "arm64-v8a" to "aarch64-linux-android",
    "armeabi-v7a" to "arm-linux-androideabi",
    "x86" to "i686-linux-android",
    "x86_64" to "x86_64-linux-android"
)

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

    defaultConfig {
        applicationId = "com.techivibes.edufika"
        minSdk = 29
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "com.techivibes.edufika.runners.CustomTestRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
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
        viewBinding = true
    }
    sourceSets {
        getByName("main") {
            jniLibs.srcDir(generatedLibcxxDir)
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
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    implementation("io.github.webrtc-sdk:android:137.7151.05")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
}
