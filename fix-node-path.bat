@echo off
echo Iniciando Browser Tools Server com PATH corrigido...

REM Definir o PATH explicitamente com o Node.js no início
SET PATH=C:\Program Files\nodejs;C:\Users\Cliente2\AppData\Roaming\npm;%PATH%

REM Verificar que o Node.js está acessível
echo Versão do Node.js:
call node --version

REM Executar o servidor diretamente
echo Iniciando servidor na porta 3025...
call C:\Users\Cliente2\AppData\Roaming\npm\browser-tools-server.cmd --port 3025

echo Servidor encerrado.
pause 