@echo off
echo ========================================
echo  EXPERTISE - Reiniciando Backend
echo ========================================

:: Matar processos node existentes
echo [1/3] Parando processos Node.js antigos...
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak >nul

:: Navegar para o diretorio do backend
echo [2/3] Iniciando backend...
cd /d "%~dp0"

:: Iniciar o backend
echo [3/3] Backend inicializando em http://localhost:3001
echo.
echo ========================================
echo  Aguarde a mensagem: EXPERTISE LICITATORIA OPERANTE
echo ========================================
echo.
call npm run dev
