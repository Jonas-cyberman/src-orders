@echo off
echo ========================================================
echo    SRC PULSE: Local Vercel Environment Startup
echo ========================================================
echo.
echo Launching local development server with full API support...
echo.
echo NOTE: If this is your first time running this, Vercel CLI 
echo will ask you to quickly link this folder to your Vercel 
echo project. This allows it to securely download your Paystack 
echo and Supabase environment variables so the API actually works.
echo.
echo Please wait, starting server at http://localhost:3000...
echo.

npx vercel dev

echo.
pause
