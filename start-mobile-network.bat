@echo off
echo Starting IPS Management System for Mobile Access...

REM Get the computer's IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set IP_ADDRESS=%%a
    goto :found_ip
)
:found_ip
set IP_ADDRESS=%IP_ADDRESS:~1%
echo Your computer's IP address is: %IP_ADDRESS%

REM Set environment variables for React
set REACT_APP_MOBILE=true
set REACT_APP_SERVER_IP=%IP_ADDRESS%
set HOST=0.0.0.0
set DANGEROUSLY_DISABLE_HOST_CHECK=true

REM Start the backend server
cd Backend
start cmd /k "python manage.py runserver 0.0.0.0:8000"
cd ..

REM Wait for backend to start
timeout /t 5

REM Start the frontend server
npm run start-lan

echo.
echo Mobile access is now available at:
echo Frontend: http://%IP_ADDRESS%:3000
echo Backend API: http://%IP_ADDRESS%:8000/api
echo.
echo Use these URLs in your mobile app configuration.