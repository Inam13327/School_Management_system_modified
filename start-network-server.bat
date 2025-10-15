@echo off
echo Starting IPS Management System for network access...

REM Get the computer's IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set IP=%%a
    goto :found_ip
)
:found_ip
set IP=%IP:~1%

echo Your computer's IP address is: %IP%
echo.

REM Set environment variables for React
set HOST=0.0.0.0
set DANGEROUSLY_DISABLE_HOST_CHECK=true
set REACT_APP_SERVER_IP=%IP%

echo Starting Backend Server...
start cmd /k "cd Backend && python manage.py runserver 0.0.0.0:8000"

echo Waiting for backend to initialize...
timeout /t 5 /nobreak > nul

echo Starting Frontend Server...
start cmd /k "npm run start-network"

echo.
echo ======================================================
echo IPS Management System is now running on your network!
echo.
echo Backend server: http://%IP%:8000
echo Frontend server: http://%IP%:3000
echo.
echo Access these URLs from any device on your network
echo ======================================================
echo.
echo Press any key to stop all servers...
pause > nul

echo Stopping servers...
taskkill /f /im node.exe > nul 2>&1
taskkill /f /im python.exe > nul 2>&1
echo Servers stopped.