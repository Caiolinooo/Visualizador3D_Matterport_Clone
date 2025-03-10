// Proxy MCP simples para browser-tools
const readline = require('readline');

// Configurar leitura do stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Definição das ferramentas
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
    description: "Obtém logs de rede do navegador",
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
  takeScreenshot: {
    description: "Captura screenshot da página atual",
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
    description: "Obtém informações sobre o elemento selecionado",
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

// Processar linhas do stdin
rl.on('line', (line) => {
  try {
    // Ignorar linhas vazias
    if (!line.trim()) return;
    
    // Analisar o JSON recebido
    const request = JSON.parse(line);
    const { id, method, params } = request;
    
    // Responder de acordo com o método
    if (method === 'tools.list') {
      // Listar ferramentas disponíveis
      const response = {
        jsonrpc: "2.0",
        id,
        result: {
          tools
        }
      };
      console.log(JSON.stringify(response));
    } 
    else if (method === 'tools.call') {
      // Responder com uma mensagem de simulação
      const { name } = params;
      const response = {
        jsonrpc: "2.0",
        id,
        result: {
          output: {
            message: `Simulação da ferramenta ${name}. O servidor browser-tools está rodando na porta 3025. Abra o navegador e interaja com a extensão para capturar dados.`
          }
        }
      };
      console.log(JSON.stringify(response));
    }
    else {
      // Método desconhecido
      const response = {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Método desconhecido: ${method}`
        }
      };
      console.log(JSON.stringify(response));
    }
  } catch (error) {
    // Erro ao processar a requisição
    const errorResponse = {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: `Erro de análise: ${error.message}`
      }
    };
    console.log(JSON.stringify(errorResponse));
  }
});

// Escrever no stderr não interfere com a comunicação MCP
process.stderr.write('MCP Bridge iniciado. Aguardando requisições...\n'); 