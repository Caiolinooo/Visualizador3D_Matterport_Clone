#!/usr/bin/env node

// Servidor MCP (Model Context Protocol) para Browser Tools
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configurações
const PORT = 3025;
const screenshotDir = path.join(__dirname, 'screenshots');

// Criar o diretório de screenshots se não existir
if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
}

// Armazenamento de logs
const logs = {
    console: [],
    network: [],
    elements: []
};

// Método para gerar um ID único
function generateId() {
    return Math.random().toString(36).substring(2, 11);
}

// Implementar o servidor HTTP para a API do browser-tools
const apiServer = http.createServer((req, res) => {
    let body = '';
    
    // Configurar cabeçalhos CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Lidar com requisições OPTIONS (preflight CORS)
    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }
    
    // Coletar os dados da requisição
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', () => {
        // Definir resposta como JSON
        res.setHeader('Content-Type', 'application/json');
        
        try {
            // Verificar o endpoint
            if (req.url === '/extension-log' && req.method === 'POST') {
                // Processar logs da extensão
                const payload = JSON.parse(body);
                
                if (payload.data) {
                    if (payload.data.type.startsWith('console')) {
                        logs.console.push(payload.data);
                        console.log(`[Console Log] ${payload.data.message || 'No message'}`);
                    } else if (payload.data.type.startsWith('network')) {
                        logs.network.push(payload.data);
                        console.log(`[Network] ${payload.data.url || 'No URL'}`);
                    } else if (payload.data.type === 'selected-element') {
                        logs.elements.push(payload.data);
                        console.log(`[Element] Selected: ${payload.data.tagName || 'Unknown'}`);
                    }
                }
                
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true }));
            } else {
                // Endpoint não encontrado
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Not found' }));
            }
        } catch (error) {
            // Erro interno do servidor
            console.error('Error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Internal server error', details: error.message }));
        }
    });
});

// Iniciar o servidor API
apiServer.listen(PORT, () => {
    console.log(`API Server rodando em http://localhost:${PORT}`);
});

// Implementar o protocolo MCP
// Responsável por comunicar com o Cursor IDE

process.stdin.setEncoding('utf8');

// Registrar as ferramentas MCP
const tools = {
    getConsoleLogs: {
        description: "Obtém logs do console do navegador",
        parameters: {
            type: "object",
            properties: {
                random_string: {
                    type: "string",
                    description: "Uma string aleatória para evitar caching"
                }
            }
        }
    },
    getConsoleErrors: {
        description: "Obtém erros do console do navegador",
        parameters: {
            type: "object",
            properties: {
                random_string: {
                    type: "string",
                    description: "Uma string aleatória para evitar caching"
                }
            }
        }
    },
    getNetworkLogs: {
        description: "Obtém logs de requisições de rede do navegador",
        parameters: {
            type: "object",
            properties: {
                random_string: {
                    type: "string",
                    description: "Uma string aleatória para evitar caching"
                }
            }
        }
    },
    getNetworkErrorLogs: {
        description: "Obtém logs de erro de rede do navegador",
        parameters: {
            type: "object",
            properties: {
                random_string: {
                    type: "string",
                    description: "Uma string aleatória para evitar caching"
                }
            }
        }
    },
    getSelectedElement: {
        description: "Obtém informações sobre o elemento selecionado no navegador",
        parameters: {
            type: "object",
            properties: {
                random_string: {
                    type: "string",
                    description: "Uma string aleatória para evitar caching"
                }
            }
        }
    },
    takeScreenshot: {
        description: "Captura uma screenshot da página atual no navegador",
        parameters: {
            type: "object",
            properties: {
                random_string: {
                    type: "string",
                    description: "Uma string aleatória para evitar caching"
                }
            }
        }
    },
    wipeLogs: {
        description: "Limpa todos os logs armazenados",
        parameters: {
            type: "object",
            properties: {
                random_string: {
                    type: "string",
                    description: "Uma string aleatória para evitar caching"
                }
            }
        }
    }
};

