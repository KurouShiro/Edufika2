@echo off
setlocal
set "PROJECT_DIR=C:\Users\MyBook Hype AMD\AndroidStudioProjects\Edufika2"
set "INSTALL_CMD=cd /d \"%PROJECT_DIR%\" && call .\gradlew.bat :app:installDebug"
set "METRO_CMD=cd /d \"%PROJECT_DIR%\" && call npm --prefix react-native run start"
set "ADB_CMD=cd /d \"%PROJECT_DIR%\" && adb devices && adb reverse tcp:8081 tcp:8081 && adb reverse tcp:8088 tcp:8088 && adb reverse --list"

where wt >nul 2>nul
if not errorlevel 1 (
  wt -w 0 ^
    new-tab cmd /k "%INSTALL_CMD%" ; ^
    new-tab cmd /k "%METRO_CMD%" ; ^
    new-tab cmd /k "%ADB_CMD%"
) else (
  start "InstallDebug" cmd /k "%INSTALL_CMD%"
  start "Metro" cmd /k "%METRO_CMD%"
  start "ADB Reverse" cmd /k "%ADB_CMD%"
)
endlocal
