@echo off
setlocal
cd /d "C:\Users\MyBook Hype AMD\AndroidStudioProjects\Edufika2"

echo [1/5] Starting adb server...
adb start-server

echo.
echo [2/5] Checking USB devices...
adb devices

echo.
echo [3/5] Configuring USB reverse ports (Metro + Backend)...
adb reverse --remove-all
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8088 tcp:8088
adb reverse --list

echo.
echo [4/5] Installing debug APK...
call .\gradlew.bat :app:installDebug

echo.
echo [5/5] Launching Edufika app...
adb shell monkey -p com.techivibes.edufika -c android.intent.category.LAUNCHER 1

echo.
echo [DONE] USB debugging environment is ready.
pause
endlocal
