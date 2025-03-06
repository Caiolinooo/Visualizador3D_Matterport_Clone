import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xml2js from 'xml2js';
import cors from 'cors';

// Obter o __dirname equivalente quando usando ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializa o aplicativo Express
const app = express();
const PORT = process.env.PORT || 3000;

// Habilita CORS
app.use(cors());

// Middleware para servir arquivos estáticos da pasta public
app.use(express.static('public'));

// Permite acesso aos arquivos de output para visualização
app.use('/output', express.static('output'));

// Permite acesso aos arquivos de input_data (panoramas, scans, etc.)
app.use('/input_data', express.static('input_data'));

// Estrutura para armazenar cache de dados
const dataCache = {
  scenes: null,
  lastUpdated: null
};

// Função para parsear arquivos XML do scanner Faro
function parseXmlFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error(`Erro ao ler arquivo XML ${filePath}:`, err);
        return reject(err);
      }
      
      xml2js.parseString(data, (err, result) => {
        if (err) {
          console.error(`Erro ao parsear XML ${filePath}:`, err);
          return reject(err);
        }
        
        resolve(result);
      });
    });
  });
}

// Extrai coordenadas dos metadados do scanner
function extractCoordinates(metadataFile) {
  return parseXmlFile(metadataFile)
    .then(result => {
      try {
        // Estrutura pode variar conforme o formato do scanner
        if (result.metadata && result.metadata.coordinates && result.metadata.coordinates[0]) {
          const coords = result.metadata.coordinates[0];
          return {
            x: parseFloat(coords.x[0] || 0),
            y: parseFloat(coords.y[0] || 0),
            z: parseFloat(coords.z[0] || 0)
          };
        } else if (result.CubeMapMeta && result.CubeMapMeta.ScanPosition && result.CubeMapMeta.ScanPosition[0]) {
          // Formato alternativo do Faro Focus
          const pos = result.CubeMapMeta.ScanPosition[0];
          return {
            x: parseFloat(pos.$.x || 0),
            y: parseFloat(pos.$.y || 0),
            z: parseFloat(pos.$.z || 0)
          };
        }
      } catch (e) {
        console.error('Erro ao extrair coordenadas:', e);
      }
      
      return { x: 0, y: 0, z: 0 };
    })
    .catch(err => {
      console.error('Falha ao processar arquivo de metadados:', err);
      return { x: 0, y: 0, z: 0 };
    });
}

// Detecta e mapeia panorâmicas associadas a uma cena
function findPanoramicImage(sceneDir, sceneName) {
  const panoramaDir = path.join(__dirname, 'input_data', 'panorama');
  let panoramaUrl = null;
  
  // Verifica se existe diretório de panoramas
  if (fs.existsSync(panoramaDir)) {
    try {
      const panoramaFiles = fs.readdirSync(panoramaDir);
      
      // Prioridade de extensões
      const extensions = ['.jpg', '.jpeg', '.png'];
      
      // Tenta encontrar imagem com o mesmo nome da cena
      for (const ext of extensions) {
        const matchingFile = panoramaFiles.find(file => {
          const baseName = path.parse(file).name.toLowerCase();
          return baseName === sceneName.toLowerCase();
        });
        
        if (matchingFile) {
          panoramaUrl = `/input_data/panorama/${matchingFile}`;
          break;
        }
      }
      
      // Se não encontrou pelo nome, verifica se há nomes semelhantes
      if (!panoramaUrl) {
        const matchingFile = panoramaFiles.find(file => 
          file.toLowerCase().includes(sceneName.toLowerCase())
        );
        
        if (matchingFile) {
          panoramaUrl = `/input_data/panorama/${matchingFile}`;
        }
      }
      
      // Se ainda não encontrou, procura por um arquivo numerado da mesma sequência
      if (!panoramaUrl) {
        // Extrair número da cena se existir (ex. Scan_001 -> 001)
        const sceneNumber = sceneName.match(/(\d+)$/);
        
        if (sceneNumber && sceneNumber[1]) {
          const num = sceneNumber[1];
          const matchingFile = panoramaFiles.find(file => file.includes(num));
          
          if (matchingFile) {
            panoramaUrl = `/input_data/panorama/${matchingFile}`;
          }
        }
      }
    } catch (err) {
      console.error('Erro ao procurar panorâmicas:', err);
    }
  }
  
  return panoramaUrl;
}

