@echo off
cd /d "%~dp0"
echo Register preview on http://localhost:8080  (close this window to stop)
start "" http://localhost:8080
python -m http.server 8080
