/*
 * Visualizador 3D estilo Matterport para arquivos PTS e panorâmicas
 * Implementação que combina:
 * - Navegação entre cenas
 * - Panorâmicas equiretangulares
 * - Visualização de nuvem de pontos
 * - Ferramentas de medição
 * - Vista dollhouse e planta baixa
 * - Anotações/tags nos ambientes
 * - Tour automático
 */

// Remova as importações ES6 que estão causando problemas
// Agora THREE, OrbitControls e PLYLoader estão disponíveis globalmente através das tags script

(function() {
  // Variáveis globais
  let scene, camera, renderer, controls;
  let panoramaSphere, currentPointCloud;
  let measurementPoints = [];
  let measurementLine, measurementPreview;
  let isMeasuring = false;
  let isTagMode = false;
  let isFloorPlanVisible = false;
  let isDollhouseMode = false;
  let autoTourActive = false;
  let autoTourInterval;
  let tags = [];
  let scenes = [];
  let currentSceneIndex = 0;
  let raycaster = new THREE.Raycaster();
  let mouse = new THREE.Vector2();
  let hoverState = { mesh: null };
  let savedCameraPosition;
  let currentSceneData;
  
  // Elementos DOM
  const loadingOverlay = document.getElementById('loading-overlay');
  const infoElement = document.getElementById('info');
  const measureInfoElement = document.getElementById('measure-info');
  const floorPlanElement = document.getElementById('floor-plan');
  
  // IMPORTANTE: Adicionar chamada da função init() quando o DOM estiver pronto
  document.addEventListener('DOMContentLoaded', init);
  
  // Inicialização
  function init() {
    monitorRequests();
    
    setupScene();
    setupCamera();
    setupRenderer();
    setupLights();
    setupControls();
    setupEventListeners();
    setupUI();
    
    // Inicia o loop de renderização
    animate();
    
    // Carrega as cenas disponíveis
    loadScenes();

    console.log('Função init() foi executada');
  }
  
  // Adicione esta função para monitorar requisições e erros
  function monitorRequests() {
    const originalFetch = window.fetch;
    
    window.fetch = function(url, options) {
      console.log(`🔄 Requisição: ${url}`);
      return originalFetch(url, options)
        .then(response => {
          console.log(`✅ Resposta de ${url}: ${response.status} ${response.statusText}`);
          return response;
        })
        .catch(error => {
          console.error(`❌ Erro em ${url}:`, error);
          throw error;
        });
    };
    
    // Monitora carregamento de imagens
    const originalImageSrc = Object.getOwnPropertyDescriptor(Image.prototype, 'src').set;
    
    Object.defineProperty(Image.prototype, 'src', {
      set: function(value) {
        console.log(`🖼️ Carregando imagem: ${value}`);
        this.addEventListener('load', () => console.log(`✅ Imagem carregada: ${value}`));
        this.addEventListener('error', (e) => console.error(`❌ Erro ao carregar imagem: ${value}`, e));
        return originalImageSrc.call(this, value);
      }
    });
  }
  
  // Configuração da cena Three.js
  function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    
    // Remove a neblina que pode causar cálculos extra desnecessários
    // scene.fog = new THREE.FogExp2(0x000000, 0.002);
  }
  
  // Configuração da câmera
  function setupCamera() {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1, 5); // Ajuste a posição da câmera conforme necessário
  }
  
  // Configuração do renderer
  function setupRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
  }
  
  // Adiciona luzes à cena
  function setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
  }
  
  // Configuração dos controles OrbitControls
  function setupControls() {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    
    // Configurações para imitar Matterport
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.rotateSpeed = 0.5;
    
    // Limita o movimento vertical
    controls.minPolarAngle = Math.PI * 0.1;  // 18 graus acima da horizontal
    controls.maxPolarAngle = Math.PI * 0.9;  // 18 graus abaixo da horizontal
    
    // Desativa pan para ficar no mesmo lugar como no Matterport
    controls.enablePan = false;
    
    // Limita zoom (mas mantém habilitado)
    controls.enableZoom = true;
    controls.zoomSpeed = 0.7;
    controls.minDistance = 0.1;
    controls.maxDistance = 5;
    
    // Sempre mantém a câmera na mesma altura (altura dos olhos)
    const originalUpdate = controls.update;
    controls.update = function() {
      originalUpdate.call(this);
      
      if (!isDollhouseMode) {
        // Mantém a altura da câmera igual à altura dos olhos
        const floorLevel = detectFloorLevel();
        camera.position.y = floorLevel + 1.6; // 1.6m = altura média dos olhos
      }
    };
    
    // Posição inicial
    camera.position.set(0, 1.6, 0);
    controls.target.set(0, 1.6, -1);
    controls.update();
  }
  
  // Configuração de event listeners
  function setupEventListeners() {
    // Redimensionamento da janela
    window.addEventListener('resize', onWindowResize);
    
    // Mouse e toque para medição e tags
    renderer.domElement.addEventListener('click', function(event) {
      if (isMeasuring) {
        handleMeasurementClick(event);
      } else if (isTagMode) {
        handleTagClick(event);
      } else {
        handleNavPointClick(event);
      }
    });
    
    // Mouse move para hover - use onDocumentMouseMove em vez de onMouseMove
    renderer.domElement.addEventListener('mousemove', onDocumentMouseMove);
    
    // Teclas para atalhos
    document.addEventListener('keydown', onKeyDown);
    
    console.log('Event listeners configurados');
  }
  
  // Configuração da interface
  function setupUI() {
    // Conecta os botões da interface
    document.getElementById('btn-dollhouse').addEventListener('click', toggleDollhouseMode);
    document.getElementById('btn-floorplan').addEventListener('click', toggleFloorPlan);
    document.getElementById('btn-measure').addEventListener('click', toggleMeasureMode);
    document.getElementById('btn-tags').addEventListener('click', toggleTagMode);
    document.getElementById('btn-tour').addEventListener('click', toggleAutoTour);
    document.getElementById('btn-reset').addEventListener('click', resetView);
    
    // Atualizando estado inicial da UI
    updateUIState();
    
    console.log('UI inicializada, botões conectados');
  }
  
  // Loop de animação
  function animate() {
    requestAnimationFrame(animate);
    
    // Limitação de framerate para economizar recursos
    const now = Date.now();
    if (now - lastFrameTime < 16) { // Aproximadamente 60 FPS
      return;
    }
    lastFrameTime = now;
    
    // Atualiza os controles
    controls.update();
    
    // Faz raycasting apenas quando necessário (hover, medição, etc)
    // em vez de a cada frame
    if (isMeasuring || isTagMode || hovering) {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      processIntersections(intersects);
    }
    
    // Renderiza a cena
    renderer.render(scene, camera);
  }
  
  // Ajuste ao redimensionar a janela
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  /* 
   * Carregamento e gerenciamento de cenas
   */
  
  // Carrega a lista de cenas disponíveis a partir da API
  function loadScenes() {
    console.log('Tentando carregar cenas...');
    showLoading(true);
    
    infoElement.textContent = 'Carregando lista de cenas...';
    
    fetch('/api/matterport')
      .then(response => {
        console.log(`Resposta da API: ${response.status} ${response.statusText}`);
        if (!response.ok) {
          throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Dados recebidos:', data);
        
        if (!data || data.length === 0) {
          console.warn('Nenhuma cena encontrada');
          showMessage('Nenhuma cena disponível. Use o botão "Escolher Nuvem" para carregar uma cena.');
          
          // Em vez de criar uma demo, apenas mostra tela vazia com instruções
          showEmptySceneMessage();
          showLoading(false);
          return;
        }
        
        // Guarda referência às cenas
        scenes = data;
        
        // Popula o menu de cenas
        populateScenesMenu(scenes);
        
        // Carrega a primeira cena
        const firstScene = scenes[0];
        console.log('Carregando primeira cena:', firstScene);
        loadScene(firstScene);
        currentSceneIndex = 0;
      })
      .catch(error => {
        console.error('Erro ao carregar cenas:', error);
        showMessage('Erro ao carregar cenas. Tente novamente mais tarde.');
        
        // Em vez de criar demo, mostrar mensagem de erro e interface para upload
        showErrorMessage();
        showLoading(false);
      });
  }
  
  // Popula o menu de cenas na sidebar
  function populateScenesMenu(scenes) {
    const scenesList = document.getElementById('scenes-list');
    scenesList.innerHTML = '';
    
    scenes.forEach((scene, index) => {
      const sceneElement = document.createElement('div');
      sceneElement.className = 'scene-item';
      sceneElement.innerHTML = `
        <h3>${scene.name}</h3>
        <p>Centro: ${scene.center ? scene.center.map(c => c.toFixed(2)).join(', ') : 'N/A'}</p>
      `;
      
      sceneElement.addEventListener('click', () => {
        currentSceneIndex = index;
        loadScene(scene);
      });
      
      scenesList.appendChild(sceneElement);
    });
  }
  
  // Carrega uma cena específica
  function loadScene(sceneData) {
    console.log('Carregando cena Matterport-style:', sceneData);
    showLoading(true);
    
    // Guarda referência à cena atual
    currentSceneData = sceneData;
    
    // Limpa a cena atual
    clearScene();
    
    // Mostra status da cena
    if (sceneData.status === 'pending') {
      showMessage(sceneData.message || 'Esta cena ainda não foi processada');
      showLoading(false);
      return;
    }
    
    // Funções para carregar componentes da cena
    const toLoad = {
      panorama: (sceneData.files.panorama !== undefined || sceneData.files.cubemap !== undefined),
      cloud: sceneData.files.cloud !== undefined,
      floorPlan: sceneData.files.floor_plan !== undefined
    };
    
    // Contador para controlar quando todos os componentes foram carregados
    let loadedCount = 0;
    const totalToLoad = Object.values(toLoad).filter(v => v).length;
    
    // Função para verificar se tudo foi carregado
    function checkAllLoaded() {
      loadedCount++;
      console.log(`Item carregado (${loadedCount}/${totalToLoad})`);
      
      if (loadedCount >= totalToLoad) {
        showLoading(false);
        
        // Detecta o nível do piso
        const floorLevel = detectFloorLevel();
        
        // Configura a câmera na posição de uma pessoa
        if (sceneData.center) {
          const center = sceneData.center;
          // Posiciona a câmera na altura dos olhos relativa ao nível do piso
          controls.target.set(center[0], floorLevel + 1.6, center[2] - 1); // Olha para frente
          camera.position.set(center[0], floorLevel + 1.6, center[2]); // Altura dos olhos
          controls.update();
        }
        
        // Cria pontos de navegação
        createNavigationPoints();
        
        // Prioriza a visualização da panorâmica
        if (panoramaSphere) {
          panoramaSphere.visible = true;
          // Posiciona a panorâmica na altura correta (nível do piso + altura dos olhos)
          if (sceneData.center) {
            panoramaSphere.position.set(
              sceneData.center[0],
              floorLevel + 1.6,
              sceneData.center[2]
            );
          }
        }
        
        if (currentPointCloud) {
          currentPointCloud.visible = isDollhouseMode; // Só mostra se estiver em modo dollhouse
        }
        
        // Atualiza interface
        infoElement.textContent = `Cena: ${sceneData.name}`;
      }
    }
    
    // Carrega panorama primeiro (equiretangular ou cubemap)
    if (toLoad.panorama) {
      const panoramaData = sceneData.files.panorama || sceneData.files.cubemap;
      loadPanorama(panoramaData, checkAllLoaded);
    }
    
    // Depois carrega nuvem de pontos
    if (toLoad.cloud) {
      loadPointCloud(sceneData.files.cloud, checkAllLoaded);
    }
    
    // Por fim carrega planta baixa
    if (toLoad.floorPlan) {
      loadFloorPlan(sceneData.files.floor_plan, checkAllLoaded);
    }
    
    // Se não há nada para carregar, mostra um modelo básico
    if (totalToLoad === 0) {
      createBasicModel();
      showLoading(false);
      showMessage('Nenhum dado disponível para esta cena');
    }
  }
  
  // Limpa a cena atual
  function clearScene() {
    // Remove todos os objetos da cena, exceto luzes
    for (let i = scene.children.length - 1; i >= 0; i--) {
      const obj = scene.children[i];
      if (obj.type === 'AmbientLight' || obj.type === 'DirectionalLight') {
        continue;
      }
      scene.remove(obj);
    }
    
    // Limpa todas as variáveis de referência
    panoramaSphere = null;
    currentPointCloud = null;
    measurementLine = null;
    measurementPreview = null;
    measurementPoints = [];
  }
  
  // Reinicia todos os modos
  function resetModes() {
    isMeasuring = false;
    isTagMode = false;
    isDollhouseMode = false;
    isFloorPlanVisible = false;
    stopAutoTour();
    
    // Atualiza UI
    updateUIState();
  }
  
  // Função para carregar panorâmicas (tanto equiretangulares quanto cubemaps)
  function loadPanorama(panoramaData, callback) {
    if (!panoramaData) {
      console.warn('Dados de panorama não fornecidos');
      if (callback) callback();
      return;
    }
    
    console.log('Carregando panorama:', panoramaData);
    
    // Remove panorama anterior
    if (panoramaSphere) {
      scene.remove(panoramaSphere);
      panoramaSphere.geometry.dispose();
      if (panoramaSphere.material) {
        if (Array.isArray(panoramaSphere.material)) {
          panoramaSphere.material.forEach(m => m.dispose());
        } else {
          panoramaSphere.material.dispose();
        }
      }
      panoramaSphere = null;
    }

    // Garantir que a nuvem de pontos não esteja visível quando estiver no modo imersivo
    if (currentPointCloud && !isDollhouseMode) {
      currentPointCloud.visible = false;
      console.log('Nuvem de pontos ocultada para modo imersivo');
    }
    
    // Trata cubemap do TrueView
    if (typeof panoramaData === 'object' && panoramaData.config) {
      console.log('Carregando cubemap do TrueView:', panoramaData.config);
      loadTrueViewPanorama(panoramaData, callback);
      return;
    }
    
    // Carrega panorâmica equiretangular
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      panoramaData,
      function(texture) {
        // Cria esfera grande para a panorâmica
        const geometry = new THREE.SphereGeometry(50, 64, 64);
        // Inverte a geometria para ver de dentro
        geometry.scale(-1, 1, 1);
        
        // Material com maior prioridade de renderização
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide,
          depthWrite: false,
          depthTest: false
        });
        
        // Cria a esfera da panorâmica
        panoramaSphere = new THREE.Mesh(geometry, material);
        panoramaSphere.name = 'panorama';
        panoramaSphere.renderOrder = -1; // Renderiza antes de tudo
        
        // Posiciona no centro correto
        if (currentSceneData && currentSceneData.center) {
          const floorLevel = detectFloorLevel();
          panoramaSphere.position.set(
            currentSceneData.center[0],
            floorLevel + 1.6, // Altura dos olhos
            currentSceneData.center[2]
          );
        }
        
        scene.add(panoramaSphere);
        showMessage('Panorama carregado');
        
        if (callback) callback();
      },
      function(xhr) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        showMessage(`Carregando panorama... ${percent}%`);
      },
      function(error) {
        console.error('Erro ao carregar panorama:', error);
        showMessage('Erro ao carregar panorama. Tentando alternativa...');
        
        // Tenta usar imagem demo como fallback
        loadFallbackPanorama(callback);
      }
    );
  }
  
  // Nova função para carregar panorâmicas do TrueView
  function loadTrueViewPanorama(trueViewData, callback) {
    // Primeiro, carregamos o arquivo de metadados (cubemapmeta)
    fetch(trueViewData.config)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Erro ao carregar configuração: ${response.status}`);
        }
        return response.json();
      })
      .then(config => {
        console.log('Config TrueView carregado:', config);
        
        // Obter caminhos para as imagens do cubemap
        const baseFolder = trueViewData.folder;
        const imageFiles = {
          px: baseFolder + 'cubemap_right.jpg',
          nx: baseFolder + 'cubemap_left.jpg',
          py: baseFolder + 'cubemap_top.jpg',
          ny: baseFolder + 'cubemap_bottom.jpg',
          pz: baseFolder + 'cubemap_front.jpg',
          nz: baseFolder + 'cubemap_back.jpg'
        };
        
        // Obter posição da câmera, se disponível
        let cameraPosition = null;
        if (config.camera && config.camera.position) {
          cameraPosition = [
            config.camera.position.x,
            config.camera.position.y,
            config.camera.position.z
          ];
          console.log('Posição da câmera TrueView:', cameraPosition);
        }
        
        // Carrega as texturas como cubemap
        const loader = new THREE.CubeTextureLoader();
        loader.setPath('');  // URLs já incluem o caminho completo
        
        loader.load([
          imageFiles.px, imageFiles.nx,
          imageFiles.py, imageFiles.ny,
          imageFiles.pz, imageFiles.nz
        ],
        function(cubeTexture) {
          // Cria geometria para a panorâmica
          const geometry = new THREE.SphereGeometry(50, 64, 64);
          geometry.scale(-1, 1, 1);  // Inverte para ver de dentro
          
          // Cria material para o cubemap
          const material = new THREE.MeshBasicMaterial({
            envMap: cubeTexture,
            side: THREE.BackSide,
            depthWrite: false,
            depthTest: false
          });
          
          // Cria a esfera
          panoramaSphere = new THREE.Mesh(geometry, material);
          panoramaSphere.name = 'panorama_cubemap';
          panoramaSphere.renderOrder = -1;
          
          // Posiciona no centro (use coordenadas do TrueView se disponíveis)
          if (cameraPosition) {
            panoramaSphere.position.set(...cameraPosition);
          } else if (currentSceneData && currentSceneData.center) {
            const floorLevel = detectFloorLevel();
            panoramaSphere.position.set(
              currentSceneData.center[0],
              floorLevel + 1.6,
              currentSceneData.center[2]
            );
          }
          
          scene.add(panoramaSphere);
          showMessage('Panorama TrueView carregado');
          
          if (callback) callback();
        },
        function(xhr) {
          const percent = Math.round((xhr.loaded / xhr.total) * 100);
          showMessage(`Carregando cubemap... ${percent}%`);
        },
        function(error) {
          console.error('Erro ao carregar cubemap:', error);
          showMessage('Erro ao carregar cubemap. Tentando alternativa...');
          loadFallbackPanorama(callback);
        });
      })
      .catch(error => {
        console.error('Erro ao processar dados do TrueView:', error);
        loadFallbackPanorama(callback);
      });
  }
  
  // Função para carregar uma panorâmica de fallback
  function loadFallbackPanorama(callback) {
    const demoUrl = '/demo_panorama.jpg';
    
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      demoUrl,
      function(texture) {
        const geometry = new THREE.SphereGeometry(50, 64, 64);
        geometry.scale(-1, 1, 1);
        
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide,
          depthWrite: false,
          depthTest: false
        });
        
        panoramaSphere = new THREE.Mesh(geometry, material);
        panoramaSphere.name = 'panorama_demo';
        panoramaSphere.renderOrder = -1;
        
        scene.add(panoramaSphere);
        showMessage('Panorama demo carregado');
        
        if (callback) callback();
      },
      undefined,
      function(error) {
        console.error('Erro ao carregar panorama demo:', error);
        if (callback) callback();
      }
    );
  }
  
  // Carrega nuvem de pontos (formato PLY)
  function loadPointCloud(cloudUrl, callback) {
    if (!cloudUrl) {
      console.warn('URL de nuvem de pontos não fornecida');
      if (callback) callback();
      return;
    }
    
    console.log('Carregando nuvem de pontos:', cloudUrl);
    
    const plyLoader = new THREE.PLYLoader();
    plyLoader.load(
      cloudUrl,
      function(geometry) {
        // Remove nuvem anterior
        if (currentPointCloud) {
          scene.remove(currentPointCloud);
          currentPointCloud.geometry.dispose();
          if (Array.isArray(currentPointCloud.material)) {
            currentPointCloud.material.forEach(m => m.dispose());
          } else if (currentPointCloud.material) {
            currentPointCloud.material.dispose();
          }
        }
        
        // Corrige orientação
        geometry.rotateY(Math.PI);
        
        // Otimize a geometria
        geometry.computeBoundingSphere();
        
        // Use um tamanho menor de ponto para melhor performance
        const pointMaterial = new THREE.PointsMaterial({
          size: 0.01,
          vertexColors: true,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.8
        });
        
        // Nova estratégia: Crie uma versão downsampled para melhor performance
        const simplifiedGeometry = downsampleGeometry(geometry, 0.5); // 50% dos pontos
        
        currentPointCloud = new THREE.Points(simplifiedGeometry, pointMaterial);
        currentPointCloud.name = 'point_cloud';
        currentPointCloud.visible = isDollhouseMode;
        
        scene.add(currentPointCloud);
        
        // Detecta nível do piso
        const floorLevel = detectFloorLevel();
        console.log('Piso detectado em:', floorLevel);
        
        showMessage('Nuvem de pontos carregada');
        if (callback) callback();
      },
      function(xhr) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        showMessage(`Carregando nuvem de pontos... ${percent}%`);
      },
      function(error) {
        console.error('Erro ao carregar nuvem de pontos:', error);
        if (callback) callback();
      }
    );
  }
  
  // Nova função para reduzir a quantidade de pontos na nuvem
  function downsampleGeometry(geometry, ratio) {
    // Se a razão for 1 ou não houver posições, retorne a original
    if (ratio >= 1 || !geometry.attributes.position) return geometry;
    
    // Obtenha os atributos originais
    const positions = geometry.attributes.position;
    const colors = geometry.attributes.color;
    const vertexCount = positions.count;
    
    // Calcule quantos vértices manter
    const keepCount = Math.max(100, Math.floor(vertexCount * ratio));
    
    // Crie novos buffers para os atributos
    const newPositions = new Float32Array(keepCount * 3);
    const newColors = colors ? new Float32Array(keepCount * 3) : null;
    
    // Amostragem estratificada - escolhe pontos em intervalos regulares
    const stride = Math.floor(vertexCount / keepCount);
    
    for (let i = 0; i < keepCount; i++) {
      const srcIdx = Math.min(i * stride, vertexCount - 1);
      
      // Copie a posição
      newPositions[i * 3] = positions.array[srcIdx * 3];
      newPositions[i * 3 + 1] = positions.array[srcIdx * 3 + 1];
      newPositions[i * 3 + 2] = positions.array[srcIdx * 3 + 2];
      
      // Copie a cor, se existir
      if (newColors && colors) {
        newColors[i * 3] = colors.array[srcIdx * 3];
        newColors[i * 3 + 1] = colors.array[srcIdx * 3 + 1];
        newColors[i * 3 + 2] = colors.array[srcIdx * 3 + 2];
      }
    }
    
    // Crie uma nova geometria
    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
    
    if (newColors) {
      newGeometry.setAttribute('color', new THREE.BufferAttribute(newColors, 3));
    }
    
    console.log(`Reduzido de ${vertexCount} para ${keepCount} pontos (${Math.round(ratio * 100)}%)`);
    
    return newGeometry;
  }
  
  // Função para criar um modelo 3D básico
  function createBasicModel() {
    // Remove nuvem de pontos anterior se existir
    if (currentPointCloud) {
      scene.remove(currentPointCloud);
    }
    
    // Cria um modelo 3D básico (uma sala simples)
    const roomGroup = new THREE.Group();
    roomGroup.name = 'basic_model';
    
    // Piso
    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xCCCCCC });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    roomGroup.add(floor);
    
    // Paredes
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
    
    // Parede 1
    const wall1Geometry = new THREE.PlaneGeometry(10, 3);
    const wall1 = new THREE.Mesh(wall1Geometry, wallMaterial);
    wall1.position.z = -5;
    wall1.position.y = 1.5;
    roomGroup.add(wall1);
    
    // Parede 2
    const wall2Geometry = new THREE.PlaneGeometry(10, 3);
    const wall2 = new THREE.Mesh(wall2Geometry, wallMaterial);
    wall2.position.z = 5;
    wall2.position.y = 1.5;
    wall2.rotation.y = Math.PI;
    roomGroup.add(wall2);
    
    // Parede 3
    const wall3Geometry = new THREE.PlaneGeometry(10, 3);
    const wall3 = new THREE.Mesh(wall3Geometry, wallMaterial);
    wall3.position.x = -5;
    wall3.position.y = 1.5;
    wall3.rotation.y = Math.PI / 2;
    roomGroup.add(wall3);
    
    // Parede 4
    const wall4Geometry = new THREE.PlaneGeometry(10, 3);
    const wall4 = new THREE.Mesh(wall4Geometry, wallMaterial);
    wall4.position.x = 5;
    wall4.position.y = 1.5;
    wall4.rotation.y = -Math.PI / 2;
    roomGroup.add(wall4);
    
    // Adiciona à cena
    scene.add(roomGroup);
    currentPointCloud = roomGroup;
    
    showMessage('Modelo 3D básico criado (dados reais não encontrados)');
  }
  
  // Função melhorada para carregar e exibir a planta baixa
  function loadFloorPlan(floorPlanUrl, callback) {
    if (!floorPlanUrl) {
      console.warn('URL da planta baixa não fornecida');
      if (callback) callback();
      return;
    }
    
    console.log('Carregando planta baixa:', floorPlanUrl);
    
    const img = new Image();
    img.onload = function() {
      floorPlanElement.innerHTML = '';
      floorPlanElement.appendChild(img);
      
      // Cria um botão de ampliação da planta
      const expandBtn = document.createElement('button');
      expandBtn.className = 'expand-floor-plan-btn';
      expandBtn.innerHTML = '🔍';
      expandBtn.title = 'Ampliar planta baixa';
      floorPlanElement.appendChild(expandBtn);
      
      // Adiciona evento para ampliar a planta
      expandBtn.addEventListener('click', function() {
        toggleExpandedFloorPlan(floorPlanUrl);
      });
      
      showMessage('Planta baixa carregada');
      if (callback) callback();
    };
    
    img.onerror = function() {
      console.error('Erro ao carregar planta baixa:', floorPlanUrl);
      if (callback) callback();
    };
    
    img.src = floorPlanUrl;
  }
  
  // Nova função para mostrar a planta baixa ampliada com navegação
  function toggleExpandedFloorPlan(floorPlanUrl) {
    // Remove diálogo existente se houver
    const existingDialog = document.getElementById('expanded-floor-plan');
    if (existingDialog) {
      document.body.removeChild(existingDialog);
      return;
    }
    
    // Cria o diálogo modal
    const dialog = document.createElement('div');
    dialog.id = 'expanded-floor-plan';
    dialog.className = 'expanded-floor-plan';
    
    // Adiciona o conteúdo
    dialog.innerHTML = `
      <div class="expanded-floor-plan-header">
        <h3>Planta Baixa</h3>
        <button class="close-btn">×</button>
      </div>
      <div class="expanded-floor-plan-content">
        <img src="${floorPlanUrl}" alt="Planta Baixa" />
        <div class="navigation-points"></div>
      </div>
      <div class="expanded-floor-plan-footer">
        Clique em um ponto na planta para navegar até ele
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Adiciona evento para fechar
    dialog.querySelector('.close-btn').addEventListener('click', function() {
      document.body.removeChild(dialog);
    });
    
    // Adiciona os pontos de navegação na planta
    const imgContainer = dialog.querySelector('.expanded-floor-plan-content');
    const img = dialog.querySelector('img');
    const pointsContainer = dialog.querySelector('.navigation-points');
    
    img.onload = function() {
      // Determina escala da imagem em relação à planta real
      const imageWidth = this.width;
      const imageHeight = this.height;
      
      // Adiciona pontos de navegação na planta ampliada
      scenes.forEach((sceneData, index) => {
        if (!sceneData.center) return;
        
        // Detecta limites da geometria da nuvem de pontos
        const floorLevel = detectFloorLevel();
        const [minX, maxX, minZ, maxZ] = getPointCloudBounds();
        
        // Calcula a posição na imagem
        const x = ((sceneData.center[0] - minX) / (maxX - minX)) * imageWidth;
        const y = ((sceneData.center[2] - minZ) / (maxZ - minZ)) * imageHeight;
        
        // Cria o ponto de navegação
        const navPoint = document.createElement('div');
        navPoint.className = 'floor-plan-nav-point';
        navPoint.dataset.sceneIndex = index;
        navPoint.style.left = `${x}px`;
        navPoint.style.top = `${y}px`;
        
        // Destaca o ponto atual
        if (index === currentSceneIndex) {
          navPoint.classList.add('current');
        }
        
        // Adiciona tooltip com nome da cena
        navPoint.title = sceneData.name;
        
        // Adiciona evento para navegar ao clicar
        navPoint.addEventListener('click', function() {
          navigateToScene(index);
          // Fecha o diálogo após navegação
          setTimeout(() => {
            const dialog = document.getElementById('expanded-floor-plan');
            if (dialog) document.body.removeChild(dialog);
          }, 500);
        });
        
        pointsContainer.appendChild(navPoint);
      });
    };
  }
  
  // Função auxiliar para obter limites da nuvem de pontos
  function getPointCloudBounds() {
    if (!currentPointCloud) return [-10, 10, -10, 10]; // Valores padrão
    
    // Obtém a geometria da nuvem de pontos
    const positions = currentPointCloud.geometry.getAttribute('position');
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    // Analisa todos os pontos para encontrar os limites
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    
    return [minX, maxX, minZ, maxZ];
  }
  
  // Adiciona pontos de navegação entre cenas
  function addNavigationPoints() {
    // Adiciona pontos de navegação para cada cena
    scenes.forEach((sceneData, index) => {
      if (index === currentSceneIndex || !sceneData.center) return;
      
      // Cria ponto de navegação
      const navPointGeometry = new THREE.SphereGeometry(0.3, 16, 16);
      const navPointMaterial = new THREE.MeshBasicMaterial({
        color: 0x3498db,
        transparent: true,
        opacity: 0.8
      });
      
      const navPoint = new THREE.Mesh(navPointGeometry, navPointMaterial);
      
      // Define posição baseada no centro da cena
      const position = new THREE.Vector3(...sceneData.center);
      navPoint.position.copy(position);
      
      // Metadados para identificação
      navPoint.userData = {
        type: 'navpoint',
        targetScene: index,
        name: sceneData.name
      };
      
      // Adiciona à cena
      scene.add(navPoint);
      
      // Adiciona textos flutuantes
      addFloatingText(position, sceneData.name);
    });
  }
  
  // Adiciona texto flutuante na cena
  function addFloatingText(position, text) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 128;
    
    // Configura texto
    context.font = 'Bold 24px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.fillText(text, 128, 64);
    
    // Cria textura e sprite
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.position.y += 0.5; // Posiciona um pouco acima do ponto
    sprite.scale.set(2, 1, 1);
    
    sprite.userData = {
      type: 'label'
    };
    
    scene.add(sprite);
  }
  
  // Posiciona a câmera na cena
  function positionCameraInScene(sceneData) {
    if (!sceneData.center) return;
    
    // Posição inicial baseada no centro da cena
    const center = new THREE.Vector3(...sceneData.center);
    
    // Define altura da câmera (1.6 metros)
    center.y = 1.6;
    
    // Define posição da câmera
    camera.position.copy(center);
    
    // Define alvo da câmera (olhando um pouco à frente)
    const target = center.clone();
    target.z -= 1; // Olhando para Z negativo (para frente)
    
    controls.target.copy(target);
    controls.update();
  }
  
  /*
   * Interação e modos de visualização
   */
  
  // Identificar objetos sob o cursor
  function getIntersectedObjects(event) {
    // Calcula posição do mouse em coordenadas normalizadas
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Configura o raycaster
    raycaster.setFromCamera(mouse, camera);
    
    // Obtém objetos interceptados
    return raycaster.intersectObjects(scene.children, true);
  }
  
  // Manipulador de clique
  function onDocumentClick(event) {
    event.preventDefault();
    
    // Não faz nada se estiver carregando
    if (isLoading()) return;
    
    const intersects = getIntersectedObjects(event);
    
    // Se estiver no modo de medição
    if (isMeasuring) {
      handleMeasurementClick(intersects);
      return;
    }
    
    // Se estiver no modo de tags
    if (isTagMode) {
      handleTagAddition(intersects);
      return;
    }
    
    // Navegação entre cenas
    handleNavPointClick(event);
  }
  
  // Manipulador de movimento do mouse
  function onDocumentMouseMove(event) {
    // Obtenha os objetos sob o cursor
    const intersects = getIntersectedObjects(event);
    
    // Atualiza o cursor conforme o objeto sob ele
    updateCursorStyle(intersects);
    
    // Atualiza a pré-visualização da medição, se estiver medindo
    if (isMeasuring && measurementPoints.length === 1) {
      updateMeasurementPreview(intersects);
    }
  }
  
  // Atualiza o estilo do cursor com base no que está sob ele
  function updateCursorStyle(intersects) {
    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;
      
      // Verifica o tipo de objeto e muda o cursor
      if (intersectedObject.userData && intersectedObject.userData.type === 'navpoint') {
        document.body.style.cursor = 'pointer';
        showTooltip(intersectedObject.userData.name, intersects[0].point);
      } else if (isMeasuring) {
        document.body.style.cursor = 'crosshair';
      } else if (isTagMode) {
        document.body.style.cursor = 'cell';
      } else {
        document.body.style.cursor = 'grab';
        hideTooltip();
      }
      
      // Destaca objeto ao passar o mouse
      if (intersectedObject !== hoverState.mesh) {
        if (hoverState.mesh) {
          // Remove destaque do objeto anterior
          if (hoverState.mesh.userData && hoverState.mesh.userData.type === 'navpoint') {
            hoverState.mesh.material.color.setHex(0x3498db);
            hoverState.mesh.scale.set(1, 1, 1);
          }
        }
        
        // Destaca o novo objeto
        if (intersectedObject.userData && intersectedObject.userData.type === 'navpoint') {
          intersectedObject.material.color.setHex(0xf39c12);
          intersectedObject.scale.set(1.2, 1.2, 1.2);
          hoverState.mesh = intersectedObject;
        } else {
          hoverState.mesh = null;
        }
      }
    } else {
      document.body.style.cursor = 'auto';
      hideTooltip();
      
      // Remove destaque do objeto anterior se não estiver mais sob o cursor
      if (hoverState.mesh) {
        if (hoverState.mesh.userData && hoverState.mesh.userData.type === 'navpoint') {
          hoverState.mesh.material.color.setHex(0x3498db);
          hoverState.mesh.scale.set(1, 1, 1);
        }
        hoverState.mesh = null;
      }
    }
  }
  
  // Mostra tooltip com informação
  function showTooltip(text, position) {
    let tooltip = document.getElementById('tooltip');
    
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'tooltip';
      tooltip.className = 'tooltip';
      document.body.appendChild(tooltip);
    }
    
    tooltip.textContent = text;
    tooltip.style.opacity = '1';
    
    // Converte posição 3D para coordenadas de tela
    const vector = position.clone();
    vector.project(camera);
    
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
    
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y - 30}px`;
  }
  
  // Esconde tooltip
  function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
      tooltip.style.opacity = '0';
    }
  }
  
  // Atualiza labels posicionados na cena
  function updateLabelsPosition() {
    scene.children.forEach(object => {
      if (object.userData && object.userData.type === 'label') {
        // Sempre de frente para a câmera
        object.lookAt(camera.position);
      }
    });
  }
  
  // Navega para outra cena
  function navigateToScene(sceneIndex) {
    if (sceneIndex < 0 || sceneIndex >= scenes.length || sceneIndex === currentSceneIndex) {
      return;
    }
    
    const targetScene = scenes[sceneIndex];
    console.log(`Navegando para cena: ${targetScene.name}`);
    
    // Efeito de fade out/in para transição
    fadeOut(() => {
      // Carrega a nova cena
      loadScene(targetScene);
      currentSceneIndex = sceneIndex;
      
      // Quando a cena carregar, faz fade in
      setTimeout(() => {
        fadeIn();
        
        // Atualize a interface
        updateUIState();
        
        // Atualiza a lista de cenas no sidebar para destacar a atual
        updateScenesList();
      }, 500);
    });
  }
  
  // Adicione esta função para efeito fade out
  function fadeOut(callback) {
    const fadeOverlay = document.createElement('div');
    fadeOverlay.style.position = 'fixed';
    fadeOverlay.style.top = '0';
    fadeOverlay.style.left = '0';
    fadeOverlay.style.width = '100%';
    fadeOverlay.style.height = '100%';
    fadeOverlay.style.backgroundColor = 'black';
    fadeOverlay.style.opacity = '0';
    fadeOverlay.style.transition = 'opacity 0.5s';
    fadeOverlay.style.zIndex = '1000';
    document.body.appendChild(fadeOverlay);
    
    // Força o reflow para que a transição funcione
    void fadeOverlay.offsetWidth;
    
    fadeOverlay.style.opacity = '1';
    
    setTimeout(() => {
      if (callback) callback();
      // Não remove o overlay ainda, será usado para o fade in
    }, 500);
  }
  
  // Adicione esta função para efeito fade in
  function fadeIn() {
    const fadeOverlay = document.querySelector('div[style*="position: fixed"][style*="z-index: 1000"]');
    if (!fadeOverlay) return;
    
    fadeOverlay.style.opacity = '0';
    
    setTimeout(() => {
      if (fadeOverlay.parentNode) {
        fadeOverlay.parentNode.removeChild(fadeOverlay);
      }
    }, 500);
  }
  
  /*
   * Funcionalidades de medição
   */
  
  // Manipulador de clique para medição
  function handleMeasurementClick(intersects) {
    // Precisamos de interseções com a nuvem de pontos
    if (intersects.length === 0) return;
    
    // Pega o ponto de interseção
    const point = intersects[0].point.clone();
    
    // Adiciona ponto à lista de pontos de medição
    measurementPoints.push(point);
    
    // Se tivermos dois pontos, podemos calcular e exibir a distância
    if (measurementPoints.length === 2) {
      displayMeasurement();
    } else {
      showMessage('Clique no segundo ponto para medir a distância');
    }
  }
  
  // Atualiza a pré-visualização da linha de medição
  function updateMeasurementPreview(intersects) {
    if (measurementPoints.length !== 1 || intersects.length === 0) return;
    
    const startPoint = measurementPoints[0];
    const endPoint = intersects[0].point;
    
    // Se já temos uma linha de pré-visualização, atualizamos
    if (measurementPreview) {
      const positions = measurementPreview.geometry.attributes.position.array;
      positions[3] = endPoint.x;
      positions[4] = endPoint.y;
      positions[5] = endPoint.z;
      measurementPreview.geometry.attributes.position.needsUpdate = true;
      
      // Exibe distância em tempo real
      const distance = startPoint.distanceTo(endPoint);
      measureInfoElement.textContent = `Distância: ${distance.toFixed(2)} m`;
    } else {
      // Cria a linha de pré-visualização
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array([
        startPoint.x, startPoint.y, startPoint.z,
        endPoint.x, endPoint.y, endPoint.z
      ]);
      
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      
      const material = new THREE.LineBasicMaterial({
        color: 0xff0000,
        linewidth: 2,
        dashSize: 1,
        gapSize: 0.5
      });
      
      measurementPreview = new THREE.Line(geometry, material);
      scene.add(measurementPreview);
      
      // Exibe o elemento de informação de medição
      measureInfoElement.style.display = 'block';
    }
  }
  
  // Exibe a medição final
  function displayMeasurement() {
    // Remove a pré-visualização
    if (measurementPreview) {
      scene.remove(measurementPreview);
      measurementPreview = null;
    }
    
    // Remove a linha anterior se existir
    if (measurementLine) {
      scene.remove(measurementLine);
    }
    
    // Cria a linha de medição final
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      measurementPoints[0].x, measurementPoints[0].y, measurementPoints[0].z,
      measurementPoints[1].x, measurementPoints[1].y, measurementPoints[1].z
    ]);
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      linewidth: 3
    });
    
    measurementLine = new THREE.Line(geometry, material);
    scene.add(measurementLine);
    
    // Calcula e exibe a distância
    const distance = measurementPoints[0].distanceTo(measurementPoints[1]);
    measureInfoElement.textContent = `Distância: ${distance.toFixed(2)} m`;
    
    // Adiciona esferas nos pontos de medição
    addMeasurementPoints();
    
    // Limpa os pontos para próxima medição
    measurementPoints = [];
  }
  
  // Adiciona esferas nos pontos de medição
  function addMeasurementPoints() {
    measurementPoints.forEach(point => {
      const geometry = new THREE.SphereGeometry(0.05, 16, 16);
      const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.copy(point);
      scene.add(sphere);
    });
  }
  
  /*
   * Funcionalidades de tags/anotações
   */
  
  // Adiciona uma tag/anotação em um ponto
  function handleTagAddition(intersects) {
    if (intersects.length === 0) return;
    
    const point = intersects[0].point.clone();
    
    // Cria um modal para inserir informações da tag
    const tagInfo = prompt('Descrição da anotação:');
    if (!tagInfo) return;
    
    addTag(point, tagInfo);
  }
  
  // Adiciona uma tag/anotação na cena
  function addTag(position, info) {
    // Cria elemento DOM para a tag
    const tagElement = document.createElement('div');
    tagElement.className = 'tag';
    tagElement.innerHTML = '📌';
    
    // Adiciona tooltip com a informação
    const tagInfoElement = document.createElement('div');
    tagInfoElement.className = 'tag-info';
    tagInfoElement.textContent = info;
    tagElement.appendChild(tagInfoElement);
    
    document.body.appendChild(tagElement);
    
    // Cria o objeto 3D para a tag (esfera invisível para raycasting)
    const tagGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const tagMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0
    });
    
    const tagMesh = new THREE.Mesh(tagGeometry, tagMaterial);
    tagMesh.position.copy(position);
    tagMesh.userData = {
      type: 'tag',
      info: info,
      element: tagElement
    };
    
    scene.add(tagMesh);
    
    // Adiciona a tag à lista
    tags.push({
      mesh: tagMesh,
      element: tagElement,
      position: position.clone(),
      info: info
    });
    
    // Posiciona o elemento DOM
    updateTagPosition(tagMesh);
    
    showMessage('Anotação adicionada');
  }
  
  // Atualiza a posição das tags na tela
  function updateTagPosition(tagMesh) {
    const vector = tagMesh.position.clone();
    vector.project(camera);
    
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
    
    const tagElement = tagMesh.userData.element;
    tagElement.style.left = `${x - 20}px`; // Centraliza (40px / 2)
    tagElement.style.top = `${y - 20}px`; // Centraliza (40px / 2)
    
    // Verifica se está visível na cena (não atrás da câmera)
    const dot = camera.position.clone().sub(tagMesh.position).normalize().dot(camera.getWorldDirection(new THREE.Vector3()));
    
    // Se o ponto estiver atrás da câmera ou muito longe, oculta
    if (dot > 0 || vector.z > 1) {
      tagElement.style.display = 'none';
    } else {
      tagElement.style.display = 'flex';
    }
  }
  
  // Atualiza a posição de todas as tags
  function updateAllTagPositions() {
    tags.forEach(tag => {
      updateTagPosition(tag.mesh);
    });
  }
  
  /*
   * Modos de visualização
   */
  
  // Alterna o modo de medição
  function toggleMeasureMode() {
    isMeasuring = !isMeasuring;
    
    if (isMeasuring) {
      // Desativa outros modos
      isTagMode = false;
      
      // Limpa pontos de medição anteriores
      measurementPoints = [];
      
      // Remove linha anterior
      if (measurementLine) {
        scene.remove(measurementLine);
        measurementLine = null;
      }
      
      // Remove pré-visualização
      if (measurementPreview) {
        scene.remove(measurementPreview);
        measurementPreview = null;
      }
      
      // Exibe mensagem de instrução
      showMessage('Modo de medição ativado. Clique em dois pontos para medir a distância.');
      measureInfoElement.textContent = 'Clique no primeiro ponto';
      measureInfoElement.style.display = 'block';
    } else {
      // Esconde a informação de medição
      measureInfoElement.style.display = 'none';
      
      // Remove pré-visualização
      if (measurementPreview) {
        scene.remove(measurementPreview);
        measurementPreview = null;
      }
      
      showMessage('Modo de medição desativado');
    }
    
    updateUIState();
  }
  
  // Alterna o modo de adição de tags
  function toggleTagMode() {
    isTagMode = !isTagMode;
    
    if (isTagMode) {
      // Desativa outros modos
      isMeasuring = false;
      
      showMessage('Modo de anotação ativado. Clique para adicionar uma anotação.');
    } else {
      showMessage('Modo de anotação desativado');
    }
    
    updateUIState();
  }
  
  // Alterna a visualização da planta baixa
  function toggleFloorPlan() {
    isFloorPlanVisible = !isFloorPlanVisible;
    
    if (isFloorPlanVisible) {
      // Mostra a planta baixa
      floorPlanElement.style.display = 'block';
      
      // Recarrega a planta baixa atual se existir
      if (currentSceneData && currentSceneData.files && currentSceneData.files.floor_plan) {
        loadFloorPlan(currentSceneData.files.floor_plan);
      } else {
        showMessage('Planta baixa não disponível para esta cena');
        isFloorPlanVisible = false;
        floorPlanElement.style.display = 'none';
      }
      
      document.getElementById('btn-floorplan').classList.add('active');
    } else {
      // Esconde a planta baixa
      floorPlanElement.style.display = 'none';
      document.getElementById('btn-floorplan').classList.remove('active');
    }
    
    updateUIState();
  }
  
  // Alterna a vista doll house
  function toggleDollhouseMode() {
    isDollhouseMode = !isDollhouseMode;
    
    // Detecta o nível do piso
    const floorLevel = detectFloorLevel();
    
    if (isDollhouseMode) {
      // Modo dollhouse - mostra a nuvem de pontos completa
      if (panoramaSphere) {
        panoramaSphere.visible = false;
      }
      
      if (currentPointCloud) {
        currentPointCloud.visible = true;
      }
      
      // Guarda posição atual para poder voltar
      savedCameraPosition = {
        position: camera.position.clone(),
        target: controls.target.clone()
      };
      
      // Posição de câmera para vista de cima (semelhante ao Matterport)
      const centerScene = currentSceneData?.center || [0, 0, 0];
      
      // Anima para a posição aérea - usa o nível do piso como referência
      const targetPos = new THREE.Vector3(centerScene[0], floorLevel + 15, centerScene[2]);
      const targetTarget = new THREE.Vector3(centerScene[0], floorLevel, centerScene[2]);
      
      animateCameraMovement(camera.position, targetPos, controls.target, targetTarget, 1000);
      
      // Ajusta controles para mais liberdade no modo dollhouse
      controls.minPolarAngle = 0; // Permite olhar diretamente para baixo
      controls.maxDistance = 50;  // Permite afastar mais
      
      showMessage('Modo Dollhouse Ativado');
    } else {
      // Volta ao modo normal - foca nas panorâmicas
      if (panoramaSphere) {
        panoramaSphere.visible = true;
      }
      
      if (currentPointCloud) {
        currentPointCloud.visible = false;
      }
      
      // Restaura posição anterior usando a função animateCameraMovement
      if (savedCameraPosition) {
        animateCameraMovement(
          camera.position,
          savedCameraPosition.position,
          controls.target,
          savedCameraPosition.target,
          1000
        );
      }
      
      // Restaura limitações de controles
      controls.minPolarAngle = Math.PI * 0.1;
      controls.maxDistance = 10;
      
      showMessage('Modo Normal Ativado');
    }
    
    updateUIState();
  }
  
  // Inicia/para o tour automático
  function toggleAutoTour() {
    autoTourActive = !autoTourActive;
    
    if (autoTourActive) {
      startAutoTour();
      showMessage('Tour automático iniciado');
    } else {
      stopAutoTour();
      showMessage('Tour automático parado');
    }
    
    updateUIState();
  }
  
  // Inicia o tour automático
  function startAutoTour() {
    let currentTourSceneIndex = 0;
    
    // Navega para a próxima cena a cada intervalo
    autoTourInterval = setInterval(() => {
      currentTourSceneIndex = (currentTourSceneIndex + 1) % scenes.length;
      navigateToScene(currentTourSceneIndex);
    }, 10000); // 10 segundos por cena
  }
  
  // Para o tour automático
  function stopAutoTour() {
    if (autoTourInterval) {
      clearInterval(autoTourInterval);
      autoTourInterval = null;
    }
    autoTourActive = false;
  }
  
  /*
   * Utilitários de UI
   */
  
  // Atualiza o estado visual dos botões da UI
  function updateUIState() {
    // Atualiza botão de medição
    const measureBtn = document.getElementById('btn-measure');
    if (isMeasuring) {
      measureBtn.classList.add('active');
    } else {
      measureBtn.classList.remove('active');
    }
    
    // Atualiza botão de tags
    const tagsBtn = document.getElementById('btn-tags');
    if (isTagMode) {
      tagsBtn.classList.add('active');
    } else {
      tagsBtn.classList.remove('active');
    }
    
    // Atualiza botão de doll house
    const dollhouseBtn = document.getElementById('btn-dollhouse');
    if (isDollhouseMode) {
      dollhouseBtn.classList.add('active');
    } else {
      dollhouseBtn.classList.remove('active');
    }
    
    // Atualiza botão de planta baixa
    const floorplanBtn = document.getElementById('btn-floorplan');
    if (isFloorPlanVisible) {
      floorplanBtn.classList.add('active');
    } else {
      floorplanBtn.classList.remove('active');
    }
    
    // Atualiza botão de tour
    const tourBtn = document.getElementById('btn-tour');
    if (autoTourActive) {
      tourBtn.classList.add('active');
    } else {
      tourBtn.classList.remove('active');
    }
  }
  
  // Exibe uma mensagem informativa
  function showMessage(text) {
    infoElement.textContent = text;
    infoElement.style.opacity = '1';
    
    // Esconde a mensagem após 3 segundos
    setTimeout(() => {
      infoElement.style.opacity = '0.7';
    }, 3000);
  }
  
  // Controla a exibição do overlay de carregamento
  function showLoading(show) {
    console.log('showLoading chamado com:', show);
    
    if (show) {
      console.log('Mostrando tela de carregamento');
      if (!loadingOverlay) {
        console.error('Elemento loadingOverlay não encontrado!');
        return;
      }
      
      loadingOverlay.style.display = 'flex';
      loadingOverlay.style.opacity = '1';
      
      // Timeout de segurança - após 8 segundos, remove a tela de carregamento
      setTimeout(() => {
        if (loadingOverlay.style.display === 'flex') {
          console.warn('Timeout de carregamento - forçando saída do estado de carregamento');
          loadingOverlay.style.opacity = '0';
          setTimeout(() => {
            loadingOverlay.style.display = 'none';
            
            // Verifica se já existe um objeto na cena, caso contrário cria uma demo
            const existingObjects = scene.children.filter(child => 
              child.type === 'Mesh' || child.type === 'Points'
            );
            
            if (existingObjects.length === 0) {
              console.log('Nenhum objeto na cena, criando demo');
              createDemoScene();
            } else {
              console.log('Objetos existentes na cena:', existingObjects.length);
            }
          }, 500);
        }
      }, 8000);
    } else {
      console.log('Escondendo tela de carregamento');
      if (!loadingOverlay) {
        console.error('Elemento loadingOverlay não encontrado!');
        return;
      }
      
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 500);
    }
  }
  
  // Verifica se está carregando
  function isLoading() {
    return loadingOverlay.style.display !== 'none' && loadingOverlay.style.opacity !== '0';
  }
  
  // Função para criar uma cena de demonstração em caso de erro
  function createDemoScene() {
    console.log('Criando cena demo como fallback...');
    
    // Cria uma cena demo
    const demoScene = {
      name: 'Demo',
      center: [0, 0, 0],
      files: {
        panorama: '/demo_panorama.jpg'
      }
    };
    
    // Carrega a cena demo
    loadScene(demoScene);
    
    // Atualiza variáveis de estado
    scenes = [demoScene];
    currentSceneIndex = 0;
    
    // Popula o menu
    populateScenesMenu(scenes);
  }

  // Adiciona esta função para criar os círculos de navegação no estilo Matterport
  function createNavigationPoints() {
    console.log('Criando pontos de navegação estilo Matterport');
    
    // Remove pontos de navegação existentes
    scene.children.forEach(child => {
      if (child.userData && child.userData.type === 'navpoint') {
        scene.remove(child);
      }
    });
    
    // Detecta o nível do piso
    const floorLevel = detectFloorLevel();
    
    // Cria círculos para cada cena disponível
    scenes.forEach((sceneData, index) => {
      if (index === currentSceneIndex) return; // Não cria ponto para a cena atual
      
      // Verifica se a cena tem coordenadas
      if (!sceneData.center) return;
      
      // Cria um círculo no chão (similar ao Matterport)
      const circleGeometry = new THREE.CircleGeometry(0.4, 32);
      const circleMaterial = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
      });
      
      const navCircle = new THREE.Mesh(circleGeometry, circleMaterial);
      
      // Roda o círculo para ficar horizontal (no chão)
      navCircle.rotation.x = -Math.PI / 2;
      
      // Posiciona o círculo no NÍVEL DO PISO DETECTADO
      const position = new THREE.Vector3(
        sceneData.center[0],
        floorLevel + 0.01, // Ligeiramente acima do piso para evitar z-fighting
        sceneData.center[2]
      );
      navCircle.position.copy(position);
      
      // Adiciona metadados
      navCircle.userData = {
        type: 'navpoint',
        targetScene: index,
        name: sceneData.name
      };
      
      // Adiciona à cena
      scene.add(navCircle);
      
      // Adiciona texto com o nome da cena
      const textSprite = createTextSprite(sceneData.name);
      textSprite.position.set(position.x, position.y + 0.5, position.z);
      scene.add(textSprite);
    });
  }

  // Função para criar texto flutuante
  function createTextSprite(message) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 128;
    
    context.font = "Bold 24px Arial";
    context.fillStyle = "rgba(255,255,255,0.95)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.fillStyle = "rgba(0,0,0,0.8)";
    context.textAlign = "center";
    context.fillText(message, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2, 1, 1);
    
    return sprite;
  }

  // Adicione esta função para detectar o nível do piso automaticamente
  function detectFloorLevel() {
    if (!currentPointCloud) return 0;
    
    const positions = currentPointCloud.geometry.getAttribute('position');
    
    // Em vez de processar todos os pontos, usamos amostragem
    const sampleSize = Math.min(1000, positions.count);
    const step = Math.floor(positions.count / sampleSize);
    
    let yValues = [];
    
    for (let i = 0; i < positions.count; i += step) {
      yValues.push(positions.getY(i));
    }
    
    // Ordena os valores de Y
    yValues.sort((a, b) => a - b);
    
    // Pega o valor de 5% mais baixo como nível do piso
    const floorIndex = Math.floor(yValues.length * 0.05);
    return yValues[floorIndex];
  }

  // Função para resetar a visualização para a posição inicial
  function resetView() {
    const floorLevel = detectFloorLevel();
    const centerScene = currentSceneData?.center || [0, 0, 0];
    
    // Posição padrão: altura dos olhos, olhando para frente
    const targetPos = new THREE.Vector3(centerScene[0], floorLevel + 1.6, centerScene[2]);
    const targetTarget = new THREE.Vector3(centerScene[0], floorLevel + 1.6, centerScene[2] - 1);
    
    animateCameraMovement(camera.position, targetPos, controls.target, targetTarget, 1000);
    
    showMessage('Visualização resetada');
  }

  // Adicione esta função para atualizar a lista de cenas no sidebar
  function updateScenesList() {
    populateScenesMenu(scenes);
  }

  // Adicione esta função para criar um elemento para exibir os logs
  function setupDebugUI() {
    const debugDiv = document.createElement('div');
    debugDiv.id = 'debug-log';
    debugDiv.style.position = 'absolute';
    debugDiv.style.top = '10px';
    debugDiv.style.right = '10px';
    debugDiv.style.width = '300px';
    debugDiv.style.height = '200px';
    debugDiv.style.background = 'rgba(0,0,0,0.7)';
    debugDiv.style.color = '#fff';
    debugDiv.style.padding = '10px';
    debugDiv.style.fontSize = '12px';
    debugDiv.style.overflow = 'auto';
    debugDiv.style.zIndex = '100';
    debugDiv.style.fontFamily = 'monospace';
    debugDiv.style.borderRadius = '5px';
    document.body.appendChild(debugDiv);
    
    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'Debug';
    toggleButton.style.position = 'absolute';
    toggleButton.style.top = '10px';
    toggleButton.style.right = '320px';
    toggleButton.style.zIndex = '100';
    toggleButton.style.padding = '5px 10px';
    toggleButton.onclick = () => {
      debugDiv.style.display = debugDiv.style.display === 'none' ? 'block' : 'none';
    };
    document.body.appendChild(toggleButton);
  }

  // Adicione esta função para criar um elemento para exibir os logs
  function logDebug(message, data) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
    if (data !== undefined) console.log(data);
    
    // Adiciona ao elemento de log na tela se existir
    const debugElement = document.getElementById('debug-log');
    if (debugElement) {
      const item = document.createElement('div');
      item.textContent = `[${timestamp}] ${message}`;
      debugElement.appendChild(item);
      debugElement.scrollTop = debugElement.scrollHeight;
    }
  }

  // Adicione esta função que está faltando - causando o erro animateCameraMovement
  function animateCameraMovement(startPos, endPos, startTarget, endTarget, duration) {
    const startTime = Date.now();
    
    function animate() {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Função de easing para movimento mais natural
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      // Interpola posição da câmera
      camera.position.lerpVectors(startPos, endPos, easeProgress);
      
      // Interpola alvo dos controles
      controls.target.lerpVectors(startTarget, endTarget, easeProgress);
      controls.update();
      
      // Continua a animação se não terminou
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }
    
    animate();
  }

  // Adicione esta função que está faltando - causando o erro handleNavPointClick
  function handleNavPointClick(event) {
    // Calcula coordenadas normalizadas do mouse (-1 a 1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Atualiza o raycaster com a posição do mouse
    raycaster.setFromCamera(mouse, camera);
    
    // Obtém objetos que intersectam com o raio
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    // Verifica se algum ponto de navegação foi clicado
    for (let i = 0; i < intersects.length; i++) {
      const object = intersects[i].object;
      if (object.userData && object.userData.type === 'navpoint') {
        console.log(`Ponto de navegação clicado: ${object.userData.name}`);
        navigateToScene(object.userData.targetScene);
        return;
      }
    }
  }

  // Nova função para mostrar tela vazia com instruções
  function showEmptySceneMessage() {
    // Limpa qualquer cena existente
    clearScene();
    
    // Adiciona texto na interface
    infoElement.textContent = 'Nenhuma cena disponível';
    
    // Cria um elemento com instruções
    const instrucDiv = document.createElement('div');
    instrucDiv.className = 'instructions-overlay';
    instrucDiv.innerHTML = `
      <div class="instructions-box">
        <h2>Bem-vindo ao Visualizador 3D</h2>
        <p>Nenhuma cena foi encontrada. Para começar:</p>
        <ol>
          <li>Coloque suas nuvens de pontos na pasta 'output'</li>
          <li>Coloque suas panorâmicas na pasta 'input/panorama'</li>
          <li>Coloque seus TrueViews na pasta 'input/trueview'</li>
          <li>Reinicie o aplicativo</li>
        </ol>
      </div>
    `;
    
    document.body.appendChild(instrucDiv);
  }

  // Nova função para mostrar mensagem de erro
  function showErrorMessage() {
    // Limpa qualquer cena existente
    clearScene();
    
    // Adiciona texto na interface
    infoElement.textContent = 'Erro de carregamento';
    
    // Cria um elemento com a mensagem de erro
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-overlay';
    errorDiv.innerHTML = `
      <div class="error-box">
        <h2>Erro de Conexão</h2>
        <p>Não foi possível carregar as cenas do servidor.</p>
        <button id="retry-btn">Tentar Novamente</button>
      </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Adiciona evento para tentar novamente
    document.getElementById('retry-btn').addEventListener('click', function() {
      document.body.removeChild(errorDiv);
      loadScenes();
    });
  }

  console.log('main.js foi carregado e inicializado');
})();