// Manipulador de solicitações MCP
function handleMCPRequest(request) {
    const { jsonrpc, id, method, params } = request;
    
    if (jsonrpc !== "2.0") {
        return { jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid Request" } };
    }
    
    // Método tools.list - Retorna a lista de ferramentas disponíveis
    if (method === "tools.list") {
        return { 
            jsonrpc: "2.0", 
            id, 
            result: { 
                tools 
            } 
        };
    }
    
    // Método tools.call - Executa uma ferramenta específica
    if (method === "tools.call") {
        const { name } = params;
        
        // Verificar se a ferramenta existe
        if (!Object.keys(tools).includes(name)) {
            return { 
                jsonrpc: "2.0", 
                id, 
                error: { 
                    code: -32601, 
                    message: `Method not found: ${name}` 
                } 
            };
        }
        
        // Executar a ferramenta
        try {
            let result;
            
            switch (name) {
                case "getConsoleLogs":
                    result = logs.console.slice(-50);
                    break;
                
                case "getConsoleErrors":
                    result = logs.console.filter(log => log.type === 'console-error').slice(-50);
                    break;
                
                case "getNetworkLogs":
                    result = logs.network.slice(-50);
                    break;
                
                case "getNetworkErrorLogs":
                    result = logs.network.filter(log => log.status >= 400 || log.error).slice(-50);
                    break;
                
                case "getSelectedElement":
                    result = logs.elements.length > 0 ? logs.elements[logs.elements.length - 1] : null;
                    break;
                
                case "takeScreenshot":
                    // Simulação da captura de tela
                    const filename = `screenshot_${Date.now()}.png`;
                    const filepath = path.join(screenshotDir, filename);
                    result = { path: filepath, message: "Screenshot functionality requires browser connection" };
                    break;
                
                case "wipeLogs":
                    logs.console = [];
                    logs.network = [];
                    logs.elements = [];
                    result = { message: "Logs wiped successfully" };
                    break;
                
                default:
                    return { 
                        jsonrpc: "2.0", 
                        id, 
                        error: { 
                            code: -32601, 
                            message: `Method not implemented: ${name}` 
                        } 
                    };
            }
            
            return { 
                jsonrpc: "2.0", 
                id, 
                result: { 
                    output: result
                } 
            };
        } catch (error) {
            return { 
                jsonrpc: "2.0", 
                id, 
                error: { 
                    code: -32000, 
                    message: `Error executing tool ${name}: ${error.message}` 
                } 
            };
        }
    }
    
    // Método não encontrado
    return { 
        jsonrpc: "2.0", 
        id, 
        error: { 
            code: -32601, 
            message: `Method not found: ${method}` 
        } 
    };
}

// Processar entrada do stdin para o protocolo MCP
let buffer = '';

process.stdin.on('data', (chunk) => {
    buffer += chunk;
    
    // Tentar processar linhas completas
    const lines = buffer.split('\n');
    // Manter o último pedaço incompleto no buffer
    buffer = lines.pop();
    
    for (const line of lines) {
        try {
            // Ignorar linhas vazias
            if (!line.trim()) continue;
            
            // Analisar a solicitação JSON-RPC
            const request = JSON.parse(line);
            
            // Processar a solicitação
            const response = handleMCPRequest(request);
            
            // Enviar a resposta
            process.stdout.write(JSON.stringify(response) + '\n');
        } catch (error) {
            // Erro ao analisar JSON
            console.error('Error parsing JSON:', error);
            const errorResponse = {
                jsonrpc: "2.0",
                id: null,
                error: {
                    code: -32700,
                    message: "Parse error"
                }
            };
            process.stdout.write(JSON.stringify(errorResponse) + '\n');
        }
    }
});

// Mensagem de inicialização
console.log(`MCP Server iniciado - ouvindo na porta ${PORT}`);
console.log('Servidor pronto para receber comandos MCP do Cursor IDE');
console.log('Aguardando conexões da extensão do Chrome...');

// Lidar com sinais de encerramento
process.on('SIGINT', () => {
    console.log('Encerrando servidor...');
    apiServer.close(() => {
        console.log('Servidor API encerrado');
        process.exit(0);
    });
}); 