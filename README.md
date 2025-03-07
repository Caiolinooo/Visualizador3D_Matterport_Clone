# Visualizador 3D Estilo Matterport

<p align="center">
  <img src="https://img.shields.io/badge/versão-1.0.0-blue" alt="Versão">
  <img src="https://img.shields.io/badge/licença-MIT-green" alt="Licença">
  <img src="https://img.shields.io/badge/three.js-r159-orange" alt="Three.js">
  <img src="https://img.shields.io/badge/react-18.2.0-61DAFB" alt="React">
</p>

<p align="center">
  <b>Uma solução completa para visualização interativa de dados de escaneamento 3D no estilo Matterport</b>
</p>

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Requisitos](#-requisitos)
- [Instalação](#-instalação)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Uso](#-uso)
- [Processamento de Dados](#-processamento-de-dados)
- [Personalização](#-personalização)
- [Solução de Problemas](#-solução-de-problemas)
- [Contribuição](#-contribuição)
- [Licença](#-licença)

## 🌟 Visão Geral

Este projeto é um visualizador 3D interativo inspirado no Matterport, desenvolvido para trabalhar com dados de escaneamento do FARO Focus. Ele permite a visualização de nuvens de pontos 3D e panorâmicas 360° em um ambiente web imersivo, oferecendo uma experiência de navegação fluida entre diferentes cenas.

O visualizador suporta múltiplos formatos de dados, incluindo arquivos PTS (nuvens de pontos), E57 e panorâmicas do TrueView, tornando-o versátil para diferentes fluxos de trabalho de escaneamento 3D.

## ✨ Funcionalidades

- **Visualização Panorâmica 360°**: Navegue pelo ambiente com imagens de alta qualidade
- **Nuvens de Pontos 3D**: Visualize a geometria real do ambiente escaneado
- **Navegação Entre Cenas**: Explore múltiplos pontos de escaneamento com transições suaves
- **Medição de Distâncias**: Meça distâncias entre pontos no ambiente 3D
- **Vista "Doll House"**: Visualize o modelo de cima, similar ao Matterport
- **Planta Baixa**: Veja a representação 2D do ambiente
- **Anotações/Tags**: Adicione informações em pontos específicos
- **Tour Automático**: Navegue automaticamente entre as cenas
- **Interface Responsiva**: Funciona em desktop e dispositivos móveis
- **Duas Versões**: Implementação em JavaScript puro e versão React

## 🛠 Tecnologias

- **Frontend**:
  - Three.js (r159) - Renderização 3D
  - React (18.2.0) - Interface de usuário
  - React Three Fiber - Integração React com Three.js
  - Vite - Bundler e servidor de desenvolvimento

- **Backend**:
  - Node.js - Ambiente de execução
  - Express - Servidor web
  - Python - Processamento de dados 3D

- **Processamento de Dados**:
  - Open3D - Manipulação de nuvens de pontos
  - NumPy - Processamento numérico
  - XML2JS - Parsing de metadados

## 📋 Requisitos

- Node.js 16.x ou superior
- Python 3.8 ou superior (para processamento de dados)
- Arquivos de escaneamento FARO Focus (PTS, E57 ou TrueView)
- Navegador moderno com suporte a WebGL

## 🚀 Instalação

1. **Clone o repositório**:
   ```bash
   git clone https://github.com/Caiolinooo/Visualizador3D_Matterport_Clone.git
   cd Visualizador3D_Matterport_Clone
   ```

2. **Instale as dependências do Node.js**:
   ```bash
   npm install
   ```

3. **Instale as dependências Python** (opcional, apenas para processamento de dados):
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure os diretórios de dados**:
   ```bash
   mkdir -p input_data/scans input_data/panorama input_data/trueview output
   ```

## 📁 Estrutura do Projeto

```
/
├── api/                    # Endpoints da API
├── lib/                    # Bibliotecas de utilidade
├── public/                 # Arquivos estáticos
│   ├── main.js             # Implementação em JavaScript puro
│   ├── index.html          # Página principal
│   ├── OrbitControls.js    # Controles de câmera
│   └── panorama/           # Imagens panorâmicas processadas
├── src/                    # Código fonte React
│   ├── app.jsx             # Componente principal React
│   ├── main.jsx            # Ponto de entrada React
│   └── styles.css          # Estilos CSS
├── input_data/             # Dados de entrada (não versionado)
├── output/                 # Dados processados (não versionado)
├── process.py              # Script de processamento Python
├── server.js               # Servidor Express
├── vite.config.js          # Configuração do Vite
├── package.json            # Dependências e scripts
└── README.md               # Documentação
```

## 🖥 Uso

### Executando o Servidor Backend

```bash
npm start
```

Isso iniciará o servidor Express na porta 3000 por padrão.

### Executando o Frontend React

```bash
npm run dev
```

Isso iniciará o servidor de desenvolvimento Vite na porta 5173.

### Acesso às Interfaces

- **Versão JavaScript puro**: http://localhost:3000/
- **Versão React**: http://localhost:5173/

## 🔄 Processamento de Dados

Para processar arquivos PTS e gerar nuvens de pontos otimizadas:

```bash
python process.py [diretório_de_entrada]
```

Se nenhum diretório for especificado, o script usará a pasta `input_data` por padrão.

### Formatos de Dados Suportados

1. **Arquivos PTS**: Nuvens de pontos brutas
   - Formato: `x y z i r g b`
   - Cada linha representa um ponto com coordenadas, intensidade e cor

2. **Formato E57**: Formato de intercâmbio para nuvens de pontos
   - Suporte via biblioteca Open3D

3. **TrueView**: Formato específico do FARO com faces de cubo para panorâmicas
   - Inclui arquivo `CubeMapMeta.xml` com coordenadas de posicionamento
   - Imagens panorâmicas em formato equiretangular ou faces de cubo

## 🎨 Personalização

### Configuração da Interface

Você pode personalizar a aparência e comportamento da interface editando:

- `src/styles.css` - Estilos da versão React
- `public/index.html` - Estilos inline da versão JavaScript puro

### Configuração do Servidor

Edite `server.js` para:
- Alterar a porta do servidor
- Modificar endpoints da API
- Adicionar middleware personalizado

### Configuração do Processamento

Edite `process.py` para:
- Ajustar parâmetros de filtragem de nuvens de pontos
- Modificar algoritmos de geração de malha
- Personalizar a extração de plantas baixas

## ❓ Solução de Problemas

### Problemas Comuns

1. **Nuvens de pontos não aparecem**:
   - Verifique se os arquivos PTS estão no formato correto
   - Certifique-se de que o processamento foi concluído com sucesso
   - Verifique os logs do servidor para erros

2. **Panorâmicas não carregam**:
   - Verifique se as imagens estão no formato correto (equiretangular)
   - Certifique-se de que os caminhos estão configurados corretamente
   - Verifique se o arquivo `scenes.json` está atualizado

3. **Erros de WebGL**:
   - Verifique se seu navegador suporta WebGL
   - Atualize seus drivers de vídeo
   - Tente um navegador diferente

### Logs e Depuração

- Verifique os logs do servidor no console
- Abra as ferramentas de desenvolvedor do navegador para ver erros de JavaScript
- Para problemas de processamento, execute o script Python com a flag `-v` para modo verboso

## 👥 Contribuição

Contribuições são bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Faça commit das suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Faça push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

<p align="center">
  Desenvolvido com ❤️ por <a href="https://github.com/Caiolinooo">Caiolinooo</a>
</p>