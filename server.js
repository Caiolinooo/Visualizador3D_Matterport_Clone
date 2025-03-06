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

// Versão assíncrona de scanFaroScenes
async function scanFaroScenesAsync() {
  try {
    // Verifica a fonte de dados (pode ser diretório de scans ou TrueView)
    const scansDir = path.join(__dirname, 'input_data', 'scans');
    const trueviewDir = path.join(__dirname, 'input_data', 'trueview');
    
    let scenes = [];
    
    // 1. Primeiro verifica diretório de scans (arquivos PTS)
    if (fs.existsSync(scansDir)) {
      const scanFiles = fs.readdirSync(scansDir).filter(f => 
        f.toLowerCase().endsWith('.pts') || f.toLowerCase().endsWith('.e57')
      );
      
      for (const scanFile of scanFiles) {
        const sceneName = path.parse(scanFile).name;
        const filePath = path.join(scansDir, scanFile);
        
        // Verifica metadados para coordenadas
        const metaFile = path.join(scansDir, sceneName, 'CubeMapMeta.xml');
        let coordinates = [0, 0, 0];
        
        if (fs.existsSync(metaFile)) {
          try {
            const coords = await extractCoordinates(metaFile);
            coordinates = [coords.x, coords.y, coords.z];
          } catch (e) {
            console.error(`Erro ao processar metadados para ${sceneName}:`, e);
          }
        }
        
        // Encontra panorâmica correspondente
        const panoramaUrl = findPanoramicImage(scansDir, sceneName);
        
        // Arquivos de saída para esta cena
        const outputDir = path.join(__dirname, 'output', sceneName);
        const outputFiles = {};
        
        if (fs.existsSync(outputDir)) {
          const files = fs.readdirSync(outputDir);
          
          // Mapeia arquivos de saída importantes
          if (files.includes('output_cloud.ply')) {
            outputFiles.cloud = `/output/${sceneName}/output_cloud.ply`;
          }
          
          if (files.includes('output_mesh.ply')) {
            outputFiles.mesh = `/output/${sceneName}/output_mesh.ply`;
          }
          
          if (files.includes('floor_plan.png')) {
            outputFiles.floor_plan = `/output/${sceneName}/floor_plan.png`;
          }
          
          // Verifica se o arquivo PTS foi copiado para a saída
          const ptsCopy = files.find(f => f.toLowerCase().endsWith('.pts'));
          if (ptsCopy) {
            outputFiles.pts = `/output/${sceneName}/${ptsCopy}`;
          }
        }
        
        scenes.push({
          name: sceneName,
          source: 'scan',
          center: coordinates,
          files: {
            original: `/input_data/scans/${scanFile}`,
            panorama: panoramaUrl,
            ...outputFiles
          }
        });
      }
    }
    
    // 2. Verifica diretório TrueView para scans processados pelo Faro
    if (fs.existsSync(trueviewDir)) {
      const trueviewScans = fs.readdirSync(trueviewDir).filter(f => 
        fs.statSync(path.join(trueviewDir, f)).isDirectory() &&
        fs.existsSync(path.join(trueviewDir, f, 'CubeMapMeta.xml'))
      );
      
      for (const scanDir of trueviewScans) {
        const metaFile = path.join(trueviewDir, scanDir, 'CubeMapMeta.xml');
        let coordinates = [0, 0, 0];
        
        try {
          const coords = await extractCoordinates(metaFile);
          coordinates = [coords.x, coords.y, coords.z];
        } catch (e) {
          console.error(`Erro ao processar metadados TrueView para ${scanDir}:`, e);
        }
        
        // Encontra o cubo de alta resolução
        const cubeImages = {};
        for (let i = 0; i < 6; i++) {
          const imgFile = path.join(trueviewDir, scanDir, `Rgb_${i}_1024.JPG`);
          if (fs.existsSync(imgFile)) {
            cubeImages[`face${i}`] = `/input_data/trueview/${scanDir}/Rgb_${i}_1024.JPG`;
          } else {
            const pngFile = path.join(trueviewDir, scanDir, `Rgb_${i}_1024.PNG`);
            if (fs.existsSync(pngFile)) {
              cubeImages[`face${i}`] = `/input_data/trueview/${scanDir}/Rgb_${i}_1024.PNG`;
            }
          }
        }
        
        scenes.push({
          name: scanDir,
          source: 'trueview',
          center: coordinates,
          files: {
            meta: `/input_data/trueview/${scanDir}/CubeMapMeta.xml`,
            cube: cubeImages,
            // Para compatibilidade com a interface
            panorama: cubeImages.face0 // Temporariamente usa face frontal
          }
        });
      }
    }
    
    // 3. Verifica pasta de saída para informações adicionais
    const outputDir = path.join(__dirname, 'output');
    if (fs.existsSync(outputDir)) {
      // Procura por summary.json
      const summaryFile = path.join(outputDir, 'summary.json');
      if (fs.existsSync(summaryFile)) {
        try {
          const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
          
          // Atualiza as cenas com informações adicionais
          for (const [sceneName, files] of Object.entries(summary)) {
            const existingScene = scenes.find(s => s.name === sceneName);
            
            if (existingScene) {
              // Atualiza informações para cena existente
              const fileMap = {};
              files.forEach(file => {
                if (file.toLowerCase().includes('cloud')) {
                  fileMap.cloud = `/output/${sceneName}/${file}`;
                } else if (file.toLowerCase().includes('mesh')) {
                  fileMap.mesh = `/output/${sceneName}/${file}`;
                } else if (file.toLowerCase().includes('floor')) {
                  fileMap.floor_plan = `/output/${sceneName}/${file}`;
                } else if (file.toLowerCase().endsWith('.pts')) {
                  fileMap.pts = `/output/${sceneName}/${file}`;
                } else if (/\.(jpg|jpeg|png)$/i.test(file) && !fileMap.panorama) {
                  fileMap.panorama = `/output/${sceneName}/${file}`;
                }
              });
              
              existingScene.files = { ...existingScene.files, ...fileMap };
            } else {
              // Cria uma nova cena se ainda não existe
              const fileMap = {};
              files.forEach(file => {
                if (file.toLowerCase().includes('cloud')) {
                  fileMap.cloud = `/output/${sceneName}/${file}`;
                } else if (file.toLowerCase().includes('mesh')) {
                  fileMap.mesh = `/output/${sceneName}/${file}`;
                } else if (file.toLowerCase().includes('floor')) {
                  fileMap.floor_plan = `/output/${sceneName}/${file}`;
                } else if (file.toLowerCase().endsWith('.pts')) {
                  fileMap.pts = `/output/${sceneName}/${file}`;
                } else if (/\.(jpg|jpeg|png)$/i.test(file) && !fileMap.panorama) {
                  fileMap.panorama = `/output/${sceneName}/${file}`;
                }
              });
              
              // Verifica se tem coordenadas
              const centerFile = path.join(outputDir, sceneName, 'center_coordinates.txt');
              let coordinates = [0, 0, 0];
              
              if (fs.existsSync(centerFile)) {
                try {
                  const centerContent = fs.readFileSync(centerFile, 'utf8');
                  const match = centerContent.match(/Centro:\s*\[(.*)\]/);
                  if (match) {
                    coordinates = match[1].split(',').map(Number);
                  }
                } catch (e) {
                  console.error(`Erro ao ler coordenadas para ${sceneName}:`, e);
                }
              }
              
              scenes.push({
                name: sceneName,
                source: 'processed',
                center: coordinates,
                files: fileMap
              });
            }
          }
        } catch (e) {
          console.error('Erro ao processar summary.json:', e);
        }
      }
    }
    
    // Se não encontrou cenas, cria uma cena demo
    if (scenes.length === 0) {
      // Verifica se há panorama na pasta public
      const demoPanorama = path.join(__dirname, 'public', 'panorama.jpg');
      if (fs.existsSync(demoPanorama)) {
        scenes.push({
          name: "Demo",
          source: "demo",
          center: [0, 0, 0],
          files: {
            panorama: "/panorama.jpg"
          }
        });
      }
    }
    
    // Ordena as cenas por nome
    scenes.sort((a, b) => a.name.localeCompare(b.name));
    
    // Atualiza o cache
    dataCache.scenes = scenes;
    dataCache.lastUpdated = new Date();
    
    return scenes;
  } catch (error) {
    console.error('Erro ao escanear cenas:', error);
    throw error;
  }
}

