@echo off
REM KAYTOM Windows .exe derleme (Node.js 20+ gerekli: https://nodejs.org)
if not exist .env copy .env.example .env & echo .env olusturuldu. Supabase anahtarlarini yazip tekrar calistirin. & notepad .env & exit /b
call npm install || exit /b 1
call npm run electron:build || exit /b 1
echo.
echo HAZIR: release\KAYTOM-Setup-0.1.0.exe
explorer release
