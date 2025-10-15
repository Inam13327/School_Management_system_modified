@echo off
echo Starting Django server for LAN access...

REM Get the computer's IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set IP=%%a
    goto :found_ip
)
:found_ip
set IP=%IP:~1%

echo Access the server at http://%IP%:8000
echo Other devices on your network can access at http://%IP%:8000

python manage.py runserver 0.0.0.0:8000