@echo off
setlocal
cd /d "C:\Users\MyBook Hype AMD\AndroidStudioProjects\Edufika2"
echo Setting adb reverse for Metro + backend...
adb devices
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8088 tcp:8088
echo.
echo [DONE] adb reverse configured.
adb reverse --list
pause
endlocal