// Função para coletar dados das cenas processadas
async function collectSceneData() {
  const scenes = [];
  const outputDir = path.join(__dirname, 'output');
  const panoramaDir = path.join(__dirname, 'input', 'panorama');
  const trueviewDir = path.join(__dirname, 'input', 'trueview');
  
  // Verifica se a pasta output existe
  if (!fs.existsSync(outputDir)) {
    console.warn('Pasta output não encontrada');
    return scenes;
  }
  
  // Lista todas as pastas dentro de output (cada uma é uma cena)
  const folders = fs.readdirSync(outputDir);
  
  for (const folder of folders) {
    const folderPath = path.join(outputDir, folder);
    
    // Verifica se é um diretório
    if (fs.statSync(folderPath).isDirectory()) {
      // Verifica arquivos necessários
      const cloudPath = path.join(folderPath, 'output_cloud.ply');
      const floorPlanPath = path.join(folderPath, 'floor_plan.png');
      const centerPath = path.join(folderPath, 'center_coordinates.txt');
      
      // Verifica se pelo menos o cloud existe
      if (fs.existsSync(cloudPath)) {
        // Lê coordenadas do centro se disponíveis
        let center = [0, 0, 0]; // Valor padrão
        if (fs.existsSync(centerPath)) {
          try {
            const centerContent = fs.readFileSync(centerPath, 'utf8');
            // Extrai as coordenadas usando regex
            const match = centerContent.match(/\[(.*?)\]/);
            if (match) {
              center = JSON.parse('[' + match[1] + ']');
            }
          } catch (e) {
            console.error(`Erro ao ler coordenadas da cena ${folder}:`, e);
          }
        }
        
        // Cria objeto da cena
        const scene = {
          name: folder,
          center: center,
          files: {
            cloud: `/output/${folder}/output_cloud.ply`,
          }
        };
        
        // Adiciona planta baixa se existir
        if (fs.existsSync(floorPlanPath)) {
          scene.files.floor_plan = `/output/${folder}/floor_plan.png`;
        }
        
        // Verifica se há panorâmicas disponíveis
        // Primeiro verifica na pasta de panoramas
        const panoramaFolder = path.join(panoramaDir, folder);
        if (fs.existsSync(panoramaFolder)) {
          const panoramaFiles = fs.readdirSync(panoramaFolder)
            .filter(file => file.endsWith('.jpg') || file.endsWith('.png'));
          
          if (panoramaFiles.length > 0) {
            scene.files.panorama = `/input/panorama/${folder}/${panoramaFiles[0]}`;
            console.log(`Panorama encontrado para ${folder}: ${panoramaFiles[0]}`);
          }
        } else {
          // Se não encontrou pasta específica, procura por qualquer arquivo com mesmo nome
          const panoramaFiles = fs.readdirSync(panoramaDir)
            .filter(file => (file.endsWith('.jpg') || file.endsWith('.png')) && 
                           file.toLowerCase().includes(folder.toLowerCase()));
          
          if (panoramaFiles.length > 0) {
            scene.files.panorama = `/input/panorama/${panoramaFiles[0]}`;
            console.log(`Panorama correspondente para ${folder}: ${panoramaFiles[0]}`);
          }
        }
        
        // Se não encontrou panorama, verifica no TrueView
        if (!scene.files.panorama) {
          // Verifica se o nome da pasta do TrueView corresponde ao nome da cena
          const trueviewFolder = path.join(trueviewDir, folder);
          if (fs.existsSync(trueviewFolder)) {
            // Procura pelo arquivo de configuração do cubemap
            const configFiles = fs.readdirSync(trueviewFolder)
              .filter(file => file.includes('cubemap') && file.endsWith('.json'));
            
            if (configFiles.length > 0) {
              scene.files.cubemap = {
                config: `/input/trueview/${folder}/${configFiles[0]}`,
                folder: `/input/trueview/${folder}/`
              };
              console.log(`Cubemap TrueView encontrado para ${folder}: ${configFiles[0]}`);
            }
          } else {
            // Se não encontrou pasta específica, procura por qualquer pasta com mesmo nome
            const trueviewFolders = fs.readdirSync(trueviewDir)
              .filter(dir => fs.statSync(path.join(trueviewDir, dir)).isDirectory() && 
                            dir.toLowerCase().includes(folder.toLowerCase()));
            
            if (trueviewFolders.length > 0) {
              const tvFolder = trueviewFolders[0];
              const configFiles = fs.readdirSync(path.join(trueviewDir, tvFolder))
                .filter(file => file.includes('cubemap') && file.endsWith('.json'));
              
              if (configFiles.length > 0) {
                scene.files.cubemap = {
                  config: `/input/trueview/${tvFolder}/${configFiles[0]}`,
                  folder: `/input/trueview/${tvFolder}/`
                };
                console.log(`Cubemap TrueView correspondente para ${folder}: ${tvFolder}/${configFiles[0]}`);
              }
            }
          }
        }
        
        scenes.push(scene);
      }
    }
  }
  
  // Se não encontrou nenhuma cena processada, verifica se há arquivos PTS para processar
  if (scenes.length === 0) {
    const ptsDir = path.join(__dirname, 'input', 'pts');
    if (fs.existsSync(ptsDir)) {
      const ptsFiles = fs.readdirSync(ptsDir)
        .filter(file => file.endsWith('.pts'));
      
      if (ptsFiles.length > 0) {
        console.log('Nenhuma cena processada encontrada, mas há arquivos PTS disponíveis para processamento');
        // Informa ao cliente que há dados disponíveis, mas precisam ser processados
        scenes.push({
          name: "Dados não processados",
          message: "Execute o process.py para processar os dados",
          status: "pending",
          files: {}
        });
      }
    }
  }
  
  return scenes;
}