// Endpoint para listar cenas disponíveis (compatibilidade com API existente)
app.get('/api/scenes', async (req, res) => {
  // Usa o cache se disponível e recente (menos de 5 minutos)
  if (dataCache.scenes && dataCache.lastUpdated && 
      (new Date() - dataCache.lastUpdated) < 5 * 60 * 1000) {
    return res.json(dataCache.scenes);
  }
  
  try {
    const scenes = await scanFaroScenesAsync();
    res.json(scenes);
  } catch (error) {
    console.error('Erro ao obter cenas:', error);
    res.status(500).json({ error: 'Erro ao carregar cenas', details: error.message });
  }
});

// Endpoint para o visualizador estilo Matterport
app.get('/api/matterport', async (req, res) => {
  // Usa o cache se disponível e recente (menos de 5 minutos)
  if (dataCache.scenes && dataCache.lastUpdated && 
      (new Date() - dataCache.lastUpdated) < 5 * 60 * 1000) {
    return res.json(dataCache.scenes);
  }
  
  try {
    const scenes = await scanFaroScenesAsync();
    res.json(scenes);
  } catch (error) {
    console.error('Erro ao obter cenas para Matterport:', error);
    
    // Retorna pelo menos uma cena básica para teste
    const fallbackScene = {
      name: "Demo",
      source: "fallback",
      center: [0, 0, 0],
      files: {
        panorama: "/panorama.jpg"
      }
    };
    
    res.json([fallbackScene]);
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