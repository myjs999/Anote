#2026-4-17 12:53:52
echo this is created by Notes.
@echo off
cd /d "%~dp0"
start "" /B cmd /c "npm run dev"
