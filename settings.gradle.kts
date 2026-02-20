import com.facebook.react.ReactSettingsExtension

pluginManagement {
    includeBuild("react-native/node_modules/@react-native/gradle-plugin")
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("com.facebook.react.settings")
}

extensions.configure<ReactSettingsExtension> {
    autolinkLibrariesFromCommand(
        workingDirectory = file("react-native"),
        lockFiles = layout.rootDirectory.files(
            "react-native/package-lock.json",
            "react-native/package.json",
            "react-native/react-native.config.js"
        )
    )
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_PROJECT)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "Edufika"
include(":app")
 