// Endpoint para obter dados do Matterport otimizado
app.get('/api/matterport', async (req, res) => {
  try {
    const scenes = await collectSceneData();
    
    // Se não encontrou cenas, retorna uma cena demo
    if (scenes.length === 0) {
      return res.json([{
        name: "Cena Demo",
        source: "fallback",
        center: [0, 0, 0],
        files: {
          panorama: "/demo_panorama.jpg"
        }
      }]);
    }
    
    res.json(scenes);
  } catch (error) {
    console.error('Erro ao processar cenas:', error);
    res.status(500).json({ error: 'Erro ao processar cenas' });
  }
});

// Cria estrutura de diretório padrão se não existir
function ensureDirectoryStructure() {
  const dirs = [
    'input_data',
    'input_data/scans',
    'input_data/panorama',
    'input_data/trueview',
    'output',
    'output/scan'
  ];

  for (const dir of dirs) {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) {
      console.log(`Criando diretório: ${dir}`);
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }
}

// Garantir que estrutura de diretórios existe antes de iniciar o servidor
ensureDirectoryStructure();

// Cria imagem demo se não existir
function createDemoData() {
  // Copia panorama.jpg da pasta HTML_QUE_FUNCIONA para public se existir
  const sourcePanorama = path.join(__dirname, 'HTML_QUE_FUNCIONA', 'panorama.jpg');
  const destPanorama = path.join(__dirname, 'public', 'panorama.jpg');
  
  if (fs.existsSync(sourcePanorama) && !fs.existsSync(destPanorama)) {
    console.log('Copiando panorama.jpg para pasta public para demo');
    fs.copyFileSync(sourcePanorama, destPanorama);
  }
}

// Criar dados de demonstração
createDemoData();

