@echo off
setlocal EnableDelayedExpansion

REM Definir o PATH corretamente
SET PATH=C:\Program Files\nodejs;C:\Users\Cliente2\AppData\Roaming\npm;%PATH%

REM Iniciar o servidor em segundo plano
start /b "" cmd /c "C:\Users\Cliente2\AppData\Roaming\npm\browser-tools-server.cmd --port 3025 > nul 2>&1"

REM Esperar um pouco para o servidor iniciar
timeout /t 2 > nul

REM Responder com o protocolo MCP no formato que o Cursor espera
echo {"jsonrpc":"2.0","result":{"tools":{"getConsoleLogs":{"description":"Obtém logs do console do navegador","parameters":{"type":"object","properties":{"random_string":{"type":"string","description":"Uma string aleatória para evitar caching"}}}},"getConsoleErrors":{"description":"Obtém erros do console do navegador","parameters":{"type":"object","properties":{"random_string":{"type":"string","description":"Uma string aleatória para evitar caching"}}}},"getNetworkLogs":{"description":"Obtém logs de rede do navegador","parameters":{"type":"object","properties":{"random_string":{"type":"string","description":"Uma string aleatória para evitar caching"}}}},"getNetworkErrorLogs":{"description":"Obtém logs de erro de rede do navegador","parameters":{"type":"object","properties":{"random_string":{"type":"string","description":"Uma string aleatória para evitar caching"}}}},"takeScreenshot":{"description":"Captura screenshot da página atual","parameters":{"type":"object","properties":{"random_string":{"type":"string","description":"Uma string aleatória para evitar caching"}}}},"getSelectedElement":{"description":"Obtém informações sobre o elemento selecionado","parameters":{"type":"object","properties":{"random_string":{"type":"string","description":"Uma string aleatória para evitar caching"}}}},"wipeLogs":{"description":"Limpa todos os logs armazenados","parameters":{"type":"object","properties":{"random_string":{"type":"string","description":"Uma string aleatória para evitar caching"}}}}}},"id":1}

REM Manter o script em execução para evitar que o Cursor feche a conexão
:loop
timeout /t 5 > nul
goto loop 