// Proxy MCP para Browser-Tools
const http = require('http');
const readline = require('readline');

// Configuração
const API_PORT = 3025; // Porta do browser-tools-server
const TOOL_NAMES = [
  'getConsoleLogs',
  'getConsoleErrors',
  'getNetworkLogs',
  'getNetworkErrorLogs',
  'takeScreenshot',
  'getSelectedElement',
  'wipeLogs'
];

// Definir as ferramentas
const tools = {};
TOOL_NAMES.forEach(name => {
  tools[name] = {
    description: `BrowserTools: ${name}`,
    parameters: {
      type: "object",
      properties: {
        random_string: {
          type: "string",
          description: "String aleatória para evitar caching"
        }
      }
    }
  };
});

// Configurar interface de leitura da entrada padrão
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Função para fazer requisições HTTP ao browser-tools-server
async function callBrowserToolsAPI(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: API_PORT,
      path: `/${endpoint}`,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve(responseData);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Handler para processar as requisições MCP
async function handleMCPRequest(request) {
  const { jsonrpc, id, method, params } = request;
  
  // Verificar versão do protocolo
  if (jsonrpc !== "2.0") {
    return { jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid Request" } };
  }
  
  // Listar ferramentas
  if (method === "tools.list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools
      }
    };
  }
  
  // Executar ferramenta
  if (method === "tools.call") {
    const { name, parameters } = params;
    
    if (!TOOL_NAMES.includes(name)) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Method not found: ${name}`
        }
      };
    }
    
    try {
      let result;
      
      // Mapear ferramentas para endpoints
      switch (name) {
        case "getConsoleLogs":
          result = await callBrowserToolsAPI('getConsoleLogs');
          break;
        case "getConsoleErrors":
          result = await callBrowserToolsAPI('getConsoleErrors');
          break;
        case "getNetworkLogs":
          result = await callBrowserToolsAPI('getNetworkLogs');
          break;
        case "getNetworkErrorLogs":
          result = await callBrowserToolsAPI('getNetworkErrorLogs');
          break;
        case "takeScreenshot":
          result = await callBrowserToolsAPI('takeScreenshot');
          break;
        case "getSelectedElement":
          result = await callBrowserToolsAPI('getSelectedElement');
          break;
        case "wipeLogs":
          result = await callBrowserToolsAPI('wipelogs', 'POST');
          break;
      }
      
      return {
        jsonrpc: "2.0",
        id,
        result: {
          output: result || { message: "Não foi possível obter resultado", tool: name }
        }
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32000,
          message: `Error: ${error.message}`
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

// Processar entrada do stdin
let buffer = '';
rl.on('line', async (line) => {
  try {
    // Ignorar linhas vazias
    if (!line.trim()) return;
    
    // Analisar a solicitação JSON-RPC
    const request = JSON.parse(line);
    
    // Processar a solicitação
    const response = await handleMCPRequest(request);
    
    // Enviar a resposta
    console.log(JSON.stringify(response));
  } catch (error) {
    // Erro ao analisar JSON
    const errorResponse = {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: `Parse error: ${error.message}`
      }
    };
    console.log(JSON.stringify(errorResponse));
  }
});

// Mensagem de inicialização (não enviar para stdout, pois interfere com o protocolo)
process.stderr.write("MCP Proxy iniciado para browser-tools-server\n");
process.stderr.write(`Conectando com o servidor na porta ${API_PORT}\n`); 