// Adicione esta função para criar uma imagem demo diretamente
function createDemoPanorama() {
  const fs = require('fs');
  const path = require('path');
  const { createCanvas } = require('canvas');
  
  // Caminho para o arquivo de saída
  const outputPath = path.join(__dirname, 'public', 'demo_panorama.jpg');
  
  // Verifica se o arquivo já existe
  if (fs.existsSync(outputPath)) {
    console.log('Imagem demo já existe, pulando criação');
    return;
  }
  
  try {
    // Cria um canvas para a imagem demo
    const canvas = createCanvas(2048, 1024);
    const ctx = canvas.getContext('2d');
    
    // Preenche com um gradiente de fundo
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0055AA');
    gradient.addColorStop(0.5, '#3388CC');
    gradient.addColorStop(1, '#66AADD');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Adiciona um padrão de grade
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    
    const gridSize = 64;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // Adiciona texto
    ctx.fillStyle = 'white';
    ctx.font = 'bold 64px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PANORAMA DEMO', canvas.width/2, canvas.height/2 - 50);
    
    ctx.font = '32px Arial';
    ctx.fillText('Esta é uma imagem panorâmica de demonstração', canvas.width/2, canvas.height/2 + 30);
    ctx.fillText('Substitua por uma imagem panorâmica real', canvas.width/2, canvas.height/2 + 80);
    
    // Salva o canvas como JPEG
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.8 });
    fs.writeFileSync(outputPath, buffer);
    
    console.log(`Imagem demo criada em ${outputPath}`);
  } catch (error) {
    console.error('Erro ao criar imagem demo:', error);
    
    // Fallback: Copia uma imagem de outro lugar, se existir
    try {
      const alternateSourcePath = path.join(__dirname, 'public', 'fallback_panorama.jpg');
      if (fs.existsSync(alternateSourcePath)) {
        fs.copyFileSync(alternateSourcePath, outputPath);
        console.log('Usando imagem fallback como demo');
      }
    } catch (e) {
      console.error('Erro ao usar imagem fallback:', e);
    }
  }
}

// Chame essa função antes de iniciar o servidor
// createDemoPanorama();

// Inicia o servidor - bind em 0.0.0.0 para garantir acessibilidade
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Servidor acessível em http://0.0.0.0:${PORT}`);
  console.log(`Diretório atual: ${__dirname}`);
  console.log('Verificando diretórios de dados:');
  
  // Verifica diretórios importantes
  const dirs = [
    'input_data',
    'input_data/scans',
    'input_data/panorama',
    'input_data/trueview',
    'output'
  ];
  
  dirs.forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    console.log(`- ${dir}: ${fs.existsSync(fullPath) ? 'Existe' : 'Não existe'}`);
  });
});

// Rota de saúde para verificar se o servidor está funcionando
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Para qualquer outra rota, retorne o index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Adicione este helper para buscar dados do TrueView
function findTrueViewData(sceneName) {
  const trueviewDir = path.join(__dirname, 'input', 'trueview');
  if (!fs.existsSync(trueviewDir)) return null;
  
  try {
    // Tenta encontrar uma pasta com o mesmo nome
    const exactMatch = path.join(trueviewDir, sceneName);
    if (fs.existsSync(exactMatch) && fs.statSync(exactMatch).isDirectory()) {
      // Procura por arquivos de cubemap
      const files = fs.readdirSync(exactMatch);
      const configFile = files.find(f => f.includes('cubemap') && f.endsWith('.json'));
      
      if (configFile) {
        return {
          config: `/input/trueview/${sceneName}/${configFile}`,
          folder: `/input/trueview/${sceneName}/`
        };
      }
    }
    
    // Se não encontrou match exato, procura por nome parcial
    const folders = fs.readdirSync(trueviewDir)
      .filter(f => fs.statSync(path.join(trueviewDir, f)).isDirectory() && 
               f.toLowerCase().includes(sceneName.toLowerCase()));
    
    if (folders.length > 0) {
      const matchFolder = folders[0];
      const files = fs.readdirSync(path.join(trueviewDir, matchFolder));
      const configFile = files.find(f => f.includes('cubemap') && f.endsWith('.json'));
      
      if (configFile) {
        return {
          config: `/input/trueview/${matchFolder}/${configFile}`,
          folder: `/input/trueview/${matchFolder}/`
        };
      }
    }
  } catch (err) {
    console.error(`Erro ao buscar dados TrueView para ${sceneName}:`, err);
  }
  
  return null;
}