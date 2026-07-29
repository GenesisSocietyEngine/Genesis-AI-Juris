plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.genesissocietyengine.juris_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.genesissocietyengine.juris_mobile"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

val rustProfile = providers.provider {
    if (gradle.startParameter.taskNames.any { it.contains("Release", ignoreCase = true) }) {
        "release"
    } else {
        "debug"
    }
}

val requestedFlutterTargets =
    providers.gradleProperty("target-platform")
        .map { it.split(",").map { target -> target.trim() }.toSet() }
        .orElse(setOf("android-arm64"))

data class RustAndroidTarget(
    val flutterTarget: String,
    val rustTarget: String,
    val abi: String,
    val taskSuffix: String,
)

val rustAndroidTargets = listOf(
    RustAndroidTarget(
        flutterTarget = "android-arm",
        rustTarget = "armv7-linux-androideabi",
        abi = "armeabi-v7a",
        taskSuffix = "Arm",
    ),
    RustAndroidTarget(
        flutterTarget = "android-arm64",
        rustTarget = "aarch64-linux-android",
        abi = "arm64-v8a",
        taskSuffix = "Arm64",
    ),
    RustAndroidTarget(
        flutterTarget = "android-x64",
        rustTarget = "x86_64-linux-android",
        abi = "x86_64",
        taskSuffix = "X64",
    ),
)

val rustBuildTasks = rustAndroidTargets.map { target ->
    tasks.register<Exec>("buildRustMobileBridge${target.taskSuffix}") {
        val scriptExtension =
            if (System.getProperty("os.name").startsWith("Windows")) "ps1" else "sh"
        val script = rootProject.file("../tool/build_rust_android.$scriptExtension")
        onlyIf { requestedFlutterTargets.get().contains(target.flutterTarget) }
        inputs.files(
            rootProject.file("../../../Cargo.toml"),
            rootProject.file("../../../Cargo.lock"),
            rootProject.fileTree("../../../crates/juris-engine/src"),
            rootProject.fileTree("../../../crates/juris-mobile-bridge/src"),
            rootProject.fileTree("../../../crates/juris-mobile-ffi/src"),
        )
        outputs.file(
            project.layout.projectDirectory.file(
                "src/main/jniLibs/${target.abi}/libjuris_mobile_ffi.so",
            ),
        )

        if (scriptExtension == "ps1") {
            commandLine(
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                script.absolutePath,
                "-Target",
                target.rustTarget,
                "-Profile",
                rustProfile.get(),
            )
        } else {
            commandLine(
                "bash",
                script.absolutePath,
                target.rustTarget,
                rustProfile.get(),
            )
        }
    }
}

val buildRustMobileBridge by tasks.registering {
    dependsOn(rustBuildTasks)
}

tasks.named("preBuild").configure {
    dependsOn(buildRustMobileBridge)
}
