@echo off
echo Iniciando Browser Tools Server com caminho completo para Node.js...

REM Usar caminhos completos para todos os executáveis
echo Iniciando servidor na porta 3025...

REM Localizar o arquivo JavaScript do módulo browser-tools-server
cd C:\Users\Cliente2\AppData\Roaming\npm\node_modules\@agentdeskai\browser-tools-server
"C:\Program Files\nodejs\node.exe" index.js --port 3025

echo Servidor encerrado.
pause 