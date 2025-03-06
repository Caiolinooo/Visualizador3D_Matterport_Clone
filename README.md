# Visualizador 3D Estilo Matterport

Esta aplicação permite a visualização interativa de dados de escaneamento 3D no estilo do Matterport, usando arquivos do Scanner FARO Focus, incluindo arquivos PTS (nuvens de pontos) e panorâmicas equiretangulares.

## Demonstração

![Demonstração do Visualizador](https://example.com/demo.gif)

## Características

- **Visualização Panorâmica 360°**: Navegue pelo ambiente com imagens de alta qualidade.
- **Nuvens de Pontos 3D**: Visualize a geometria real do ambiente escaneado.
- **Medição de Distâncias**: Meça distâncias entre pontos no ambiente 3D.
- **Vista "Doll House"**: Visualize o modelo de cima, similar ao Matterport.
- **Planta Baixa**: Veja a representação 2D do ambiente.
- **Anotações/Tags**: Adicione informações em pontos específicos.
- **Tour Automático**: Navegue automaticamente entre as cenas.
- **Navegação Entre Cenas**: Explore múltiplos pontos de escaneamento.

## Requisitos

- Node.js 16.x ou superior
- Python 3.8 ou superior (para processamento de dados)
- Arquivos de escaneamento FARO Focus (PTS, E57 ou TrueView)

## Instalação

1. Clone o repositório:
   ```
   git clone https://github.com/seu-usuario/visualizador-3d.git
   cd visualizador-3d
   ```

2. Instale as dependências:
   ```
   npm install
   ```

3. Para processamento de dados, instale as dependências Python:
   ```
   pip install -r requirements.txt
   ```

## Estrutura de Diretórios

A aplicação espera a seguinte estrutura de diretórios:

```
/
├── input_data/             # Dados de entrada
│   ├── scans/              # Arquivos .pts do scanner
│   ├── panorama/           # Imagens panorâmicas 360°
│   └── trueview/           # Dados do FARO TrueView
├── output/                 # Dados processados
│   └── [scene_name]/       # Uma pasta por cena
│       ├── output_cloud.ply    # Nuvem de pontos processada
│       ├── output_mesh.ply     # Malha 3D
│       ├── floor_plan.png      # Imagem da planta baixa
│       └── center_coordinates.txt  # Coordenadas centrais
├── public/                 # Arquivos estáticos do frontend
├── src/                    # Código fonte do frontend React
└── lib/                    # Bibliotecas de utilidade
```

## Uso

### Executando o Servidor Backend

```
npm start
```

Isso iniciará o servidor Express na porta 3000 por padrão.

### Executando o Frontend React

```
npm run dev
```

Isso iniciará o servidor de desenvolvimento Vite na porta 5173.

### Acesso às Interfaces

- **Versão JavaScript puro**: http://localhost:3000/
- **Versão React**: http://localhost:5173/

## Processamento de Dados

Para processar arquivos PTS e gerar nuvens de pontos otimizadas, malhas 3D e plantas baixas:

```
python process.py [diretório_de_entrada]
```

Se nenhum diretório for especificado, o script usará a pasta `input_data` por padrão.

### Formato dos Dados do FARO Focus

A aplicação suporta três formatos de dados do FARO:

1. **Arquivos PTS**: Nuvens de pontos brutas
2. **Formato E57**: Formato de intercâmbio para nuvens de pontos
3. **TrueView**: Formato específico do FARO com faces de cubo para panorâmicas

### Trabalhando com o TrueView

O formato TrueView armazena as coordenadas de cada escaneamento, facilitando a navegação entre cenas. Essas coordenadas são extraídas automaticamente dos arquivos `CubeMapMeta.xml`.

## Desenvolvimento

### Estrutura do Código

- `server.js`: Servidor Express para servir a API e arquivos estáticos
- `src/app.jsx`: Componente principal da aplicação React
- `public/main.js`: Implementação em JavaScript puro usando Three.js
- `process.py`: Script de processamento de dados do scanner FARO

### Fluxo de Trabalho

1. Coloque os arquivos do scanner na estrutura de diretórios adequada
2. Execute o script de processamento para gerar os dados otimizados
3. Inicie o servidor backend e o frontend
4. Navegue pelas cenas através da interface web

## Adaptando para Seu Projeto

Para usar em seu próprio projeto:

1. Substitua os arquivos em `input_data` pelos seus próprios dados de escaneamento
2. Execute o processamento de dados conforme necessário
3. Personalize as interfaces em `public/` ou `src/` conforme desejado

## Solução de Problemas

### Arquivos Não Aparecem

- Verifique se os arquivos estão nos diretórios corretos
- Certifique-se de que as permissões de arquivo permitam leitura
- Verifique os logs do servidor para mensagens de erro

### Erros de Processamento

- Certifique-se de que o Python e as dependências estão instalados corretamente
- Verifique se seus arquivos PTS estão em um formato compatível
- Se usar o TrueView, verifique se o CubeMapMeta.xml está presente

## Licença

Este projeto está licenciado sob [Sua Licença]. Veja o arquivo LICENSE para detalhes.

## Créditos

- [Three.js](https://threejs.org/) - Biblioteca JavaScript para 3D
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber) - Renderizador React para Three.js
- [Express.js](https://expressjs.com/) - Framework web para Node.js
- [Open3D](http://www.open3d.org/) - Biblioteca para processamento de dados 3D