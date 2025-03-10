// Servidor MCP simples para browser-tools
const http = require('http');
const fs = require('fs');
const path = require('path');

// Porta para o servidor
const PORT = 3025;

// Diretório para salvar screenshots
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

// Criar servidor HTTP
const server = http.createServer((req, res) => {
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
                    } else if (payload.data.type.startsWith('network')) {
                        logs.network.push(payload.data);
                    } else if (payload.data.type === 'selected-element') {
                        logs.elements.push(payload.data);
                    }
                }
                
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true }));
            } 
            else if (req.url === '/getConsoleLogs') {
                // Retornar logs do console
                res.statusCode = 200;
                res.end(JSON.stringify(logs.console.slice(-50)));
            } 
            else if (req.url === '/getConsoleErrors') {
                // Retornar erros do console
                const errors = logs.console.filter(log => log.type === 'console-error');
                res.statusCode = 200;
                res.end(JSON.stringify(errors.slice(-50)));
            } 
            else if (req.url === '/getNetworkLogs') {
                // Retornar logs de rede
                res.statusCode = 200;
                res.end(JSON.stringify(logs.network.slice(-50)));
            } 
            else if (req.url === '/getSelectedElement') {
                // Retornar elemento selecionado
                const selectedElement = logs.elements.length > 0 ? logs.elements[logs.elements.length - 1] : null;
                res.statusCode = 200;
                res.end(JSON.stringify(selectedElement));
            } 
            else if (req.url === '/wipelogs' && req.method === 'POST') {
                // Limpar todos os logs
                logs.console = [];
                logs.network = [];
                logs.elements = [];
                
                res.statusCode = 200;
                res.end(JSON.stringify({ message: 'Logs wiped successfully' }));
            } 
            else {
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

// Iniciar o servidor
server.listen(PORT, () => {
    console.log(`Servidor MCP Browser Tools rodando em http://localhost:${PORT}`);
    console.log('Pressione Ctrl+C para encerrar');
});

// Lidar com o encerramento do servidor
process.on('SIGINT', () => {
    console.log('Servidor encerrado');
    process.exit(0);
}); 