@echo off
setlocal
cd /d "C:\Users\MyBook Hype AMD\AndroidStudioProjects\Edufika2"
call .\gradlew.bat :app:installDebug
echo.
echo [DONE] :app:installDebug finished.
pause
endlocal
