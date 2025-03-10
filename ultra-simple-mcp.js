// Solução ultra-simples para o MCP
process.stdin.on('data', (data) => {
  try {
    const input = data.toString().trim();
    if (!input) return;
    
    const request = JSON.parse(input);
    const id = request.id || 1;
    
    if (request.method === 'tools.list') {
      // Responde apenas com uma ferramenta
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id,
        result: {
          tools: {
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
            }
          }
        }
      }) + '\n');
    }
    else if (request.method === 'tools.call') {
      // Responde para qualquer chamada de ferramenta
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id,
        result: {
          output: {
            message: "O browser-tools-server está rodando, use a extensão Chrome para capturar dados."
          }
        }
      }) + '\n');
    }
  } catch (e) {
    // Em caso de erro, envia uma resposta de erro
    process.stdout.write(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: "Erro de análise"
      }
    }) + '\n');
  }
}); 