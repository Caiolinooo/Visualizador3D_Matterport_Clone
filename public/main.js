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
 * 
 * INSTRUÇÕES PARA DEPURAÇÃO:
 * 1. Verifique a pasta output/ - deve conter pastas com arquivos output_cloud.ply
 * 2. Verifique a pasta input/panorama/ - deve conter imagens panorâmicas
 * 3. F12 para ver erros no console do navegador
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
  
  // Adicione estas variáveis globais no início para controlar as nuvens múltiplas
  let pointClouds = []; // Array para armazenar todas as nuvens carregadas
  let unifiedMode = true; // Modo unificado por padrão (todas as nuvens visíveis)
  
  // Adicione estas variáveis globais para o mini-mapa
  let miniMap = null;
  let miniMapCamera = null;
  let miniMapControls = null;
  let userPositionMarker = null;
  let miniMapContainer = null;
  let isMiniMapVisible = true;
  
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
    
    // Adicione chamada para o mini-mapa
    setupMiniMap();
    
    // Adiciona recursos de compartilhamento
    setupShareFeatures();
    
    // Adiciona suporte para incorporação
    setupEmbedFeatures();
    
    // Aplica estilo visual do Matterport
    setupMatterportStyle();
    
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
    
    // Fundo preto para o modo dollhouse, mas transparente para o modo panorama
    scene.background = new THREE.Color(0x000000);
    
    // Adiciona névoa para dar profundidade à cena
    scene.fog = new THREE.FogExp2(0x000000, 0.00025);
    
    console.log('Cena configurada com iluminação e névoa para profundidade');
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
    // Luz ambiente suave
    const ambientLight = new THREE.AmbientLight(0x404040, 1.0);
    scene.add(ambientLight);
    
    // Luz direcional principal (sol)
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(1, 1, 0.5);
    scene.add(mainLight);
    
    // Luz direcional secundária para preencher sombras
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-1, 0.5, -0.5);
    scene.add(fillLight);
    
    // Luz hemisférica para simular luz de ambiente
    const hemiLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
    scene.add(hemiLight);
    
    console.log('Iluminação aprimorada configurada');
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
        try {
          // Mantém a altura da câmera igual à altura dos olhos
          const floorLevel = detectFloorLevel();
          // Verifica se floorLevel é um número válido
          if (typeof floorLevel === 'number' && !isNaN(floorLevel)) {
            camera.position.y = floorLevel + 1.6; // 1.6m = altura média dos olhos
          }
        } catch (error) {
          console.warn("Erro ao ajustar altura da câmera:", error);
          // Mantém a altura padrão em caso de erro
          camera.position.y = 1.6;
        }
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
        // Processa o evento do mouse corretamente antes de chamar handleTagAddition
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Configura o raycaster
        raycaster.setFromCamera(mouse, camera);
        
        // Calcula intersecções
        const intersects = raycaster.intersectObjects(scene.children, true);
        
        // Agora chama com as intersecções calculadas
        handleTagAddition(intersects);
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
    
    // Busca o painel de controle uma única vez
    const controlPanel = document.querySelector('.control-panel');
    
    // Adiciona o botão voltar ao painel de controle
    if (controlPanel) {
      // Cria o botão voltar
      const backButton = document.createElement('button');
      backButton.id = 'back-button';
      backButton.className = 'btn disabled';
      backButton.title = 'Voltar para a cena anterior';
      backButton.innerHTML = '⬅️'; // Emoji de seta para esquerda
      backButton.disabled = true; // Inicia desabilitado
      backButton.addEventListener('click', navigateBack);
      
      // Insere o botão no início do painel
      controlPanel.insertBefore(backButton, controlPanel.firstChild);
    } else {
      console.warn('Painel de controle não encontrado para adicionar botão voltar');
    }
    
    // Atualizando estado inicial da UI
    updateUIState();
    
    console.log('UI inicializada, botões conectados');
    
    // Adiciona botão para alternar entre modo unificado e cena única
    const unifiedButton = document.createElement('button');
    unifiedButton.textContent = 'Alternar Modo Unificado';
    unifiedButton.className = 'btn';
    unifiedButton.title = 'Alternar Modo Unificado';
    unifiedButton.innerHTML = '🌐'; // Ícone de globo para modo unificado
    unifiedButton.addEventListener('click', toggleUnifiedMode);

    // Usa o painel de controle já encontrado
    if (controlPanel) {
      // Se a control-panel existe, adiciona o botão diretamente a ela
      controlPanel.appendChild(unifiedButton);
    } else {
      // Se não existe um painel de controle, cria um div para o botão
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'unified-mode-container';
      buttonContainer.style.position = 'absolute';
      buttonContainer.style.top = '10px';
      buttonContainer.style.right = '10px';
      buttonContainer.style.zIndex = '100';
      
      buttonContainer.appendChild(unifiedButton);
      document.body.appendChild(buttonContainer);
    }
  }
  
  // Loop de animação
  function animate() {
    requestAnimationFrame(animate);
    
    try {
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
    } catch (error) {
      console.warn("Erro no loop de animação:", error);
      // Não interrompe o loop de animação em caso de erro
    }
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
        
        // Processa parâmetros da URL depois que as cenas foram carregadas
        processUrlParameters();
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
    // Verifica se os dados da cena são válidos antes de prosseguir
    if (!sceneData) {
      console.warn("Tentativa de carregar cena com dados nulos ou undefined");
      showMessage("Erro: Tentativa de carregar cena inválida");
      showLoading(false);
      return;
    }
    
    console.log('Carregando cena Matterport-style:', sceneData);
    console.log('Arquivos disponíveis na cena:', JSON.stringify(sceneData.files, null, 2));
    showLoading(true);
    
    // Guarda referência à cena atual
    currentSceneData = sceneData;
    
    // SOMENTE limpa elementos que não são reutilizáveis (não limpa nuvens de pontos no modo unificado)
    clearScenePartial();
    
    // Quantos itens precisamos carregar
    const itemsToLoad = Object.keys(sceneData.files || {}).length;
    let itemsLoaded = 0;
    
    // Função para atualizar progresso
    const updateProgress = () => {
      itemsLoaded++;
      const percent = Math.round((itemsLoaded / itemsToLoad) * 100);
      showMessage(`Carregando cena: ${percent}%`);
      if (itemsLoaded >= itemsToLoad) {
        showLoading(false);
        showMessage(`Cena "${sceneData.name}" carregada`);
        
        // Após carregar a cena, cria pontos de navegação para outras cenas
        if (scenes && scenes.length > 1) {
          console.log('Criando pontos de navegação entre cenas');
          createNavigationPoints();
        }
        
        // Posiciona a câmera corretamente na cena atual
        positionCameraInScene(sceneData);
        
        // Atualiza o mini-mapa com a nova cena
        updateMiniMapForScene(sceneData);
      }
    };
    
    // Carrega a panorâmica se disponível
    if (sceneData.files && sceneData.files.panorama) {
      console.log('Tentando carregar panorâmica:', sceneData.files.panorama);
      loadPanorama(sceneData.files.panorama, () => {
        console.log('Panorâmica carregada com sucesso');
        updateProgress();
      }, (error) => {
        console.error('Erro ao carregar panorâmica:', error);
        updateProgress();
      });
    } else if (sceneData.files && sceneData.files.cubemap) {
      console.log('Tentando carregar cubemap:', sceneData.files.cubemap);
      loadCubemap(sceneData.files.cubemap, () => {
        console.log('Cubemap carregado com sucesso');
        updateProgress();
      }, (error) => {
        console.error('Erro ao carregar cubemap:', error);
        updateProgress();
      });
    } else {
      console.warn('Nenhuma panorâmica ou cubemap disponível para esta cena');
    }
    
    // Carrega nuvem de pontos (se disponível)
    if (sceneData.files && sceneData.files.cloud) {
      console.log('Tentando carregar nuvem de pontos:', sceneData.files.cloud);
      
      // Verifica se já carregamos esta nuvem antes (para o modo unificado)
      const existingCloud = pointClouds.find(pc => pc.userData.url === sceneData.files.cloud);
      
      if (existingCloud) {
        console.log('Nuvem já carregada anteriormente, reutilizando');
        // Se já existe, apenas atualiza a visibilidade
        if (!unifiedMode) {
          pointClouds.forEach(cloud => {
            cloud.visible = (cloud.userData.url === sceneData.files.cloud);
          });
        }
        updateProgress();
      } else {
        // Se não existe, carrega nova nuvem
        loadPointCloud(sceneData.files.cloud, sceneData.center, () => {
          console.log('Nuvem de pontos carregada com sucesso');
          updateProgress();
        }, (error) => {
          console.error('Erro ao carregar nuvem de pontos:', error);
          updateProgress();
        });
      }
    }
    
    // Carrega planta baixa (se disponível)
    if (sceneData.files && sceneData.files.floor_plan) {
      console.log('Tentando carregar planta baixa:', sceneData.files.floor_plan);
      loadFloorPlan(sceneData.files.floor_plan, () => {
        console.log('Planta baixa carregada com sucesso');
        updateProgress();
      }, (error) => {
        console.error('Erro ao carregar planta baixa:', error);
        updateProgress();
      });
    }
    
    // Se não há nada para carregar, encerra o carregamento
    if (itemsToLoad === 0) {
      console.warn('Nenhum dado para carregar nesta cena');
      createBasicModel();
      showLoading(false);
      showMessage('Nenhum dado disponível para esta cena');
    }
    
    // Adiciona um timeout de segurança para sair do carregamento se algo der errado
    setTimeout(() => {
      if (isLoading()) {
        console.warn('Timeout de carregamento - forçando saída do estado de carregamento');
        showLoading(false);
      }
    }, 15000); // 15 segundos
  }
  
  // Nova função que limpa apenas parte da cena, preservando as nuvens de pontos no modo unificado
  function clearScenePartial() {
    // Remove todos os objetos 3D da cena EXCETO as nuvens de pontos em modo unificado
    for (let i = scene.children.length - 1; i >= 0; i--) {
      const object = scene.children[i];
      
      // Pula as nuvens de pontos se estiver em modo unificado
      if (unifiedMode && object.userData && object.userData.type === 'pointcloud') {
        continue;
      }
      
      // Limpa geometrias e materiais para evitar vazamento de memória
      if (object.geometry) {
        object.geometry.dispose();
      }
      
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
      
      scene.remove(object);
    }
    
    // Limpa referências específicas
    panoramaSphere = null;
    
    // Apenas limpa a referência à nuvem atual se NÃO estiver em modo unificado
    if (!unifiedMode) {
      currentPointCloud = null;
    }
    
    // Reseta medições
    measurementPoints = [];
    if (measurementLine) {
      if (measurementLine.geometry) measurementLine.geometry.dispose();
      if (measurementLine.material) measurementLine.material.dispose();
      measurementLine = null;
    }
    
    if (measurementPreview) {
      if (measurementPreview.geometry) measurementPreview.geometry.dispose();
      if (measurementPreview.material) measurementPreview.material.dispose();
      measurementPreview = null;
    }
    
    // Limpa tags
    tags = [];
    
    console.log('Cena parcialmente limpa, preservando nuvens em modo unificado');
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
  
  // Função melhorada para carregar panorama estilo Matterport
  function loadPanorama(panoramaData, callback, errorCallback) {
    if (!panoramaData) {
      console.warn('Dados de panorama não fornecidos, carregando demo');
      loadDemoPanorama(callback, errorCallback);
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
    
    // Ajusta a visibilidade e a transparência da nuvem de pontos
    // No modo panorâmico, a nuvem pode ser visível com transparência para orientação
    if (pointClouds && pointClouds.length > 0) {
      pointClouds.forEach(cloud => {
        // Ajusta a transparência para ser mais sutil em modo panorâmico
        if (cloud.material) {
          cloud.material.opacity = 0.15; // Mais transparente em modo panorâmico
          cloud.material.visible = true;
        }
      });
    }
    
    // Carrega panorâmica equiretangular com HDR para melhor qualidade
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      panoramaData,
      function(texture) {
        // Aplicar correções para melhor qualidade visual
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.format = THREE.RGBAFormat;
        
        // Aumentar a nitidez da textura
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        
        // Ajustar gamma para cores mais naturais
        texture.encoding = THREE.sRGBEncoding;
        
        // Criar material especial para a panorâmica com estilo Matterport
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide,
          transparent: false,
          depthWrite: false,
          depthTest: false
        });
        
        // Cria uma esfera para a panorâmica com tamanho adequado
        // Raio maior para detalhe e qualidade
        const geometry = new THREE.SphereGeometry(20, 128, 64);
        
        // Cria o Mesh
        panoramaSphere = new THREE.Mesh(geometry, material);
        panoramaSphere.name = 'panorama';
        panoramaSphere.renderOrder = -1; // Renderiza antes de outros objetos
        panoramaSphere.rotation.y = Math.PI; // Corrige orientação da panorâmica
        
        // Posiciona a esfera exatamente no centro da cena atual com altura apropriada
        if (currentSceneData && currentSceneData.center) {
          const center = currentSceneData.center;
          
          // Detecta o nível do piso para posicionar na altura correta
          const floorLevel = detectFloorLevel();
          const eyeHeight = floorLevel + 1.6; // 1.6m é a altura média dos olhos
          
          panoramaSphere.position.set(center[0], eyeHeight, center[2]);
          console.log(`Panorâmica posicionada em: [${center[0]}, ${eyeHeight}, ${center[2]}]`);
        }
        
        // Adiciona a esfera à cena
        scene.add(panoramaSphere);
        
        // Posiciona a câmera no centro da panorâmica e ajusta controles
        positionCameraInPanorama();
        
        // Aplica efeito de correção de cor para maior realismo
        applyPanoramaColorCorrection(panoramaSphere);
        
        if (callback) callback();
      },
      undefined,
      function(error) {
        console.error('Erro ao carregar panorama:', error);
        if (errorCallback) {
          errorCallback(error);
        } else {
          loadDemoPanorama(callback, errorCallback);
        }
      }
    );
  }

  // Função para detectar o nível do piso baseado na nuvem de pontos
  function detectFloorLevel() {
    // Verificar se já calculamos o nível do piso recentemente (cache)
    if (window.cachedFloorLevel !== undefined) {
      // Usa o valor em cache para evitar cálculos repetidos e spam no console
      return window.cachedFloorLevel;
    }
    
    // Valor padrão caso não consigamos detectar
    let floorLevel = 0;
    
    // Se temos nuvem de pontos, tentamos detectar o nível do piso
    if (pointClouds && pointClouds.length > 0) {
      let heightData = [];
      
      // Para cada nuvem de pontos
      pointClouds.forEach(cloud => {
        if (cloud && cloud.geometry && cloud.geometry.getAttribute) {
          const positions = cloud.geometry.getAttribute('position');
          
          if (positions && positions.array) {
            // Coleta amostra de pontos (para não processar todos)
            const sampleStep = Math.max(1, Math.floor(positions.array.length / 3000));
            
            for (let i = 1; i < positions.array.length; i += 3 * sampleStep) {
              const y = positions.array[i];
              // Filtrar valores extremos fora de um intervalo razoável (-5 a 5 metros)
              if (y > -5 && y < 5) {
                heightData.push(y);
              }
            }
          }
        }
      });
      
      // Se encontramos pontos válidos
      if (heightData.length > 0) {
        // Ordenar os valores de altura
        heightData.sort((a, b) => a - b);
        
        // Usar o 10º percentil como nível do piso (evita outliers inferiores)
        const percentileIndex = Math.floor(heightData.length * 0.1);
        floorLevel = heightData[percentileIndex];
        
        // Verifica se o valor está em um intervalo razoável
        if (floorLevel < -2 || floorLevel > 2) {
          console.warn(`Valor de piso detectado fora do intervalo comum: ${floorLevel.toFixed(2)}m. Ajustando para 0m.`);
          floorLevel = 0; // Fallback para um valor seguro
        } else {
          console.log(`Nível do piso detectado: ${floorLevel.toFixed(2)}m`, {once: true});
        }
      }
    }
    
    // Compatibilidade com versão anterior - verificar currentPointCloud apenas se ainda não temos valor
    if (currentPointCloud && floorLevel === 0) {
      // Verifica se a geometria existe
      if (currentPointCloud.geometry) {
        // Verifica se o atributo position existe
        const positions = currentPointCloud.geometry.getAttribute ? 
                          currentPointCloud.geometry.getAttribute('position') : null;
        
        // Se há posições, usamos amostragem
        if (positions && positions.count) {
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
          floorLevel = yValues[floorIndex] || 0;
          console.log(`Nível do piso detectado pelo método alternativo: ${floorLevel.toFixed(2)}m`);
        }
      }
    }
    
    // Se não detectamos nada válido, usamos 0 como padrão
    if (floorLevel === Infinity || isNaN(floorLevel) || Math.abs(floorLevel) > 5) {
      floorLevel = 0;
      console.log('Usando 0m como nível padrão do piso');
    }
    
    // Armazena o valor em cache para evitar recálculos frequentes
    window.cachedFloorLevel = floorLevel;
    
    // Invalida o cache após 30 segundos (caso mude de ambiente)
    setTimeout(() => {
      window.cachedFloorLevel = undefined;
    }, 30000);
    
    return floorLevel;
  }

  // Função para posicionar a câmera corretamente dentro da panorâmica
  function positionCameraInPanorama() {
    if (!panoramaSphere || !currentSceneData || !currentSceneData.center) return;
    
    // Obter o centro da panorâmica atual
    const center = currentSceneData.center;
    const panoramaPosition = panoramaSphere.position.clone();
    
    // Detecta o nível do piso para posicionar na altura correta
    const floorLevel = detectFloorLevel();
    const eyeHeight = floorLevel + 1.6; // 1.6m é a altura média dos olhos

    // Posiciona a câmera exatamente no centro da panorâmica na altura dos olhos
    camera.position.set(panoramaPosition.x, eyeHeight, panoramaPosition.z);
    
    // Define o ponto de visão inicial com base nas informações da cena
    let lookAtTarget;
    
    // Se a cena tiver uma orientação padrão, use-a
    if (currentSceneData.defaultView) {
      const view = currentSceneData.defaultView;
      lookAtTarget = new THREE.Vector3(
        camera.position.x + view[0],
        camera.position.y + view[1],
        camera.position.z + view[2]
      );
    } else {
      // Caso contrário, olhe para o norte (Z negativo como padrão)
      lookAtTarget = new THREE.Vector3(
        camera.position.x,
        camera.position.y,
        camera.position.z - 1
      );
    }
    
    // Configura os controles para olhar para o alvo
    controls.target.copy(lookAtTarget);
    
    // Ajusta os limites dos controles para uma experiência semelhante ao Matterport
    controls.minDistance = 0.1;
    controls.maxDistance = 1.0; // Limita o zoom para evitar sair da panorâmica
    controls.minPolarAngle = Math.PI * 0.05; // Aproximadamente 9 graus acima do horizonte
    controls.maxPolarAngle = Math.PI * 0.95; // Aproximadamente 9 graus abaixo do horizonte
    
    // Ajusta a velocidade de rotação para uma experiência suave
    controls.rotateSpeed = 0.5;
    
    // Desativa pan e ativa damping para movimento suave
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    
    // Atualiza os controles
    controls.update();
    
    console.log('Câmera posicionada no centro da panorâmica na altura dos olhos');
  }

  // Função para aplicar correção de cor à panorâmica para maior realismo
  function applyPanoramaColorCorrection(panoramaSphere) {
    if (!panoramaSphere || !panoramaSphere.material || !panoramaSphere.material.map) return;
    
    // Ajusta as propriedades do material para melhor aparência
    const material = panoramaSphere.material;
    
    // Ajusta o contraste e saturação para cores mais vibrantes
    if (!material.onBeforeCompile) {
      material.onBeforeCompile = function(shader) {
        // Adiciona uniforms para ajustes
        shader.uniforms.brightness = { value: 1.05 };
        shader.uniforms.contrast = { value: 1.1 };
        shader.uniforms.saturation = { value: 1.15 };
        
        // Fragmento de shader para correção de cor
        const colorCorrectionSnippet = `
          uniform float brightness;
          uniform float contrast;
          uniform float saturation;
          
          vec3 adjustColors(vec3 color) {
            // Ajuste de brilho
            color *= brightness;
            
            // Ajuste de contraste
            color = (color - 0.5) * contrast + 0.5;
            
            // Ajuste de saturação
            float luminance = dot(color, vec3(0.299, 0.587, 0.114));
            color = mix(vec3(luminance), color, saturation);
            
            return clamp(color, 0.0, 1.0);
          }
        `;
        
        // Insere o snippet antes da linha "void main()"
        shader.fragmentShader = shader.fragmentShader.replace(
          'void main() {',
          colorCorrectionSnippet + '\nvoid main() {'
        );
        
        // Substitui a linha que obtém a cor
        shader.fragmentShader = shader.fragmentShader.replace(
          'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
          'gl_FragColor = vec4( adjustColors(outgoingLight), diffuseColor.a );'
        );
      };
      
      // Força atualização do material
      material.needsUpdate = true;
    }
    
    console.log('Correções de cor aplicadas à panorâmica');
  }

  // Carrega panorama demo como fallback, versão melhorada
  function loadDemoPanorama(callback, errorCallback) {
    console.log('Carregando panorama demo de alta qualidade como fallback');
    const textureLoader = new THREE.TextureLoader();
    
    // Tenta primeiro uma imagem de demo interna, depois uma externa se falhar
    textureLoader.load(
      '/demo_panorama.jpg',
      function(texture) {
        // Aplicar as mesmas correções da função principal
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.format = THREE.RGBAFormat;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.encoding = THREE.sRGBEncoding;
        
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide,
          transparent: false,
          depthWrite: false,
          depthTest: false
        });
        
        const geometry = new THREE.SphereGeometry(20, 128, 64);
        panoramaSphere = new THREE.Mesh(geometry, material);
        panoramaSphere.name = 'panorama_demo';
        panoramaSphere.renderOrder = -1;
        panoramaSphere.rotation.y = Math.PI; // Corrige orientação
        
        // Posiciona na origem
        panoramaSphere.position.set(0, 1.6, 0);
        
        scene.add(panoramaSphere);
        
        // Posiciona a câmera
        camera.position.set(0, 1.6, 0);
        controls.target.set(0, 1.6, -1);
        controls.update();
        
        // Aplica correção de cor
        applyPanoramaColorCorrection(panoramaSphere);
        
        if (callback) callback();
      },
      undefined,
      function(error) {
        console.error('Erro ao carregar panorama demo:', error);
        
        // Última tentativa - cria um ambiente básico
        console.log('Criando ambiente básico como última alternativa');
        createBasicEnvironment();
        
        if (errorCallback) errorCallback(error);
        else if (callback) callback();
      }
    );
  }

  // Cria um ambiente básico para visualização se não houver panorâmica
  function createBasicEnvironment() {
    // Cria um ambiente simples com gradiente de cor
    scene.background = new THREE.Color(0x336699);
    scene.fog = new THREE.FogExp2(0x336699, 0.025);
    
    // Ajusta iluminação para visualizar os pontos
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(10, 10, 10);
    scene.add(dirLight);
    
    console.log('Ambiente básico criado para visualização');
  }
  
  // Modificar loadPointCloud para incluir as coordenadas do centro da cena
  function loadPointCloud(cloudUrl, sceneCenter, callback, errorCallback) {
    if (!cloudUrl) {
      console.warn('URL de nuvem de pontos não fornecida');
      if (errorCallback) errorCallback('URL não fornecida');
      return;
    }
    
    console.log('Carregando nuvem de pontos:', cloudUrl);
    showLoading(true);
    
    const plyLoader = new THREE.PLYLoader();
    plyLoader.load(
      cloudUrl,
      function(geometry) {
        console.log(`Nuvem carregada: ${geometry.attributes.position.count} pontos`);
        
        // Criar material para os pontos com estilo Matterport
        const material = new THREE.PointsMaterial({
          size: 0.012, // Tamanho otimizado para melhor visualização
          vertexColors: true,
          transparent: true,
          opacity: 0.9, // Alta opacidade como no Matterport
          depthWrite: false, 
          sizeAttenuation: true,
          blending: THREE.NormalBlending
        });
        
        // Otimizar a nuvem para performance
        let finalGeometry = geometry;
        if (geometry.attributes.position.count > 1000000) {
          // Se tiver mais de 1 milhão de pontos, faz down-sampling
          const decimationFactor = 0.5; // Mantém 50% dos pontos
          console.log(`Otimizando nuvem de pontos: ${geometry.attributes.position.count} -> aproximadamente ${Math.floor(geometry.attributes.position.count * decimationFactor)} pontos`);
          finalGeometry = downsamplePointCloud(geometry, decimationFactor);
        }
        
        // Verifica se há cores, senão cria cores baseadas em classificação semântica
        if (!finalGeometry.attributes.color || finalGeometry.attributes.color.count === 0) {
          console.log('Nuvem sem cores: gerando cores baseadas em classificação semântica simulada');
          generateSemanticColors(finalGeometry);
        }
        
        // Cria a nuvem de pontos
        const pointCloud = new THREE.Points(finalGeometry, material);
        
        // Posiciona a nuvem de acordo com as coordenadas centrais da cena
        if (sceneCenter && Array.isArray(sceneCenter) && sceneCenter.length === 3) {
          console.log(`Posicionando nuvem nas coordenadas: [${sceneCenter.join(', ')}]`);
          pointCloud.position.set(sceneCenter[0], sceneCenter[1], sceneCenter[2]);
        }
        
        // Adiciona metadados à nuvem
        pointCloud.userData = {
          type: 'pointcloud',
          url: cloudUrl,
          center: sceneCenter,
          pointCount: finalGeometry.attributes.position.count
        };
        
        // Adiciona à cena
        scene.add(pointCloud);
        
        // Guarda referência
        currentPointCloud = pointCloud;
        
        // Adiciona ao array de nuvens no modo unificado
        pointClouds.push(pointCloud);
        
        // Atualiza visibilidade com base no modo atual
        updatePointCloudsVisibility();
        
        // Ajusta limites da cena e controles
        updateSceneBounds();
        
        if (callback) callback();
      },
      // Progresso
      function(xhr) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        showMessage(`Nuvem: ${percent}% carregada`);
      },
      // Erro
      function(error) {
        console.error('Erro ao carregar nuvem de pontos:', error);
        if (errorCallback) errorCallback(error);
      }
    );
  }
  
  // Função para fazer down-sampling da nuvem de pontos
  function downsamplePointCloud(geometry, factor) {
    const originalPositions = geometry.attributes.position;
    const count = originalPositions.count;
    const targetCount = Math.floor(count * factor);
    
    // Criar novo buffer de posições
    const positions = new Float32Array(targetCount * 3);
    
    // Criar buffer para cores, se existirem no original
    let colors = null;
    if (geometry.attributes.color) {
      colors = new Float32Array(targetCount * 3);
    }
    
    // Calcular stride para o down-sampling
    const stride = Math.ceil(count / targetCount);
    
    // Selecionar pontos usando stride para manter a distribuição
    let targetIndex = 0;
    for (let i = 0; i < count; i += stride) {
      if (targetIndex >= targetCount) break;
      
      // Copiar posição
      positions[targetIndex * 3] = originalPositions.array[i * 3];
      positions[targetIndex * 3 + 1] = originalPositions.array[i * 3 + 1];
      positions[targetIndex * 3 + 2] = originalPositions.array[i * 3 + 2];
      
      // Copiar cor, se existir
      if (colors && geometry.attributes.color) {
        colors[targetIndex * 3] = geometry.attributes.color.array[i * 3];
        colors[targetIndex * 3 + 1] = geometry.attributes.color.array[i * 3 + 1];
        colors[targetIndex * 3 + 2] = geometry.attributes.color.array[i * 3 + 2];
      }
      
      targetIndex++;
    }
    
    // Criar nova geometria com o buffer reduzido
    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    if (colors) {
      newGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    
    console.log(`Down-sampling concluído: ${count} -> ${targetIndex} pontos`);
    return newGeometry;
  }
  
  // Função para gerar cores baseadas em classificação semântica simulada
  function generateSemanticColors(geometry) {
    const positions = geometry.attributes.position.array;
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    
    // Encontrar limites min/max para classificação
    let minY = Infinity, maxY = -Infinity;
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    
    // Calcular delta para normalização
    const rangeY = maxY - minY;
    const rangeX = maxX - minX;
    const rangeZ = maxZ - minZ;
    
    // Classificação e geração de cores no estilo Matterport
    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      
      // Normalizar posição
      const normalizedY = (y - minY) / rangeY;
      
      // Cores naturais baseadas na altura e posição 3D
      
      // Identificar piso (pontos mais baixos)
      if (normalizedY < 0.15) {
        // Tons de marrom / bege para o piso, com variação baseada em X e Z
        const xVar = ((x - minX) / rangeX) * 0.2;
        const zVar = ((z - minZ) / rangeZ) * 0.2;
        
        colors[i * 3] = 0.6 + xVar; // R - mais vermelho
        colors[i * 3 + 1] = 0.5 + zVar; // G - mais verde
        colors[i * 3 + 2] = 0.35; // B - pouco azul
      }
      // Identificar paredes (pontos de altura média)
      else if (normalizedY < 0.85) {
        // Variação de textura para as paredes
        const textureVar = (Math.sin(x * 5) + Math.sin(z * 5)) * 0.05;
        
        // Tons de branco/cinza para paredes
        colors[i * 3] = 0.82 + textureVar; // R
        colors[i * 3 + 1] = 0.82 + textureVar; // G
        colors[i * 3 + 2] = 0.85 + textureVar; // B
        
        // Adiciona variação para portas e janelas (detecção simplificada)
        const distanceToEdge = Math.min(
          Math.abs(x - minX), Math.abs(x - maxX),
          Math.abs(z - minZ), Math.abs(z - maxZ)
        );
        
        if (distanceToEdge < rangeX * 0.1 || distanceToEdge < rangeZ * 0.1) {
          // Possíveis portas/janelas nas extremidades
          if (Math.random() > 0.7) {
            colors[i * 3] = 0.5; // R
            colors[i * 3 + 1] = 0.5; // G
            colors[i * 3 + 2] = 0.6; // B - mais azulado para janelas
          }
        }
      }
      // Identificar teto (pontos mais altos)
      else {
        // Cor para teto
        colors[i * 3] = 0.95; // R
        colors[i * 3 + 1] = 0.95; // G
        colors[i * 3 + 2] = 0.95; // B - branco levemente acinzentado
      }
      
      // Adicionar móveis e objetos (baseado em análises de densidade espacial simplificadas)
      // Esta é uma detecção muito simplificada para simular móveis
      if (normalizedY > 0.15 && normalizedY < 0.6) {
        // Calcular densidade local em uma região pequena (simplificado)
        let nearbyCount = 0;
        const checkRadius = rangeX * 0.03; // 3% do tamanho da cena
        
        // Amostragem simples para verificar pontos próximos
        for (let j = Math.max(0, i - 10); j < Math.min(count, i + 10); j++) {
          const dx = positions[j * 3] - x;
          const dy = positions[j * 3 + 1] - y;
          const dz = positions[j * 3 + 2] - z;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          
          if (distance < checkRadius) {
            nearbyCount++;
          }
        }
        
        // Se tiver muitos pontos próximos, considerar como um móvel
        if (nearbyCount > 15) {
          const rnd = Math.random();
          
          // Diferentes cores para diferentes tipos de móveis
          if (rnd < 0.3) {
            // Tons de marrom para móveis de madeira
            colors[i * 3] = 0.5; // R
            colors[i * 3 + 1] = 0.35; // G
            colors[i * 3 + 2] = 0.2; // B
          } else if (rnd < 0.6) {
            // Tons de cinza para móveis estofados
            colors[i * 3] = 0.4; // R
            colors[i * 3 + 1] = 0.4; // G
            colors[i * 3 + 2] = 0.45; // B
          } else {
            // Tons variados para outros objetos
            colors[i * 3] = 0.3 + rnd * 0.3; // R
            colors[i * 3 + 1] = 0.3 + rnd * 0.2; // G
            colors[i * 3 + 2] = 0.3 + rnd * 0.4; // B
          }
        }
      }
    }
    
    // Adicionar o atributo de cor à geometria
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    console.log('Cores semânticas geradas com sucesso');
  }
  
  // Função para atualizar os limites da cena com base nas nuvens de pontos
  function updateSceneBounds() {
    if (!currentPointCloud) return;
    
    // Calcular bounding box da nuvem atual
    currentPointCloud.geometry.computeBoundingBox();
    const bbox = currentPointCloud.geometry.boundingBox;
    
    // Atualizar limites dos controles de câmera
    if (controls) {
      // Calcular tamanho da cena
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const maxDimension = Math.max(size.x, size.y, size.z);
      
      // Ajustar limites de zoom com base no tamanho da cena
      controls.minDistance = maxDimension * 0.05; // Zoom máximo = 5% do tamanho da cena
      controls.maxDistance = maxDimension * 3; // Zoom mínimo = 3x o tamanho da cena
      
      console.log(`Limites de câmera atualizados: zoom min=${controls.minDistance.toFixed(2)}, max=${controls.maxDistance.toFixed(2)}`);
    }
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
    if (!sceneData || !sceneData.center) {
      console.warn('Não foi possível posicionar a câmera: dados da cena incompletos');
      return;
    }
    
    const center = sceneData.center;
    const floorLevel = detectFloorLevel();
    const eyeHeight = floorLevel + 1.6; // Altura dos olhos (1.6m)
    
    console.log(`Posicionando câmera em [${center[0]}, ${eyeHeight}, ${center[2]}]`);
    
    // Posiciona a câmera no centro da cena, na altura dos olhos
    camera.position.set(center[0], eyeHeight, center[2]);
    
    // Define o alvo dos controles
    controls.target.set(center[0], eyeHeight, center[2] - 0.1);
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
    // Atualiza coordenadas do mouse
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Atualiza estado de hover
    hovering = true;
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
  
  // Navegação entre cenas com transições suaves
  function navigateToScene(sceneIndex) {
    if (sceneIndex < 0 || sceneIndex >= scenes.length) {
      console.error(`Índice de cena inválido: ${sceneIndex}`);
      return;
    }
    
    // Evita navegação para a mesma cena
    if (sceneIndex === currentSceneIndex && currentSceneData) {
      console.log('Já estamos na cena selecionada');
      return;
    }
    
    console.log(`Navegando para cena: ${scenes[sceneIndex].name}`);
    const previousSceneIndex = currentSceneIndex;
    
    // Atualiza o índice da cena atual
    currentSceneIndex = sceneIndex;
    
    // Adiciona os parâmetros da cena à URL para compartilhamento
    updateURLWithSceneInfo(sceneIndex);
    
    // Adiciona a cena ao histórico de navegação
    addToNavigationHistory(sceneIndex);
    
    // Salva a posição da câmera para animar a transição
    const startCameraPosition = camera.position.clone();
    const startCameraTarget = controls.target.clone();
    
    // Efeito de fade para transição entre cenas
    createFadeTransition().then(() => {
      // Carrega a nova cena após o fade-out
      loadScene(scenes[sceneIndex], () => {
        // Após carregar, anima a transição da câmera
        if (previousSceneIndex !== -1 && panoramaSphere) {
          // Calcula a distância entre as cenas para determinar duração da animação
          const previousCenter = scenes[previousSceneIndex].center || [0, 0, 0];
          const currentCenter = scenes[sceneIndex].center || [0, 0, 0];
          const distance = Math.sqrt(
            Math.pow(previousCenter[0] - currentCenter[0], 2) +
            Math.pow(previousCenter[1] - currentCenter[1], 2) +
            Math.pow(previousCenter[2] - currentCenter[2], 2)
          );
          
          // Duração baseada na distância (entre 800ms e 2000ms)
          const duration = Math.min(Math.max(distance * 200, 800), 2000);
          
          // Anima a transição da câmera
          animateCameraTransition(startCameraPosition, startCameraTarget, duration);
          
          console.log(`Transição suave entre cenas com duração: ${duration}ms`);
        }
        
        // Atualiza a lista de cenas no menu
        populateScenesMenu(scenes);
        
        // Destaca a cena atual na lista
        highlightCurrentScene(sceneIndex);
      });
    });
  }
  
  // Cria uma transição de fade entre cenas
  function createFadeTransition() {
    return new Promise((resolve) => {
      // Cria um elemento DOM para o fade
      let fadeElement = document.getElementById('scene-transition-fade');
      
      if (!fadeElement) {
        fadeElement = document.createElement('div');
        fadeElement.id = 'scene-transition-fade';
        fadeElement.style.position = 'fixed';
        fadeElement.style.top = '0';
        fadeElement.style.left = '0';
        fadeElement.style.width = '100%';
        fadeElement.style.height = '100%';
        fadeElement.style.backgroundColor = 'black';
        fadeElement.style.opacity = '0';
        fadeElement.style.transition = 'opacity 0.4s ease-in-out';
        fadeElement.style.pointerEvents = 'none';
        fadeElement.style.zIndex = '1000';
        document.body.appendChild(fadeElement);
      }
      
      // Fade out
      fadeElement.style.opacity = '1';
      
      // Espera o fade out completar
      setTimeout(() => {
        // Fade in após carregar a cena
        fadeElement.style.opacity = '0';
        
        // Resolve a promessa após o fade out
        resolve();
        
        // Remove o elemento após o fade in completo
        setTimeout(() => {
          fadeElement.remove();
        }, 400);
      }, 400);
    });
  }
  
  // Anima a transição da câmera entre cenas para um movimento suave
  function animateCameraTransition(startPosition, startTarget, duration) {
    if (!panoramaSphere) return;
    
    const endPosition = panoramaSphere.position.clone();
    endPosition.y = camera.position.y; // Mantém a altura atual
    
    const endTarget = new THREE.Vector3(
      endPosition.x, 
      endPosition.y, 
      endPosition.z - 1 // Olha para o "norte" como padrão
    );
    
    const startTime = performance.now();
    
    function animate() {
      const now = performance.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing suave para movimento natural
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      // Interpola posição e alvo da câmera
      camera.position.lerpVectors(startPosition, endPosition, easeProgress);
      controls.target.lerpVectors(startTarget, endTarget, easeProgress);
      controls.update();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Terminou a animação, posicione corretamente na panorâmica
        positionCameraInPanorama();
      }
    }
    
    // Inicia a animação
    animate();
  }
  
  // Destaca a cena atual na lista do menu
  function highlightCurrentScene(sceneIndex) {
    const sceneItems = document.querySelectorAll('.scene-item');
    
    sceneItems.forEach((item, index) => {
      if (index === sceneIndex) {
        item.classList.add('active-scene');
      } else {
        item.classList.remove('active-scene');
      }
    });
  }
  
  // Histórico de navegação para o botão voltar
  let navigationHistory = [];
  
  // Adiciona uma cena ao histórico de navegação
  function addToNavigationHistory(sceneIndex) {
    // Evita duplicação da última posição no histórico
    if (navigationHistory.length > 0 && navigationHistory[navigationHistory.length - 1] === sceneIndex) {
      return;
    }
    
    // Adiciona ao histórico
    navigationHistory.push(sceneIndex);
    
    // Limita o histórico a 10 itens
    if (navigationHistory.length > 10) {
      navigationHistory.shift();
    }
    
    // Atualiza o estado do botão voltar
    updateBackButtonState();
  }
  
  // Função para navegar para a cena anterior
  function navigateBack() {
    // Precisa ter pelo menos duas entradas no histórico para voltar
    if (navigationHistory.length < 2) {
      console.log('Não há histórico para voltar');
      return;
    }
    
    // Remove a entrada atual
    navigationHistory.pop();
    
    // Obtém a última entrada
    const previousSceneIndex = navigationHistory.pop();
    
    // Navega para a cena anterior
    navigateToScene(previousSceneIndex);
  }
  
  // Atualiza o estado do botão voltar
  function updateBackButtonState() {
    const backButton = document.getElementById('back-button');
    if (backButton) {
      if (navigationHistory.length > 1) {
        backButton.disabled = false;
        backButton.classList.remove('disabled');
      } else {
        backButton.disabled = true;
        backButton.classList.add('disabled');
      }
    }
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
      loadingOverlay.style.display = 'flex';
      loadingOverlay.style.opacity = '1';
      console.log('Mostrando tela de carregamento');
    } else {
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 500); // Espera a transição terminar
      console.log('Escondendo tela de carregamento');
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
    
    // Remover pontos de navegação antigos
    const oldPoints = document.querySelectorAll('.mp-nav-point');
    oldPoints.forEach(point => point.remove());
    
    // Limpa pontos 3D antigos
    scene.children.forEach(child => {
      if (child.userData && child.userData.type === 'navpoint') {
        scene.remove(child);
      }
    });
    
    // Detecta o nível do piso
    const floorLevel = detectFloorLevel();
    console.log('Nível do piso para pontos de navegação:', floorLevel);
    
    // Container para os pontos de navegação HTML
    let navPointsContainer = document.getElementById('nav-points-container');
    if (!navPointsContainer) {
      navPointsContainer = document.createElement('div');
      navPointsContainer.id = 'nav-points-container';
      navPointsContainer.style.position = 'absolute';
      navPointsContainer.style.top = '0';
      navPointsContainer.style.left = '0';
      navPointsContainer.style.width = '100%';
      navPointsContainer.style.height = '100%';
      navPointsContainer.style.pointerEvents = 'none';
      navPointsContainer.style.zIndex = '200';
      document.body.appendChild(navPointsContainer);
    }
    
    // Array para armazenar pontos candidatos para filtragem
    const navPointCandidates = [];
    
    // Cria pontos para cada cena disponível
    scenes.forEach((sceneData, index) => {
      if (index === currentSceneIndex) return; // Não cria ponto para a cena atual
      
      // Verifica se a cena tem coordenadas
      if (!sceneData.center) {
        console.warn(`Cena ${sceneData.name} não tem coordenadas de centro definidas`);
        return;
      }
      
      const center = sceneData.center;
      
      // Calcula a distância entre a cena atual e esta cena
      let distance = 0;
      if (currentSceneData && currentSceneData.center) {
        const currentCenter = currentSceneData.center;
        distance = Math.sqrt(
          Math.pow(currentCenter[0] - center[0], 2) +
          Math.pow(currentCenter[1] - center[1], 2) +
          Math.pow(currentCenter[2] - center[2], 2)
        );
      }
      
      // Armazena o candidato com informações de distância para filtragem posterior
      navPointCandidates.push({
        center,
        name: sceneData.name,
        index,
        distance
      });
    });
    
    // Filtra pontos para evitar aglomeração
    // Ordena por distância (do mais próximo ao mais distante)
    navPointCandidates.sort((a, b) => a.distance - b.distance);
    
    // Filtra pontos que estão muito próximos uns dos outros (mantém apenas o mais próximo)
    const MIN_POINT_DISTANCE = 1.5; // Distância mínima entre pontos de navegação
    const filteredPoints = [];
    
    navPointCandidates.forEach(candidate => {
      // Verifica se este ponto está muito próximo de outro ponto já aceito
      const isTooClose = filteredPoints.some(point => {
        const pointDistance = Math.sqrt(
          Math.pow(point.center[0] - candidate.center[0], 2) +
          Math.pow(point.center[2] - candidate.center[2], 2)
        );
        return pointDistance < MIN_POINT_DISTANCE;
      });
      
      // Se não estiver muito próximo, adiciona à lista filtrada
      if (!isTooClose) {
        filteredPoints.push(candidate);
      } else {
        console.log(`Ponto para ${candidate.name} filtrado por estar muito próximo de outro ponto`);
      }
    });
    
    // Limite de pontos visíveis para evitar poluição visual (Matterport mostra ~6-8 pontos por vez)
    const MAX_VISIBLE_POINTS = 8;
    const visiblePoints = filteredPoints.slice(0, MAX_VISIBLE_POINTS);
    
    // Distância máxima para mostrar pontos
    const MAX_NAV_DISTANCE = 25; // Metros
    
    // Cria pontos HTML e 3D
    visiblePoints.forEach(point => {
      // Se a distância for muito grande, não criar ponto de navegação
      if (point.distance > MAX_NAV_DISTANCE) {
        console.log(`Ponto de navegação para ${point.name} ignorado: distância ${point.distance.toFixed(2)}m (muito longe)`);
        return;
      }
      
      console.log(`Criando ponto de navegação para ${point.name} a ${point.distance.toFixed(2)}m de distância`);
      
      // A altura do ponto depende da distância para criar sensação de perspectiva
      // Pontos mais distantes ficam mais altos para simular o efeito de perspectiva do Matterport
      const navPointHeight = floorLevel + 0.15 + (point.distance * 0.01);
      
      // Posição do ponto
      const position = new THREE.Vector3(
        point.center[0],
        navPointHeight, // Posiciona o ponto um pouco acima do chão
        point.center[2]
      );
      
      // Cria o ponto de navegação HTML em vez de 3D
      createHtmlNavPoint(position, point.name, point.index, point.distance);
      
      // Ainda mantém um ponto 3D invisível para raycasting
      const circleGeometry = new THREE.CircleGeometry(0.2, 16);
      const circleMaterial = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.0, // Invisível
        side: THREE.DoubleSide
      });
      
      const navCircle = new THREE.Mesh(circleGeometry, circleMaterial);
      navCircle.rotation.x = -Math.PI / 2;
      navCircle.position.copy(position);
      navCircle.userData = {
        type: 'navpoint',
        targetScene: point.index,
        name: point.name,
        distance: point.distance
      };
      scene.add(navCircle);
    });
  }

  // Função para criar ponto de navegação HTML estilo Matterport
  function createHtmlNavPoint(position3D, name, sceneIndex, distance) {
    // Converte posição 3D para coordenadas de tela
    const vector = position3D.clone();
    vector.project(camera);
    
    // Coordenadas de tela
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (vector.y * -0.5 + 0.5) * window.innerHeight;
    
    // Verificar se o ponto está na frente da câmera e dentro da tela
    if (vector.z > 1 || x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight) {
      // Ponto está atrás da câmera ou fora da tela, não exibir
      return;
    }
    
    // Criar elemento HTML para o ponto de navegação
    const navPoint = document.createElement('div');
    navPoint.className = 'mp-nav-point';
    
    // Adicionando a estrutura Matterport-like com círculo externo e interno
    navPoint.innerHTML = `
      <div class="mp-nav-point-outer"></div>
      <div class="mp-nav-point-inner"></div>
    `;
    
    navPoint.setAttribute('data-scene-index', sceneIndex);
    navPoint.setAttribute('data-name', name);
    navPoint.setAttribute('data-distance', distance.toFixed(1));
    
    // Posicionar o elemento na tela
    navPoint.style.left = `${x}px`;
    navPoint.style.top = `${y}px`;
    
    // Adicionar tooltip com informações
    navPoint.title = `${name} (${distance.toFixed(1)}m)`;
    
    // Adicionar evento de clique
    navPoint.style.pointerEvents = 'auto';
    navPoint.addEventListener('click', () => {
      navigateToScene(sceneIndex);
    });
    
    // Efeito de hover para destacar o ponto
    navPoint.addEventListener('mouseenter', () => {
      navPoint.classList.add('mp-nav-point-hover');
    });
    
    navPoint.addEventListener('mouseleave', () => {
      navPoint.classList.remove('mp-nav-point-hover');
    });
    
    // Adicionar ao container
    const container = document.getElementById('nav-points-container');
    if (container) {
      container.appendChild(navPoint);
    } else {
      document.body.appendChild(navPoint);
    }
    
    return navPoint;
  }

  // Função para atualizar os pontos de navegação HTML quando a câmera se move
  function updateNavPointsPositions() {
    const navPoints = document.querySelectorAll('.mp-nav-point');
    if (navPoints.length === 0) return;
    
    // Reutilizamos o valor do piso em cache para evitar cálculos repetidos que causam spam no console
    const floorLevel = detectFloorLevel();
    
    navPoints.forEach(point => {
      const sceneIndex = parseInt(point.getAttribute('data-scene-index'));
      const sceneData = scenes[sceneIndex];
      
      if (!sceneData || !sceneData.center) return;
      
      // Usa o mesmo cálculo de altura baseado na distância que usamos na criação
      const distance = parseFloat(point.getAttribute('data-distance') || "0");
      const navPointHeight = floorLevel + 0.15 + (distance * 0.01);
      
      const position3D = new THREE.Vector3(
        sceneData.center[0],
        navPointHeight,
        sceneData.center[2]
      );
      
      // Converte posição 3D para coordenadas de tela
      const vector = position3D.clone();
      vector.project(camera);
      
      // Coordenadas de tela
      const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
      const y = (vector.y * -0.5 + 0.5) * window.innerHeight;
      
      // Oculta pontos que estão atrás da câmera ou fora da tela
      if (vector.z > 1 || x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight) {
        point.style.display = 'none';
      } else {
        point.style.display = 'flex';
        point.style.left = `${x}px`;
        point.style.top = `${y}px`;
        
        // Ajusta o tamanho do ponto baseado na distância para criar efeito de perspectiva
        // Pontos mais distantes ficam menores
        const scale = Math.max(0.6, 1 - (distance * 0.02));
        point.style.transform = `translate(-50%, -50%) scale(${scale})`;
        
        // Ajusta a opacidade baseada na distância
        const opacity = Math.max(0.4, 1 - (distance * 0.03));
        point.querySelector('.mp-nav-point-outer').style.opacity = opacity;
      }
    });
  }

  // Modificar a função animate para atualizar os pontos de navegação HTML
  function animate() {
    requestAnimationFrame(animate);
    
    try {
      // Atualiza os controles
      controls.update();
      
      // Renderiza a cena
      renderer.render(scene, camera);
      
      // Atualiza posição dos pontos de navegação HTML
      updateNavPointsPositions();
      
      // Atualiza posição de etiquetas e elementos flutuantes
      updateLabelsPosition();
      
      // Atualiza visualização de medição, se estiver medindo
      if (isMeasuring && raycaster) {
        const intersects = getIntersectedObjects();
        updateMeasurementPreview(intersects);
      }
    } catch (e) {
      console.error('Erro no loop de animação:', e);
    }
  }

  // Adicionar interface estilo Matterport oficial
  function setupMatterportStyle() {
    console.log('Configurando interface estilo Matterport');
    
    // Remove estilos antigos, se existirem
    const oldStyles = document.getElementById('matterport-styles');
    if (oldStyles) {
      oldStyles.remove();
    }
    
    // Adiciona novos estilos CSS
    const style = document.createElement('style');
    style.id = 'matterport-styles';
    style.textContent = `
      /* Estilos gerais do Matterport */
      body {
        margin: 0;
        font-family: 'Roboto', Arial, sans-serif;
        overflow: hidden;
        background: #000;
      }
      
      /* Barra de navegação superior */
      .mp-top-bar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 60px;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        padding: 0 20px;
        z-index: 1000;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .mp-logo {
        color: white;
        font-weight: 700;
        font-size: 18px;
      }
      
      /* Controles centrais inferiores */
      .mp-controls {
        position: absolute;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 8px;
        background: rgba(0, 0, 0, 0.7);
        border-radius: 50px;
        padding: 8px;
        z-index: 1000;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      }
      
      .mp-btn {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: none;
        background: #333;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 20px;
        transition: all 0.2s;
      }
      
      .mp-btn:hover {
        background: #444;
        transform: scale(1.05);
      }
      
      .mp-btn.active {
        background: #0066cc;
      }
      
      /* Pontos de navegação estilo Matterport */
      .mp-nav-point {
        position: absolute;
        width: 30px;
        height: 30px;
        transform: translate(-50%, -50%);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        pointer-events: auto;
        transition: all 0.2s ease;
        z-index: 200;
      }
      
      .mp-nav-point-outer {
        position: absolute;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.3);
        border: 2px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 0 8px rgba(0, 0, 0, 0.4);
        transition: all 0.2s ease;
      }
      
      .mp-nav-point-inner {
        position: absolute;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: white;
        transition: all 0.2s ease;
        box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
      }
      
      .mp-nav-point-hover .mp-nav-point-outer {
        background-color: rgba(0, 153, 255, 0.6);
        border-color: white;
        transform: scale(1.2);
      }
      
      .mp-nav-point-hover .mp-nav-point-inner {
        background-color: white;
        transform: scale(1.1);
      }
      
      /* Informações e medições */
      .mp-info-panel {
        position: absolute;
        top: 70px;
        right: 10px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 12px;
        border-radius: 8px;
        font-size: 14px;
        max-width: 300px;
        z-index: 900;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        display: none;
      }
      
      /* Controles direitos */
      .mp-side-controls {
        position: absolute;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        gap: 12px;
        z-index: 900;
      }
      
      .mp-dolly-controls {
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: center;
      }
      
      /* Estilos para o indicador de carregamento */
      .mp-loading {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 2000;
        color: white;
      }
      
      .mp-spinner {
        width: 50px;
        height: 50px;
        border: 5px solid rgba(255,255,255,0.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 1s ease-in-out infinite;
        margin-bottom: 20px;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    
    document.head.appendChild(style);
    
    // Criando a barra superior
    const topBar = document.createElement('div');
    topBar.className = 'mp-top-bar';
    topBar.innerHTML = `
      <div class="mp-logo">Matterport Clone</div>
    `;
    document.body.appendChild(topBar);
    
    // Criando controles centrais inferiores estilo Matterport
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'mp-controls';
    
    // Substituindo a classe antiga de botões
    const buttonsConfig = [
      { id: 'back-button', icon: '⬅️', title: 'Voltar' },
      { id: 'btn-dollhouse', icon: '🏠', title: 'Modo Dollhouse' },
      { id: 'btn-floorplan', icon: '📐', title: 'Planta Baixa' },
      { id: 'btn-measure', icon: '📏', title: 'Medir' },
      { id: 'btn-tags', icon: '🏷️', title: 'Anotações' },
      { id: 'btn-tour', icon: '🔄', title: 'Tour Automático' },
      { id: 'btn-reset', icon: '🔙', title: 'Resetar Visualização' },
      { id: 'btn-unified', icon: '🌐', title: 'Alternar Modo Unificado' }
    ];
    
    buttonsConfig.forEach(btn => {
      const button = document.createElement('button');
      button.id = btn.id;
      button.className = 'mp-btn';
      button.innerHTML = btn.icon;
      button.title = btn.title;
      controlsContainer.appendChild(button);
    });
    
    // Remove o painel de controle antigo, se existir
    const oldPanel = document.querySelector('.control-panel');
    if (oldPanel) {
      oldPanel.remove();
    }
    
    document.body.appendChild(controlsContainer);
    
    // Reconectar eventos nos novos botões
    document.getElementById('back-button').addEventListener('click', navigateBack);
    document.getElementById('btn-dollhouse').addEventListener('click', toggleDollhouseMode);
    document.getElementById('btn-floorplan').addEventListener('click', toggleFloorPlan);
    document.getElementById('btn-measure').addEventListener('click', toggleMeasureMode);
    document.getElementById('btn-tags').addEventListener('click', toggleTagMode);
    document.getElementById('btn-tour').addEventListener('click', toggleAutoTour);
    document.getElementById('btn-reset').addEventListener('click', resetView);
    document.getElementById('btn-unified').addEventListener('click', toggleUnifiedMode);
    
    // Inicialmente desabilita o botão de voltar
    updateBackButtonState();
    
    // Criando controles laterais direitos
    const sideControls = document.createElement('div');
    sideControls.className = 'mp-side-controls';
    
    // Botões para captura de tela e compartilhamento
    const shareBtn = document.createElement('button');
    shareBtn.className = 'mp-btn';
    shareBtn.innerHTML = '🔗';
    shareBtn.title = 'Compartilhar';
    shareBtn.addEventListener('click', shareScene);
    sideControls.appendChild(shareBtn);
    
    const screenBtn = document.createElement('button');
    screenBtn.className = 'mp-btn';
    screenBtn.innerHTML = '📷';
    screenBtn.title = 'Capturar Tela';
    screenBtn.addEventListener('click', takeScreenshot);
    sideControls.appendChild(screenBtn);
    
    document.body.appendChild(sideControls);
    
    // Substituir o indicador de carregamento
    const oldLoading = document.getElementById('loading-overlay');
    if (oldLoading) {
      oldLoading.remove();
    }
    
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'mp-loading';
    loadingOverlay.id = 'loading-overlay';
    loadingOverlay.style.display = 'none';
    loadingOverlay.innerHTML = `
      <div class="mp-spinner"></div>
      <div id="loading-message">Carregando...</div>
    `;
    document.body.appendChild(loadingOverlay);
    
    console.log('Interface estilo Matterport configurada');
    
    // Atualiza o estilo do mini-mapa para combinar com o Matterport
    if (miniMapContainer) {
      miniMapContainer.style.borderRadius = '8px';
      miniMapContainer.style.overflow = 'hidden';
      miniMapContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
      miniMapContainer.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    }
    
    // Atualiza o estilo das mensagens
    const infoEl = document.getElementById('info');
    if (infoEl) {
      infoEl.style.background = 'rgba(0, 0, 0, 0.6)';
      infoEl.style.backdropFilter = 'blur(10px)';
      infoEl.style.borderRadius = '8px';
      infoEl.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      infoEl.style.padding = '10px 15px';
      infoEl.style.fontSize = '14px';
      infoEl.style.fontWeight = '500';
    }
  }

  console.log('main.js foi carregado e inicializado');

  // Função para resetar a visualização da câmera
  function resetView() {
    console.log('Resetando visualização...');
    
    // Se não temos uma cena carregada, não fazemos nada
    if (!currentSceneData) {
      console.warn('Não há cena carregada para resetar visualização');
      return;
    }
    
    // Detecta o nível do piso para posicionar na altura correta
    const floorLevel = detectFloorLevel();
    const center = currentSceneData.center || [0, 0, 0];
    const eyeHeight = floorLevel + 1.6; // 1.6m é a altura média dos olhos
    
    // Posição para onde a câmera vai (centro da cena, na altura dos olhos)
    const targetPos = new THREE.Vector3(center[0], eyeHeight, center[2]);
    
    // Para onde a câmera vai olhar (para frente/norte por padrão)
    const targetTarget = new THREE.Vector3(center[0], eyeHeight, center[2] - 1);
    
    // Anima suavemente a transição da câmera
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const duration = 1000; // milissegundos
    
    // Tempo inicial para a animação
    const startTime = performance.now();
    
    function animateReset() {
      const now = performance.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Função de easing para movimento mais natural
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      // Interpola posição da câmera
      camera.position.lerpVectors(startPos, targetPos, easeProgress);
      
      // Interpola alvo dos controles
      controls.target.lerpVectors(startTarget, targetTarget, easeProgress);
      controls.update();
      
      // Continua a animação se não terminou
      if (progress < 1) {
        requestAnimationFrame(animateReset);
      } else {
        console.log('Visualização resetada para posição padrão');
      }
    }
    
    // Inicia a animação
    animateReset();
    
    // Exibe mensagem para o usuário
    showMessage('Visualização resetada');
  }

  // Função para animar o movimento da câmera
  function animateCameraMovement(startPos, endPos, startTarget, endTarget, duration) {
    const startTime = performance.now();
    
    function animate() {
      const now = performance.now();
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
    
    // Inicia a animação
    animate();
  }

  // Função para tratar eventos de teclado
  function onKeyDown(event) {
    // Se pressionar ESC, sai dos modos de interação
    if (event.key === 'Escape') {
      if (isMeasuring || isTagMode) {
        isMeasuring = false;
        isTagMode = false;
        updateUIState();
        showMessage('Modo de interação desativado');
      }
    }
    
    // Teclas numéricas para navegar entre cenas (1-9)
    if (!isNaN(parseInt(event.key)) && event.key >= '1' && event.key <= '9') {
      const sceneIndex = parseInt(event.key) - 1;
      if (sceneIndex >= 0 && sceneIndex < scenes.length) {
        navigateToScene(sceneIndex);
      }
    }
    
    // Outras teclas de atalho
    switch (event.key) {
      case 'm': // M - Modo de medição
        toggleMeasureMode();
        break;
      case 't': // T - Modo de tags
        toggleTagMode();
        break;
      case 'd': // D - Modo dollhouse
        toggleDollhouseMode();
        break;
      case 'f': // F - Modo planta baixa
        toggleFloorPlan();
        break;
      case 'r': // R - Resetar visualização
        resetView();
        break;
      case 'a': // A - Tour automático
        toggleAutoTour();
        break;
    }
  }

  // Função para lidar com cliques nos pontos de navegação
  function handleNavPointClick(event) {
    // Converte coordenadas do mouse para coordenadas normalizadas (-1 a 1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Configura o raycaster
    raycaster.setFromCamera(mouse, camera);
    
    // Encontra objetos que intersectam com o raio
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    // Verifica se clicou em algum ponto de navegação
    for (let i = 0; i < intersects.length; i++) {
      const object = intersects[i].object;
      
      // Verifica se é um ponto de navegação
      if (object.userData && object.userData.type === 'navpoint') {
        const targetScene = object.userData.targetScene;
        console.log(`Clique em ponto de navegação para cena ${targetScene}`);
        
        // Navega para a cena correspondente
        navigateToScene(targetScene);
        return true;
      }
    }
    
    // Verifica se clicou em algum ponto de navegação HTML
    const elements = document.elementsFromPoint(event.clientX, event.clientY);
    for (const element of elements) {
      if (element.classList.contains('mp-nav-point')) {
        const sceneIndex = parseInt(element.getAttribute('data-scene-index'));
        if (!isNaN(sceneIndex)) {
          console.log(`Clique em ponto de navegação HTML para cena ${sceneIndex}`);
          navigateToScene(sceneIndex);
          return true;
        }
      }
    }
    
    return false;
  }
})();