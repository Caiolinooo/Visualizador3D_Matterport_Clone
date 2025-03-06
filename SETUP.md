# Guia de Instalação e Configuração

Este documento explica passo a passo como configurar e executar o Visualizador 3D estilo Matterport.

## Requisitos de Sistema

- **Node.js**: versão 16.x ou superior
- **Python**: versão 3.8 ou superior (para processamento de dados)
- **NPM** ou **Yarn**: para gerenciamento de dependências

## Instalação

1. **Clone o repositório**:
   ```bash
   git clone <url-do-repositorio>
   cd <diretorio-do-projeto>
   ```

2. **Instale as dependências do Node.js**:
   ```bash
   npm install
   # ou se você usa yarn
   yarn install
   ```

3. **Instale as dependências Python para processamento de dados**:
   ```bash
   pip install -r requirements.txt
   ```

## Estrutura de Diretórios

O sistema espera a seguinte estrutura de diretórios:

```
/
├── input_data/             # Dados de entrada
│   ├── scans/              # Arquivos .pts ou .e57 do scanner
│   ├── panorama/           # Imagens panorâmicas 360°
│   └── trueview/           # Dados do FARO TrueView
├── output/                 # Dados processados
│   └── [scene_name]/       # Uma pasta por cena
├── public/                 # Arquivos estáticos
└── src/                    # Código fonte React
```

Se estas pastas não existirem, o sistema as criará automaticamente na primeira execução.

## Configuração

O sistema vem pré-configurado para funcionar com a estrutura de arquivos acima. Não é necessária configuração adicional para execução básica.

## Processamento de Dados

Para processar arquivos PTS do scanner FARO:

1. **Coloque os arquivos PTS na pasta input_data/scans/**
2. **Execute o script de processamento**:
   ```bash
   python process.py
   ```

Este processo irá:
- Gerar nuvens de pontos otimizadas (.ply)
- Criar malhas 3D para visualização
- Gerar plantas baixas em 2D
- Extrair coordenadas centrais
- Criar arquivos de saída na pasta output/[scene_name]

## Executando a Aplicação

A aplicação consiste em duas partes: um servidor backend e um cliente frontend.

### Iniciando o Servidor Backend

```bash
npm start
# ou
node server.js
```

Isso iniciará o servidor Express na porta 3000 por padrão.

### Iniciando o Frontend React (Opcional)

```bash
npm run dev
```

Isso iniciará o servidor de desenvolvimento Vite na porta 5173.

## Acessando a Aplicação

Existem duas maneiras de acessar a aplicação:

- **Versão JavaScript puro**: http://localhost:3000/
- **Versão React**: http://localhost:5173/

## Uso com o FARO TrueView

Os dados do FARO TrueView contêm metadados com as coordenadas exatas dos pontos de escaneamento, permitindo navegação precisa entre cenas. 

Para usar com o TrueView:

1. Coloque todas as pastas exportadas do TrueView (contendo CubeMapMeta.xml) na pasta input_data/trueview/
2. Inicie o servidor - ele detectará automaticamente as posições e imagens

## Resolução de Problemas

### Erro "Module not found"
- Certifique-se de ter instalado todas as dependências com `npm install`

### Erro "Cannot find module 'open3d'"
- Instale as dependências Python com `pip install -r requirements.txt`

### Imagens panorâmicas não carregam
- Verifique se as imagens estão nos formatos suportados (jpg, jpeg, png)
- Verifique se os nomes das imagens correspondem aos nomes das cenas (ex: Scan_001.jpg para cena Scan_001)

### Erro na renderização 3D
- Verifique se seu navegador suporta WebGL
- Tente atualizar os drivers da placa gráfica

## Scripts Disponíveis

- **npm start**: Inicia o servidor backend
- **npm run dev**: Inicia o servidor de desenvolvimento Vite para React
- **npm run build**: Compila o frontend React para produção

## Tecnologias Utilizadas

- **Backend**: Node.js, Express
- **Frontend**: React, Three.js, React Three Fiber
- **Processamento de Dados**: Python, Open3D
- **Visualização 3D**: Three.js, WebGL