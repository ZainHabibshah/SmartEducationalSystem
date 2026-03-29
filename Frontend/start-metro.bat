@echo off
echo ========================================
echo Starting Metro Bundler with Correct IP
echo ========================================
echo.

echo Getting your IP address...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    set IP=!IP:~1!
    goto :found
)
:found

echo.
echo ========================================
echo Your Computer IP: %IP%
echo ========================================
echo.
echo IMPORTANT: Use this URL in Expo Go:
echo   exp://%IP%:8081
echo.
echo Steps:
echo   1. Open Expo Go app
echo   2. Tap "Enter URL manually"
echo   3. Enter: exp://%IP%:8081
echo   4. Tap "Connect"
echo.
echo ========================================
echo Starting Metro bundler...
echo ========================================
echo.

npx expo start --lan --clear

pause
