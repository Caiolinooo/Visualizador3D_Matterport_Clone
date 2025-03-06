const express = require('express');
const fs = require('fs');
const path = require('path');
const ptsParser = require('./lib/ptsParser');
const xml2js = require('xml2js');

const app = express();
const PORT = process.env.PORT || 3000;

// Servir arquivos estáticos da pasta public
app.use(express.static('public'));

// Servir arquivos estáticos da pasta output para acesso aos resultados processados
app.use('/output', express.static('output'));

// Função para ler e parsear o Cubemapmeta.xml
function parseCubemapMeta(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) return reject(err);
      xml2js.parseString(data, (err, result) => {
        if (err) return reject(err);
        // Supondo que as coordenadas estejam dentro de result.metadata.coordinates[0]
        try {
          const coordsData = result.metadata.coordinates[0];
          resolve({
            x: parseFloat(coordsData.x[0]),
            y: parseFloat(coordsData.y[0]),
            z: parseFloat(coordsData.z[0])
          });
        } catch (e) {
          reject('Estrutura inválida no XML');
        }
      });
    });
  });
}

// Endpoint que lista as cenas extraídas dos arquivos .pts
app.get('/api/scenes', async (req, res) => {
  try {
    const scansDir = path.join(__dirname, 'scans');
    const panoramasDir = path.join(__dirname, 'panoramas');
    const scenes = [];

    // Verifica se a pasta 'scans' existe
    if (!fs.existsSync(scansDir)) {
      return res.json([]);
    }

    const files = await fs.promises.readdir(scansDir);
    
    for (const file of files) {
      if (path.extname(file).toLowerCase() === '.pts') {
        const ptsFilePath = path.join(scansDir, file);
        let center = ptsParser.getCenter(ptsFilePath);

        const sceneFolder = path.join(scansDir, path.basename(file, '.pts'));
        const metaFile = path.join(sceneFolder, 'Cubemapmeta.xml');
        if (fs.existsSync(metaFile)) {
          try {
            center = await parseCubemapMeta(metaFile);
          } catch (e) {
            console.log('Erro ao parsear XML:', e);
          }
        }

        let panorama = null;
        if (fs.existsSync(panoramasDir)) {
          const panoramaFiles = await fs.promises.readdir(panoramasDir);
          const panoramaCandidates = panoramaFiles.filter(img => {
            return path.basename(img, path.extname(img)) === path.basename(file, '.pts');
          });
          if (panoramaCandidates.length > 0) {
            panorama = panoramaCandidates[0];
          }
        }

        scenes.push({
          name: path.basename(file, '.pts'),
          center,
          ptsFile: file,
          panorama
        });
      }
    }
    res.json(scenes);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Novo endpoint para integração Matterport
app.get('/api/matterport', async (req, res) => {
    const summaryPath = path.join(__dirname, 'output', 'summary.json');
    let summary = {};
    if (!fs.existsSync(summaryPath)) {
        console.log("summary.json não encontrado. Retornando cena dummy.");
        // Cria uma cena dummy chamada "Demo" com arquivos de exemplo.
        summary = {
            "Demo": [
                "output_cloud.ply",
                "output_mesh.ply",
                "floor_plan.png",
                "panorama.jpg"
            ]
        };
    } else {
        try {
            summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        } catch (err) {
            return res.status(500).json({ error: 'Erro ao ler summary.json' });
        }
    }

    // Para cada cena, constrói os URLs para os arquivos processados e adiciona o centro, se disponível
    const scenes = Object.keys(summary).map(sceneName => {
        const files = summary[sceneName];
        const scene = { name: sceneName, files: {} };
        files.forEach(f => {
            if (f.toLowerCase().endsWith('.pts')) {
                scene.files.pts = `/output/${sceneName}/${f}`;
            } else if (f.startsWith('output_mesh')) {
                scene.files.mesh = `/output/${sceneName}/${f}`;
            } else if (f.startsWith('output_cloud')) {
                scene.files.cloud = `/output/${sceneName}/${f}`;
            } else if (f.startsWith('floor_plan')) {
                scene.files.floor_plan = `/output/${sceneName}/${f}`;
            } else if (f.match(/\.(jpg|jpeg|png)$/i)) {
                if (!scene.files.panorama) {
                    scene.files.panorama = `/output/${sceneName}/${f}`;
                } else {
                    if (!Array.isArray(scene.files.panorama)) {
                        scene.files.panorama = [scene.files.panorama];
                    }
                    scene.files.panorama.push(`/output/${sceneName}/${f}`);
                }
            } else if (f.toLowerCase().includes('trueview')) {
                scene.files.trueview = `/output/${sceneName}/${f}`;
            }
        });
        // Tenta ler o centro a partir do arquivo center_coordinates.txt
        const centerPath = path.join(__dirname, 'output', sceneName, 'center_coordinates.txt');
        if (fs.existsSync(centerPath)) {
            try {
                const centerContent = fs.readFileSync(centerPath, 'utf8');
                const match = centerContent.match(/Centro:\s*\[(.*)\]/);
                if (match) {
                    const coords = match[1].split(',').map(Number);
                    scene.center = coords;
                }
            } catch (e) {
                console.error(`Erro ao ler centro da cena ${sceneName}:`, e);
            }
        } else {
            // Se não tiver centro, defina um dummy
            scene.center = [0, 0, 0];
        }
        return scene;
    });

    res.json(scenes);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
}); 