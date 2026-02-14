@echo off
echo Starting Auto-Deploy...
set /p msg="Enter commit message (optional, press Enter for default): "
if "%msg%"=="" (
    node scripts/auto_deploy.js
) else (
    node scripts/auto_deploy.js "%msg%"
)
pause
