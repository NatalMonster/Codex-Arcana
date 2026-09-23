@echo off
echo =========================================
echo Iniciando Creador de Personajes D^&D 2024
echo (Servidor Unificado: Express + Vite)
echo =========================================

echo.
echo Iniciando servidor en el puerto 3000...
start "Servidor D&D" cmd /k "npm run server"

echo.
echo El servidor esta arrancando. Revisa la nueva ventana de comandos.
echo.
echo Ve a tu navegador e ingresa: http://localhost:3000
echo.
pause
