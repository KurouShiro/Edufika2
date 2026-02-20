# Edufika React Native UI

Frontend screen set based on `prompts.txt` with:

- Minimalist terminal aesthetic
- Neon green palette
- JetBrains Mono font family
- Required screen files and flow scaffolding

## Screen Flow

- `SplashScreen` -> `LoginScreen`
- `LoginScreen`:
  - `StudentID` -> `ExamSelectionScreen`
  - `AdminID` -> `AdminDashboardPanel`
  - `EDU_DEV_ACCESS` -> `DeveloperAccessScreen`
- Student exam flow:
  - `ExamSelectionScreen` -> `QRScannerScreen` or `ManualInputScreen`
  - Invalid URL -> `ManualInputFail`
  - Valid URL -> `ExamBrowserScreen`
  - Finish -> `SuccessScreen`
  - Violation simulation -> `ViolationScreen`
- Admin flow:
  - `AdminDashboardPanel` -> `URLWhitelist` / `HistoryScreen` / `DeveloperAccessScreen`

## Font

UI styles target JetBrains Mono family:

- `JetBrainsMono-Regular`
- `JetBrainsMono-Bold`

Font assets are now included under `react-native/assets/fonts`.

Run:

- `npm --prefix react-native run assets:link`

before native build so Android/iOS can register the custom fonts.

## Runtime Mode

RN UI can now be launched from the existing Android app host:

- Build/run Android app (`app` module) from Android Studio or `npm run android:assembleDebug`
- On login screen, tap `Open React Native UI`
- Metro is optional now (debug bundle is packaged into APK). Use Metro only if you want live JS iteration.

The native Kotlin fragment flow still exists, but this button opens the React Native runtime
inside the same app project so the prototype styling/animation is visible on device.
