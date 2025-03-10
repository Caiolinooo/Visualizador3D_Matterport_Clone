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
      
      // Atualiza as posições dos pontos de navegação
      updateNavPointsPositions();
      
      // Atualiza as etiquetas de medição se houver
      if (window.measurements && window.measurements.length > 0) {
        updateAllMeasurementLabels();
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
    
    // Valor padrão para o floorLevel - usamos 0 como base segura
    let floorLevel = 0;
    let detectionMethod = "valor padrão";
    
    // Tenta detectar o nível do piso a partir da cena atual
    if (currentSceneData && currentSceneData.center) {
      // Se temos dados do centro da cena, podemos usar o componente Y como aproximação
      // Normalmente, o centro da cena é posicionado perto do nível do piso
      const sceneY = currentSceneData.center[1];
      
      // Verifica se o valor está em um intervalo razoável (-5 a 5 metros)
      if (sceneY > -5 && sceneY < 5) {
        floorLevel = sceneY;
        detectionMethod = "centro da cena";
      }
    }
    
    // Se temos nuvem de pontos, tentamos uma detecção mais precisa
    if (pointClouds && pointClouds.length > 0) {
      let heightData = [];
      
      // Para cada nuvem de pontos
      pointClouds.forEach(cloud => {
        if (cloud && cloud.geometry && cloud.geometry.getAttribute) {
          const positions = cloud.geometry.getAttribute('position');
          
          if (positions && positions.array) {
            // Coleta amostra de pontos (para não processar todos)
            const sampleStep = Math.max(1, Math.floor(positions.array.length / 5000)); // Aumentado para melhor amostragem
            
            // Primeiro, encontra os valores mínimo e máximo para entender a escala da cena
            let minY = Infinity;
            let maxY = -Infinity;
            
            for (let i = 1; i < positions.array.length; i += 3 * sampleStep) {
              const y = positions.array[i];
              if (!isNaN(y) && isFinite(y)) {
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
              }
            }
            
            // Calcula a altura total da cena
            const sceneHeight = maxY - minY;
            
            // Define uma janela para potenciais pontos do piso (parte inferior da cena)
            // Normalmente o piso está nos 10-20% inferiores da cena
            const floorWindow = sceneHeight * 0.2;
            const floorMax = minY + floorWindow;
            
            // Coleta pontos dentro da janela do piso
            for (let i = 1; i < positions.array.length; i += 3 * sampleStep) {
              const y = positions.array[i];
              if (!isNaN(y) && isFinite(y) && y >= minY && y <= floorMax) {
                heightData.push(y);
              }
            }
            
            // Ordena e faz uma análise de cluster para encontrar o nível do piso
            if (heightData.length > 20) { // Precisamos de uma amostra razoável
              heightData.sort((a, b) => a - b);
              
              // Usamos um histograma para encontrar o cluster mais denso
              const histogramBins = 20;
              const histogramRange = floorWindow;
              const binSize = histogramRange / histogramBins;
              const histogram = new Array(histogramBins).fill(0);
              
              // Preenche o histograma
              heightData.forEach(y => {
                const binIndex = Math.min(
                  histogramBins - 1, 
                  Math.floor((y - minY) / binSize)
                );
                histogram[binIndex]++;
              });
              
              // Encontra o bin mais populoso (maior cluster)
              let maxBinCount = 0;
              let maxBinIndex = 0;
              
              histogram.forEach((count, index) => {
                if (count > maxBinCount) {
                  maxBinCount = count;
                  maxBinIndex = index;
                }
              });
              
              // Calcula o nível do piso como o centro do bin mais populoso
              const detectedFloor = minY + (maxBinIndex + 0.5) * binSize;
              
              // Verifica se o valor é razoável
              if (detectedFloor > -5 && detectedFloor < 5) {
                floorLevel = detectedFloor;
                detectionMethod = "análise de cluster";
              } else {
                // Se o valor detectado está fora do intervalo razoável,
                // tentamos uma abordagem diferente
                const percentileIndex = Math.floor(heightData.length * 0.1);
                const percentileFloor = heightData[percentileIndex];
                
                if (percentileFloor > -5 && percentileFloor < 5) {
                  floorLevel = percentileFloor;
                  detectionMethod = "percentil 10%";
                }
              }
            }
          }
        }
      });
    }
    
    // Para compatibilidade com a versão anterior - verificamos currentPointCloud também
    if (currentPointCloud && (!pointClouds || pointClouds.length === 0)) {
      // [código existente para currentPointCloud]
      if (currentPointCloud.geometry) {
        const positions = currentPointCloud.geometry.getAttribute ? 
                          currentPointCloud.geometry.getAttribute('position') : null;
        
        if (positions && positions.count) {
          const sampleSize = Math.min(1000, positions.count);
          const step = Math.floor(positions.count / sampleSize);
          
          let yValues = [];
          
          for (let i = 0; i < positions.count; i += step) {
            yValues.push(positions.getY(i));
          }
          
          yValues.sort((a, b) => a - b);
          
          const floorIndex = Math.floor(yValues.length * 0.05);
          const alternativeFloor = yValues[floorIndex] || 0;
          
          // Só usamos este valor se o atual não for confiável e este estiver em um intervalo razoável
          if (Math.abs(floorLevel) > 3 && Math.abs(alternativeFloor) < 3) {
            floorLevel = alternativeFloor;
            detectionMethod = "método alternativo";
          }
          
          console.log(`Nível do piso detectado pelo método alternativo: ${alternativeFloor.toFixed(2)}m`);
        }
      }
    }
    
    // Verifica se o valor final está em um intervalo aceitável
    if (!isFinite(floorLevel) || isNaN(floorLevel) || Math.abs(floorLevel) > 3) {
      const oldValue = floorLevel;
      floorLevel = 0; // Usamos 0 como valor seguro padrão
      console.log(`Valor de piso detectado fora do intervalo comum: ${oldValue.toFixed(2)}m. Ajustando para 0m.`);
    } else {
      console.log(`Nível do piso detectado (${detectionMethod}): ${floorLevel.toFixed(2)}m`);
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
      // Criar um canvas em vez de apenas anexar a imagem
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.className = 'floor-plan-canvas';
      
      // Desenhar a imagem no canvas
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, img.width, img.height);
      
      // Adicionar efeitos para tornar mais realista
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(230, 230, 250, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      
      // Adicionar bordas para paredes
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
      
      // Limpar o container da planta baixa
      floorPlanElement.innerHTML = '';
      floorPlanElement.appendChild(canvas);
      
      // Adicionar pontos de navegação à planta baixa se houver dados de cena
      if (scenes && scenes.length > 1) {
        addNavigationPointsToFloorPlan(canvas, floorPlanUrl);
      }
      
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
  
  // Nova função para adicionar pontos de navegação na planta baixa
  function addNavigationPointsToFloorPlan(canvas, floorPlanUrl) {
    if (!scenes || !currentSceneData || !currentSceneData.position) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Buscar informações sobre a escala da planta baixa
    // Podemos usar metadados ou estimar com base nas dimensões da cena
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    
    scenes.forEach(scene => {
      if (scene.position) {
        minX = Math.min(minX, scene.position.x);
        maxX = Math.max(maxX, scene.position.x);
        minZ = Math.min(minZ, scene.position.z);
        maxZ = Math.max(maxZ, scene.position.z);
      }
    });
    
    // Adicionar margem
    const margin = 20;
    const scaleX = (width - margin*2) / (maxX - minX || 1);
    const scaleZ = (height - margin*2) / (maxZ - minZ || 1);
    
    // Desenhar pontos de navegação na planta
    scenes.forEach((scene, index) => {
      if (!scene.position) return;
      
      // Converter coordenadas 3D para coordenadas 2D na planta
      const x = margin + (scene.position.x - minX) * scaleX;
      const y = margin + (scene.position.z - minZ) * scaleZ;
      
      // Tamanho do ponto
      const radius = index === currentSceneIndex ? 8 : 6;
      
      // Cor do ponto (cena atual vs outras cenas)
      ctx.beginPath();
      if (index === currentSceneIndex) {
        // Cena atual - ponto maior e destacado
        ctx.fillStyle = '#4CAF50';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
      } else {
        // Outras cenas
        ctx.fillStyle = '#2196F3';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
      }
      
      // Desenhar ponto circular
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Adicionar texto com nome da cena
      ctx.fillStyle = '#000';
      ctx.font = '10px Arial';
      ctx.fillText(scene.name.substring(0, 10), x + 10, y);
    });
    
    // Adicionar manipulador de cliques para navegação pela planta
    canvas.style.cursor = 'pointer';
    canvas.onclick = function(event) {
      const rect = canvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;
      
      // Encontrar o ponto de navegação mais próximo do clique
      let nearestIndex = -1;
      let minDistance = Infinity;
      
      scenes.forEach((scene, index) => {
        if (!scene.position) return;
        
        const x = margin + (scene.position.x - minX) * scaleX;
        const y = margin + (scene.position.z - minZ) * scaleZ;
        
        const distance = Math.sqrt(Math.pow(clickX - x, 2) + Math.pow(clickY - y, 2));
        
        if (distance < 20 && distance < minDistance) {
          minDistance = distance;
          nearestIndex = index;
        }
      });
      
      // Se encontrou um ponto próximo, navega para a cena
      if (nearestIndex !== -1 && nearestIndex !== currentSceneIndex) {
        navigateToScene(nearestIndex);
      }
    };
  }
  
  // Nova função para criar planta baixa expandida mais realista
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
    dialog.className = 'expanded-floor-plan matterport-style';
    
    // Adiciona o conteúdo
    dialog.innerHTML = `
      <div class="expanded-floor-plan-header">
        <h3>Planta Baixa</h3>
        <button class="close-btn">×</button>
      </div>
      <div class="expanded-floor-plan-content">
        <div class="loading-spinner"></div>
      </div>
      <div class="expanded-floor-plan-footer">
        <button class="zoom-in-btn">+</button>
        <button class="zoom-out-btn">-</button>
        <button class="reset-view-btn">Reset</button>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Carregar a imagem em alta resolução
    const contentDiv = dialog.querySelector('.expanded-floor-plan-content');
    const img = new Image();
    
    img.onload = function() {
      // Criar canvas para desenhar planta interativa
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      
      // Limpar o conteúdo e adicionar o canvas
      contentDiv.innerHTML = '';
      contentDiv.appendChild(canvas);
      
      // Desenhar a imagem com efeitos de realce
      const ctx = canvas.getContext('2d');
      
      // Fundo claro
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Desenhar a planta
      ctx.drawImage(img, 0, 0, img.width, img.height);
      
      // Aplicar efeito para melhoria visual (estilo Matterport)
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(230, 240, 255, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      
      // Adicionar sombra
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 3;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // Adicionar pontos de navegação interativos
      addDetailedNavigationPointsToFloorPlan(canvas);
      
      // Implementar funções de zoom e pan
      setupFloorPlanInteraction(canvas);
    };
    
    img.onerror = function() {
      contentDiv.innerHTML = '<p class="error-message">Erro ao carregar a planta baixa.</p>';
    };
    
    img.src = floorPlanUrl;
    
    // Configurar eventos dos botões
    dialog.querySelector('.close-btn').addEventListener('click', function() {
      document.body.removeChild(dialog);
    });
    
    // Adicionar estilo CSS para o modal da planta baixa se ainda não existir
    if (!document.getElementById('expanded-floor-plan-css')) {
      const style = document.createElement('style');
      style.id = 'expanded-floor-plan-css';
      style.textContent = `
        .expanded-floor-plan {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 80%;
          height: 80%;
          background: white;
          border-radius: 8px;
          box-shadow: 0 5px 25px rgba(0,0,0,0.3);
          display: flex;
          flex-direction: column;
          z-index: 1000;
        }
        
        .expanded-floor-plan-header {
          padding: 15px;
          background: #2196F3;
          color: white;
          border-radius: 8px 8px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .expanded-floor-plan-header h3 {
          margin: 0;
          font-weight: normal;
        }
        
        .close-btn {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
        }
        
        .expanded-floor-plan-content {
          flex: 1;
          overflow: auto;
          padding: 20px;
          position: relative;
        }
        
        .expanded-floor-plan-footer {
          padding: 10px;
          border-top: 1px solid #eee;
          display: flex;
          justify-content: center;
          gap: 10px;
        }
        
        .expanded-floor-plan-footer button {
          padding: 5px 15px;
          background: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .expanded-floor-plan-footer button:hover {
          background: #e0e0e0;
        }
        
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(0,0,0,0.1);
          border-radius: 50%;
          border-top: 4px solid #2196F3;
          animation: spin 1s linear infinite;
          position: absolute;
          top: 50%;
          left: 50%;
          margin-top: -20px;
          margin-left: -20px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  // Função para adicionar pontos de navegação detalhados à planta baixa expandida
  function addDetailedNavigationPointsToFloorPlan(canvas) {
    if (!scenes || !currentSceneData || !currentSceneData.position) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Buscar informações sobre a escala da planta baixa
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    
    scenes.forEach(scene => {
      if (scene.position) {
        minX = Math.min(minX, scene.position.x);
        maxX = Math.max(maxX, scene.position.x);
        minZ = Math.min(minZ, scene.position.z);
        maxZ = Math.max(maxZ, scene.position.z);
      }
    });
    
    // Adicionar margem
    const margin = 50;
    const scaleX = (width - margin*2) / (maxX - minX || 1);
    const scaleZ = (height - margin*2) / (maxZ - minZ || 1);
    
    // Desenhar conexões entre pontos primeiro (como no Matterport)
    ctx.strokeStyle = 'rgba(76, 175, 80, 0.6)';
    ctx.lineWidth = 2;
    
    scenes.forEach((sceneA, indexA) => {
      if (!sceneA.position) return;
      
      const xA = margin + (sceneA.position.x - minX) * scaleX;
      const yA = margin + (sceneA.position.z - minZ) * scaleZ;
      
      scenes.forEach((sceneB, indexB) => {
        if (indexA >= indexB || !sceneB.position) return;
        
        const xB = margin + (sceneB.position.x - minX) * scaleX;
        const yB = margin + (sceneB.position.z - minZ) * scaleZ;
        
        // Calcular distância entre os pontos
        const distance = Math.sqrt(
          Math.pow(sceneA.position.x - sceneB.position.x, 2) +
          Math.pow(sceneA.position.z - sceneB.position.z, 2)
        );
        
        // Só desenha conexões para pontos próximos (< 10 metros)
        if (distance < 10) {
          ctx.beginPath();
          ctx.moveTo(xA, yA);
          ctx.lineTo(xB, yB);
          ctx.stroke();
        }
      });
    });
    
    // Desenhar pontos de navegação na planta
    scenes.forEach((scene, index) => {
      if (!scene.position) return;
      
      // Converter coordenadas 3D para coordenadas 2D na planta
      const x = margin + (scene.position.x - minX) * scaleX;
      const y = margin + (scene.position.z - minZ) * scaleZ;
      
      // Tamanho do ponto
      const radius = index === currentSceneIndex ? 12 : 8;
      
      // Desenhar círculo externo (efeito de halo)
      ctx.beginPath();
      ctx.fillStyle = 'rgba(33, 150, 243, 0.2)';
      ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Desenhar ponto
      ctx.beginPath();
      if (index === currentSceneIndex) {
        // Cena atual - ponto maior e destacado
        ctx.fillStyle = '#4CAF50';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
      } else {
        // Outras cenas
        ctx.fillStyle = '#2196F3';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
      }
      
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Adicionar número do ponto
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(index + 1, x, y);
      
      // Adicionar texto com nome da cena abaixo do ponto
      ctx.fillStyle = '#000';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(scene.name.substring(0, 15), x, y + radius + 15);
    });
    
    // Adicionar manipulador de cliques para navegação pela planta
    canvas.style.cursor = 'pointer';
    canvas.onclick = function(event) {
      const rect = canvas.getBoundingClientRect();
      const scaleFactorX = canvas.width / rect.width;
      const scaleFactorY = canvas.height / rect.height;
      
      const clickX = (event.clientX - rect.left) * scaleFactorX;
      const clickY = (event.clientY - rect.top) * scaleFactorY;
      
      // Encontrar o ponto de navegação mais próximo do clique
      let nearestIndex = -1;
      let minDistance = Infinity;
      
      scenes.forEach((scene, index) => {
        if (!scene.position) return;
        
        const x = margin + (scene.position.x - minX) * scaleX;
        const y = margin + (scene.position.z - minZ) * scaleZ;
        
        const distance = Math.sqrt(Math.pow(clickX - x, 2) + Math.pow(clickY - y, 2));
        
        if (distance < 25 && distance < minDistance) {
          minDistance = distance;
          nearestIndex = index;
        }
      });
      
      // Se encontrou um ponto próximo, navega para a cena
      if (nearestIndex !== -1 && nearestIndex !== currentSceneIndex) {
        // Efeito de clique
        const scene = scenes[nearestIndex];
        if (scene && scene.position) {
          const x = margin + (scene.position.x - minX) * scaleX;
          const y = margin + (scene.position.z - minZ) * scaleZ;
          
          // Animar efeito de clique
          ctx.beginPath();
          ctx.fillStyle = 'rgba(76, 175, 80, 0.5)';
          ctx.arc(x, y, 20, 0, Math.PI * 2);
          ctx.fill();
          
          // Fechar o diálogo da planta após um breve delay
          setTimeout(() => {
            const dialog = document.getElementById('expanded-floor-plan');
            if (dialog) {
              document.body.removeChild(dialog);
            }
            
            // Navegar para a cena
            navigateToScene(nearestIndex);
          }, 300);
        }
      }
    };
  }
  
  // Função para adicionar interatividade à planta baixa expandida
  function setupFloorPlanInteraction(canvas) {
    const contentDiv = canvas.parentElement;
    let isDragging = false;
    let lastX, lastY;
    let scale = 1;
    let offsetX = 0, offsetY = 0;
    
    // Aplicar transformação
    function applyTransform() {
      canvas.style.transform = `scale(${scale}) translate(${offsetX}px, ${offsetY}px)`;
    }
    
    // Funções para zoom e pan
    contentDiv.addEventListener('wheel', function(e) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      scale = Math.max(0.5, Math.min(3, scale + delta));
      applyTransform();
    });
    
    canvas.addEventListener('mousedown', function(e) {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      
      const dx = (e.clientX - lastX) / scale;
      const dy = (e.clientY - lastY) / scale;
      
      offsetX += dx;
      offsetY += dy;
      
      lastX = e.clientX;
      lastY = e.clientY;
      
      applyTransform();
    });
    
    document.addEventListener('mouseup', function() {
      isDragging = false;
      canvas.style.cursor = 'pointer';
    });
    
    // Conectar botões de zoom
    const dialog = canvas.closest('.expanded-floor-plan');
    if (dialog) {
      dialog.querySelector('.zoom-in-btn').addEventListener('click', function() {
        scale = Math.min(3, scale + 0.2);
        applyTransform();
      });
      
      dialog.querySelector('.zoom-out-btn').addEventListener('click', function() {
        scale = Math.max(0.5, scale - 0.2);
        applyTransform();
      });
      
      dialog.querySelector('.reset-view-btn').addEventListener('click', function() {
        scale = 1;
        offsetX = 0;
        offsetY = 0;
        applyTransform();
      });
    }
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
    if (!isMeasuring) return;
    
    // Nova abordagem baseada em panorâmicas
    if (panoramaSphere) {
      // Coordenadas do mouse normalizadas (-1 a 1)
      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );
      
      // Configura raycaster para obter direção a partir da câmera
      raycaster.setFromCamera(mouse, camera);
      
      // Direção normalizada do raio
      const direction = raycaster.ray.direction.clone();
      
      // Criar ponto de medição com informações necessárias
      const measurementPoint = {
        direction: direction,
        screenPosition: { x: event.clientX, y: event.clientY }
      };
      
      // Adicionar ponto à lista de pontos de medição
      measurementPoints.push(measurementPoint);
      
      // Criar indicador visual para o ponto de medição
      createMeasurementMarker(event.clientX, event.clientY, measurementPoints.length);
      
      // Se tivermos dois pontos, podemos estimar a distância
      if (measurementPoints.length === 2) {
        displayPanoramaMeasurement();
      } else {
        showMessage('Clique no segundo ponto para medir a distância');
      }
      
      return;
    }
    
    // Fallback para método antigo baseado na nuvem de pontos
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
  
  // Criar marcador visual para ponto de medição em panorâmica
  function createMeasurementMarker(x, y, pointNumber) {
    // Criar elemento HTML para o marcador
    const marker = document.createElement('div');
    marker.className = 'measurement-marker';
    marker.style.position = 'absolute';
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    marker.style.width = '24px';
    marker.style.height = '24px';
    marker.style.marginLeft = '-12px';
    marker.style.marginTop = '-12px';
    marker.style.borderRadius = '50%';
    marker.style.backgroundColor = pointNumber === 1 ? 'rgba(33, 150, 243, 0.7)' : 'rgba(76, 175, 80, 0.7)';
    marker.style.border = '2px solid white';
    marker.style.boxShadow = '0 0 5px rgba(0, 0, 0, 0.5)';
    marker.style.zIndex = '1000';
    marker.style.display = 'flex';
    marker.style.justifyContent = 'center';
    marker.style.alignItems = 'center';
    marker.style.color = 'white';
    marker.style.fontWeight = 'bold';
    marker.style.fontSize = '14px';
    marker.textContent = pointNumber.toString();
    
    document.body.appendChild(marker);
    
    // Guardar referência ao marcador
    if (measurementPoints.length > 0) {
      const lastPoint = measurementPoints[measurementPoints.length - 1];
      lastPoint.marker = marker;
    }
  }
  
  // Exibir controles para estimativa de distância em medição panorâmica
  function displayPanoramaMeasurement() {
    if (measurementPoints.length !== 2) return;
    
    const point1 = measurementPoints[0];
    const point2 = measurementPoints[1];
    
    // Calcular ângulo entre as direções
    const angle = point1.direction.angleTo(point2.direction);
    
    // Exibir painel de controle para estimativa de distância
    const controlPanel = document.createElement('div');
    controlPanel.className = 'distance-control-panel';
    controlPanel.style.position = 'absolute';
    controlPanel.style.bottom = '100px';
    controlPanel.style.left = '50%';
    controlPanel.style.transform = 'translateX(-50%)';
    controlPanel.style.padding = '15px';
    controlPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    controlPanel.style.borderRadius = '8px';
    controlPanel.style.color = 'white';
    controlPanel.style.zIndex = '1000';
    controlPanel.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.3)';
    
    // Estimativa inicial de distância (assumindo que os pontos estão a 3m da câmera)
    const estimatedDistance = 3;
    
    // Calcular distância real entre os pontos 3D usando a estimativa
    const worldPos1 = camera.position.clone().add(
      point1.direction.clone().multiplyScalar(estimatedDistance)
    );
    
    const worldPos2 = camera.position.clone().add(
      point2.direction.clone().multiplyScalar(estimatedDistance)
    );
    
    const initialDistance = worldPos1.distanceTo(worldPos2);
    
    controlPanel.innerHTML = `
      <h3 style="margin-top: 0; font-size: 16px;">Estimativa de Distância</h3>
      <p>Aproximadamente quanto os pontos estão distantes de você?</p>
      
      <div style="display: flex; align-items: center; margin: 15px 0;">
        <button id="distance-decrease" style="width: 30px; height: 30px; background: #333; color: white; border: none; border-radius: 4px;">-</button>
        <input type="range" id="distance-slider" min="0.5" max="15" step="0.5" value="3" style="flex: 1; margin: 0 10px;">
        <button id="distance-increase" style="width: 30px; height: 30px; background: #333; color: white; border: none; border-radius: 4px;">+</button>
      </div>
      
      <div style="margin-bottom: 10px; display: flex; justify-content: space-between;">
        <span>Distância da câmera: <span id="camera-distance">3.0</span>m</span>
        <span>Distância entre pontos: <span id="points-distance">${initialDistance.toFixed(2)}</span>m</span>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-top: 15px;">
        <button id="cancel-measurement" style="padding: 8px 15px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
        <button id="confirm-measurement" style="padding: 8px 15px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Confirmar</button>
      </div>
    `;
    
    document.body.appendChild(controlPanel);
    
    // Criar preview da linha de medição
    createMeasurementLine(estimatedDistance);
    
    // Adicionar eventos aos controles
    const slider = document.getElementById('distance-slider');
    const cameraDistanceSpan = document.getElementById('camera-distance');
    const pointsDistanceSpan = document.getElementById('points-distance');
    
    slider.addEventListener('input', function() {
      const distance = parseFloat(this.value);
      cameraDistanceSpan.textContent = distance.toFixed(1);
      
      // Atualizar linha de medição
      updateMeasurementLine(distance);
      
      // Calcular e mostrar distância entre pontos
      const pos1 = camera.position.clone().add(
        point1.direction.clone().multiplyScalar(distance)
      );
      
      const pos2 = camera.position.clone().add(
        point2.direction.clone().multiplyScalar(distance)
      );
      
      const pointsDistance = pos1.distanceTo(pos2);
      pointsDistanceSpan.textContent = pointsDistance.toFixed(2);
    });
    
    document.getElementById('distance-decrease').addEventListener('click', function() {
      const currentValue = parseFloat(slider.value);
      if (currentValue > parseFloat(slider.min)) {
        slider.value = (currentValue - 0.5).toString();
        slider.dispatchEvent(new Event('input'));
      }
    });
    
    document.getElementById('distance-increase').addEventListener('click', function() {
      const currentValue = parseFloat(slider.value);
      if (currentValue < parseFloat(slider.max)) {
        slider.value = (currentValue + 0.5).toString();
        slider.dispatchEvent(new Event('input'));
      }
    });
    
    document.getElementById('cancel-measurement').addEventListener('click', function() {
      clearMeasurement();
      document.body.removeChild(controlPanel);
    });
    
    document.getElementById('confirm-measurement').addEventListener('click', function() {
      const distance = parseFloat(slider.value);
      const pointsDistance = parseFloat(pointsDistanceSpan.textContent);
      
      // Finalizar medição com a distância confirmada
      finalizeMeasurement(distance, pointsDistance);
      
      // Remover painel de controle
      document.body.removeChild(controlPanel);
    });
  }
  
  // Criar linha de medição baseada em panorâmica
  function createMeasurementLine(distance) {
    // Remover linha existente se houver
    if (measurementLine) {
      scene.remove(measurementLine);
      measurementLine = null;
    }
    
    if (measurementPoints.length !== 2) return;
    
    const point1 = measurementPoints[0];
    const point2 = measurementPoints[1];
    
    // Calcular posições 3D com base nas direções e distância
    const pos1 = camera.position.clone().add(
      point1.direction.clone().multiplyScalar(distance)
    );
    
    const pos2 = camera.position.clone().add(
      point2.direction.clone().multiplyScalar(distance)
    );
    
    // Criar geometria da linha
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      pos1.x, pos1.y, pos1.z,
      pos2.x, pos2.y, pos2.z
    ]);
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Material da linha (estilo Matterport)
    const material = new THREE.LineBasicMaterial({
      color: 0x4CAF50,
      linewidth: 2
    });
    
    // Criar linha
    measurementLine = new THREE.Line(geometry, material);
    scene.add(measurementLine);
    
    return { pos1, pos2 };
  }
  
  // Atualizar linha de medição com nova distância
  function updateMeasurementLine(distance) {
    const { pos1, pos2 } = createMeasurementLine(distance);
    
    // Atualizar exibição de distância
    if (measureInfoElement) {
      const pointsDistance = pos1.distanceTo(pos2);
      measureInfoElement.textContent = `Distância: ${pointsDistance.toFixed(2)} m`;
      measureInfoElement.style.display = 'block';
    }
  }
  
  // Finalizar medição e salvar resultado
  function finalizeMeasurement(cameraDistance, pointsDistance) {
    if (measurementPoints.length !== 2) return;
    
    const point1 = measurementPoints[0];
    const point2 = measurementPoints[1];
    
    // Calcular posições 3D finais
    const pos1 = camera.position.clone().add(
      point1.direction.clone().multiplyScalar(cameraDistance)
    );
    
    const pos2 = camera.position.clone().add(
      point2.direction.clone().multiplyScalar(cameraDistance)
    );
    
    // Criar esferas para marcar os pontos no mundo 3D
    const sphereGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });
    
    const sphere1 = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere1.position.copy(pos1);
    scene.add(sphere1);
    
    const sphere2 = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere2.position.copy(pos2);
    scene.add(sphere2);
    
    // Calcular ponto médio para o rótulo
    const midPoint = new THREE.Vector3().addVectors(pos1, pos2).multiplyScalar(0.5);
    
    // Criar rótulo permanente com a distância
    const label = document.createElement('div');
    label.className = 'measurement-label';
    label.style.position = 'absolute';
    label.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    label.style.color = 'white';
    label.style.padding = '5px 10px';
    label.style.borderRadius = '4px';
    label.style.fontSize = '14px';
    label.style.fontWeight = 'bold';
    label.style.pointerEvents = 'none';
    label.style.zIndex = '900';
    label.textContent = `${pointsDistance.toFixed(2)} m`;
    document.body.appendChild(label);
    
    // Guardar medição para atualização quando a câmera mover
    const measurement = {
      points: [pos1.clone(), pos2.clone()],
      label: label,
      line: measurementLine,
      spheres: [sphere1, sphere2]
    };
    
    // Adicionar à lista de medições
    if (!window.measurements) window.measurements = [];
    window.measurements.push(measurement);
    
    // Atualizar posição inicial do rótulo
    updateMeasurementLabelPosition(measurement);
    
    // Limpar estado de medição temporária
    measurementLine = null;  // Removemos a referência, mas mantemos o objeto na cena
    measurementPoints = [];
    
    // Remover marcadores temporários
    document.querySelectorAll('.measurement-marker').forEach(marker => {
      document.body.removeChild(marker);
    });
    
    showMessage(`Medição adicionada: ${pointsDistance.toFixed(2)} m`);
  }
  
  // Atualizar posição do rótulo de uma medição
  function updateMeasurementLabelPosition(measurement) {
    // Calcular ponto médio
    const midPoint = new THREE.Vector3().addVectors(
      measurement.points[0],
      measurement.points[1]
    ).multiplyScalar(0.5);
    
    // Converter para coordenadas de tela
    const screenPos = worldToScreen(midPoint);
    
    if (screenPos) {
      // Ponto está visível na tela
      measurement.label.style.display = 'block';
      measurement.label.style.left = `${screenPos.x}px`;
      measurement.label.style.top = `${screenPos.y}px`;
    } else {
      // Ponto está fora da tela
      measurement.label.style.display = 'none';
    }
  }
  
  // Atualizar todas as etiquetas de medição
  function updateAllMeasurementLabels() {
    if (!window.measurements) return;
    
    window.measurements.forEach(measurement => {
      updateMeasurementLabelPosition(measurement);
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
    // Sai do modo tag se estiver ativo
    if (isTagMode) {
      isTagMode = false;
    }
    
    // Alterna o modo de medição
    isMeasuring = !isMeasuring;
    
    if (isMeasuring) {
      // Limpa pontos de medição anteriores
      measurementPoints = [];
      
      // Remove linha de medição anterior
      if (measurementLine) {
        scene.remove(measurementLine);
        measurementLine = null;
      }
      
      // Adiciona linha de prévia
      if (!measurementPreview) {
        const previewGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, 0)
        ]);
        const previewMaterial = new THREE.LineBasicMaterial({
          color: 0x00ffff,
          opacity: 0.7,
          transparent: true,
          linewidth: 2
        });
        measurementPreview = new THREE.Line(previewGeometry, previewMaterial);
        scene.add(measurementPreview);
      }
      
      showMessage('Modo medição ativado. Clique em dois pontos para medir a distância.');
    } else {
      // Remove linha de prévia
      if (measurementPreview) {
        scene.remove(measurementPreview);
        measurementPreview = null;
      }
      
      showMessage('Modo medição desativado');
    }
    
    // Atualiza UI
    updateUIState();
  }
  
  // Alterna o modo de adição de tags
  function toggleTagMode() {
    // Sai do modo de medição se estiver ativo
    if (isMeasuring) {
      isMeasuring = false;
      
      // Remove linha de prévia
      if (measurementPreview) {
        scene.remove(measurementPreview);
        measurementPreview = null;
      }
    }
    
    // Alterna o modo de tags
    isTagMode = !isTagMode;
    
    if (isTagMode) {
      showMessage('Modo de tags ativado. Clique para adicionar uma anotação.');
    } else {
      showMessage('Modo de tags desativado');
    }
    
    // Atualiza UI
    updateUIState();
  }
  
  // Alterna a visualização da planta baixa
  function toggleFloorPlan() {
    isFloorPlanVisible = !isFloorPlanVisible;
    
    if (isFloorPlanVisible) {
      // Se temos dados da cena atual com planta baixa
      if (currentSceneData && currentSceneData.files && currentSceneData.files.floor_plan) {
        // Mostra a planta baixa expandida
        toggleExpandedFloorPlan(currentSceneData.files.floor_plan);
        showMessage('Planta baixa ativada');
      } else {
        isFloorPlanVisible = false;
        showMessage('Planta baixa não disponível para esta cena');
      }
    } else {
      // Esconde a planta baixa
      const floorPlanEl = document.getElementById('floor-plan');
      if (floorPlanEl) {
        floorPlanEl.style.display = 'none';
      }
      showMessage('Planta baixa desativada');
    }
    
    // Atualiza UI
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
      
      // Certifica-se de que a nuvem de pontos está visível
      pointClouds.forEach(cloud => {
        if (cloud) cloud.visible = true;
      });
      
      // Guarda posição atual para poder voltar
      savedCameraPosition = {
        position: camera.position.clone(),
        target: controls.target.clone()
      };
      
      // Detectar andares na cena
      const floors = detectFloorsInScene();
      
      // Criar menu de seleção de andares se tiver mais de um andar
      if (floors.length > 1) {
        createFloorSelector(floors);
      }
      
      // Aplicar estilo dollhouse aos objetos (cores por andar)
      applyDollhouseStyle(floors);
      
      // Anima câmera para uma posição elevada com visão de cima
      const sceneCenter = currentSceneData ? currentSceneData.center : [0, 0, 0];
      
      // Posição para a vista de dollhouse (acima e inclinada)
      const dollhousePos = new THREE.Vector3(
        sceneCenter[0] - 8,
        Math.max(15, floorLevel + 15),
        sceneCenter[2] - 8
      );
      
      // Alvo da câmera (centro da cena)
      const dollhouseTarget = new THREE.Vector3(
        sceneCenter[0],
        floorLevel,
        sceneCenter[2]
      );
      
      // Anima a transição para a vista dollhouse
      animateCameraMovement(
        camera.position.clone(),
        dollhousePos,
        controls.target.clone(),
        dollhouseTarget,
        1500
      );
      
      // Ajusta controles para permitir órbita completa
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI;
      controls.minDistance = 2;
      controls.maxDistance = 50;
      
      showMessage('Modo Dollhouse ativado');
    } else {
      // Modo normal - volta para panorâmica
      if (panoramaSphere) {
        panoramaSphere.visible = true;
      }
      
      // Remove elementos da interface do dollhouse
      removeDollhouseUI();
      
      // Remove efeitos visuais do dollhouse
      removeDollhouseStyle();
      
      // Retorna câmera à posição anterior
      if (savedCameraPosition) {
        animateCameraMovement(
          camera.position.clone(),
          savedCameraPosition.position,
          controls.target.clone(),
          savedCameraPosition.target,
          1500
        );
        
        // Restaura limites dos controles
        controls.minPolarAngle = Math.PI * 0.05;
        controls.maxPolarAngle = Math.PI * 0.95;
        controls.minDistance = 0.1;
        controls.maxDistance = 5;
      }
      
      showMessage('Modo normal restaurado');
    }
    
    // Atualiza o estado da UI
    updateUIState();
  }
  
  // Inicia/para o tour automático
  function toggleAutoTour() {
    if (autoTourActive) {
      // Para o tour
      stopAutoTour();
      } else {
      // Inicia o tour
      startAutoTour();
    }
    
    // Atualiza UI
    updateUIState();
  }
  
  // Inicia o tour automático
  function startAutoTour() {
    autoTourActive = true;
    showMessage('Tour automático iniciado');
    
    // Inicia o tour guiado
    startGuidedTour();
  }
  
  // Para o tour automático
  function stopAutoTour() {
    autoTourActive = false;
    
    if (autoTourInterval) {
      clearInterval(autoTourInterval);
      autoTourInterval = null;
    }
    
    showMessage('Tour automático parado');
  }
  
  /*
   * Utilitários de UI
   */
  
  // Atualiza o estado visual dos botões da UI
  function updateUIState() {
    // Atualiza classes ativas nos botões
    const btnDollhouse = document.getElementById('btn-dollhouse');
    if (btnDollhouse) {
      btnDollhouse.classList.toggle('active', isDollhouseMode);
    }
    
    const btnFloorplan = document.getElementById('btn-floorplan');
    if (btnFloorplan) {
      btnFloorplan.classList.toggle('active', isFloorPlanVisible);
    }
    
    const btnMeasure = document.getElementById('btn-measure');
    if (btnMeasure) {
      btnMeasure.classList.toggle('active', isMeasuring);
    }
    
    const btnTags = document.getElementById('btn-tags');
    if (btnTags) {
      btnTags.classList.toggle('active', isTagMode);
    }
    
    const btnTour = document.getElementById('btn-tour');
    if (btnTour) {
      btnTour.classList.toggle('active', autoTourActive);
    }
    
    // Atualiza cursor baseado no modo
    if (isMeasuring) {
      document.body.style.cursor = 'crosshair';
    } else if (isTagMode) {
      document.body.style.cursor = 'cell';
    } else {
      document.body.style.cursor = 'default';
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
    console.log('Criando pontos de navegação');
    
    // Remover pontos de navegação antigos
    const oldNavPoints = document.querySelectorAll('.mp-nav-point');
    oldNavPoints.forEach(point => point.remove());
    
    // Remover pontos 3D antigos
    scene.traverse(obj => {
      if (obj.userData && obj.userData.isNavigationPoint) {
        scene.remove(obj);
      }
    });
    
    // Detectar nível do piso para posicionamento correto
    const floorLevel = detectFloorLevel();
    console.log(`Nível do piso detectado: ${floorLevel}m`);
    
    // Criar container para pontos HTML se não existir
    let container = document.getElementById('nav-points-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'nav-points-container';
      container.style.position = 'absolute';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '100';
      document.body.appendChild(container);
    }
    
    // CORREÇÃO: Verificar se temos a variável global scenes em vez de sceneData
    if (!scenes || scenes.length === 0) {
      console.warn('Sem dados de cena para criar pontos de navegação');
      return;
    }
    
    // Obter a cena atual
    if (currentSceneIndex < 0 || currentSceneIndex >= scenes.length) {
      console.warn('Índice de cena atual inválido');
      return;
    }
    
    const currentScene = scenes[currentSceneIndex];
    if (!currentScene || !currentScene.position) {
      console.warn('Cena atual inválida ou sem posição');
      return;
    }
    
    const currentPosition = new THREE.Vector3(
      currentScene.position.x,
      currentScene.position.y,
      currentScene.position.z
    );
    
    // Armazenar candidatos a pontos de navegação com suas distâncias
    const candidates = [];
    
    // Iterar por todas as cenas e adicionar como candidatos
    scenes.forEach((scene, index) => {
      // Pular a cena atual
      if (index === currentSceneIndex) return;
      
      // Verificar se a cena tem posição
      if (!scene.position) {
        console.warn(`Cena ${index} (${scene.name}) não tem posição`);
        return;
      }
      
      const scenePosition = new THREE.Vector3(
        scene.position.x,
        scene.position.y,
        scene.position.z
      );
      
      // Calcular distância entre as cenas
      const distance = currentPosition.distanceTo(scenePosition);
      
      // MELHORIA: Reduzir a distância mínima para 0.8m em vez de 1.5m
      // e aumentar a distância máxima para 40m em vez de 25m
      if (distance >= 0.8 && distance <= 40) {
        candidates.push({
          index,
          scene,
          position: scenePosition,
          distance
        });
      }
    });
    
    // Ordenar candidatos pela distância
    candidates.sort((a, b) => a.distance - b.distance);
    
    // MELHORIA: Garantir que pelo menos os 3 pontos mais próximos sempre apareçam
    // e aumentar o número máximo de pontos de 8 para 15
    const minPoints = 3;
    const maxPoints = 15;
    const navPoints = candidates.slice(0, Math.max(minPoints, Math.min(candidates.length, maxPoints)));
    
    // Adicionar pontos de navegação ao container
    navPoints.forEach(point => {
      // Ajustar a altura do ponto para ficar no nível do piso
      const adjustedPosition = new THREE.Vector3(
        point.position.x,
        // MELHORIA: Melhorar o posicionamento vertical dos pontos
        // para ficarem ligeiramente acima do nível do piso (15cm)
        floorLevel + 0.15,
        point.position.z
      );
      
      // Criar ponto de navegação HTML com o novo estilo
      createHtmlNavPoint(
        adjustedPosition,
        point.scene.name,
        point.index,
        point.distance
      );
    });
    
    // Atualizar as posições iniciais
    updateNavPointsPositions();
  }

  // Função melhorada para criar pontos de navegação HTML
  function createHtmlNavPoint(position3D, name, sceneIndex, distance) {
    // Criar container principal
    const pointContainer = document.createElement('div');
    pointContainer.className = 'mp-nav-point';
    pointContainer.setAttribute('data-scene-index', sceneIndex);
    pointContainer.style.position = 'absolute';
    pointContainer.style.transformOrigin = 'center center';
    pointContainer.style.pointerEvents = 'auto';
    pointContainer.style.cursor = 'pointer';
    
    // Criar círculo exterior (contêiner principal)
    const outerCircle = document.createElement('div');
    outerCircle.className = 'mp-nav-point-outer';
    outerCircle.style.width = '32px';
    outerCircle.style.height = '32px';
    outerCircle.style.borderRadius = '50%';
    outerCircle.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    outerCircle.style.border = '2px solid rgba(255, 255, 255, 0.8)';
    outerCircle.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    outerCircle.style.display = 'flex';
    outerCircle.style.justifyContent = 'center';
    outerCircle.style.alignItems = 'center';
    outerCircle.style.position = 'relative';
    outerCircle.style.animation = 'pulse 2s infinite';
    
    // Criar o círculo interno
    const innerCircle = document.createElement('div');
    innerCircle.className = 'mp-nav-point-inner';
    innerCircle.style.width = '16px';
    innerCircle.style.height = '16px';
    innerCircle.style.borderRadius = '50%';
    innerCircle.style.backgroundColor = 'white';
    innerCircle.style.boxShadow = '0 0 5px rgba(255, 255, 255, 0.8)';
    
    // Adicionar direção (seta)
    const directionArrow = document.createElement('div');
    directionArrow.className = 'mp-nav-point-arrow';
    directionArrow.style.position = 'absolute';
    directionArrow.style.top = '-20px';
    directionArrow.style.left = '50%';
    directionArrow.style.transform = 'translateX(-50%)';
    directionArrow.style.width = '0';
    directionArrow.style.height = '0';
    directionArrow.style.borderLeft = '8px solid transparent';
    directionArrow.style.borderRight = '8px solid transparent';
    directionArrow.style.borderBottom = '12px solid white';
    directionArrow.style.opacity = '0';
    directionArrow.style.transition = 'opacity 0.3s ease';
    
    // Tooltip com nome da cena e distância
    const tooltip = document.createElement('div');
    tooltip.className = 'mp-nav-point-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.bottom = '40px';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translateX(-50%)';
    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '5px 10px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.whiteSpace = 'nowrap';
    tooltip.style.fontSize = '12px';
    tooltip.style.fontWeight = 'bold';
    tooltip.style.opacity = '0';
    tooltip.style.transition = 'opacity 0.3s ease';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '200';
    tooltip.textContent = `${name} (${distance.toFixed(1)}m)`;
    
    // Adicionar os elementos ao DOM
    outerCircle.appendChild(innerCircle);
    pointContainer.appendChild(outerCircle);
    pointContainer.appendChild(directionArrow);
    pointContainer.appendChild(tooltip);
    
    // Adicionar ao container de pontos de navegação
    const container = document.getElementById('nav-points-container');
    container.appendChild(pointContainer);
    
    // Adicionar eventos para interatividade
    pointContainer.addEventListener('mouseenter', () => {
      outerCircle.style.transform = 'scale(1.2)';
      tooltip.style.opacity = '1';
      directionArrow.style.opacity = '1';
    });
    
    pointContainer.addEventListener('mouseleave', () => {
      outerCircle.style.transform = 'scale(1)';
      tooltip.style.opacity = '0';
      directionArrow.style.opacity = '0';
    });
    
    pointContainer.addEventListener('click', handleNavPointClick);
    
    // Efeito de clique
    pointContainer.addEventListener('mousedown', () => {
      outerCircle.style.transform = 'scale(0.9)';
    });
    
    pointContainer.addEventListener('mouseup', () => {
      outerCircle.style.transform = 'scale(1.2)';
    });
    
    // Atualizar rotação do ponto para apontar na direção correta
    updateNavPointDirection(pointContainer, position3D);
    
    // Adicionar CSS global para animação de pulso se ainda não existir
    if (!document.getElementById('nav-points-css')) {
      const style = document.createElement('style');
      style.id = 'nav-points-css';
      style.textContent = `
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(255, 255, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
        }
      `;
      document.head.appendChild(style);
    }
    
    return pointContainer;
  }

  // Nova função para atualizar a direção dos pontos de navegação
  function updateNavPointDirection(pointElement, targetPosition) {
    if (!camera || !targetPosition) return;
    
    // Obter a posição da câmera e direção para o alvo
    const cameraPosition = camera.position.clone();
    const direction = new THREE.Vector3().subVectors(targetPosition, cameraPosition).normalize();
    
    // Calcular o ângulo no plano XZ (horizontal)
    const angle = Math.atan2(direction.x, direction.z) * (180 / Math.PI);
    
    // Aplicar rotação ao elemento da seta
    const arrow = pointElement.querySelector('.mp-nav-point-arrow');
    if (arrow) {
      arrow.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    }
  }

  // Função melhorada para atualizar posições dos pontos de navegação
  function updateNavPointsPositions() {
    const navPoints = document.querySelectorAll('.mp-nav-point');
    
    navPoints.forEach(point => {
      const sceneIndex = parseInt(point.getAttribute('data-scene-index'));
      if (isNaN(sceneIndex) || sceneIndex < 0 || sceneIndex >= scenes.length) return;
      
      const sceneData = scenes[sceneIndex];
      if (!sceneData || !sceneData.position) return;
      
      const position = new THREE.Vector3(
        sceneData.position.x,
        sceneData.position.y,
        sceneData.position.z
      );
      
      // Usar a função melhorada worldToScreen
      const screenPos = worldToScreen(position);
      
      if (screenPos) {
        // Ponto está visível na tela
        point.style.display = 'block';
        point.style.left = `${screenPos.x}px`;
        point.style.top = `${screenPos.y}px`;
        
        // MELHORIA: Adicionar efeito de escala baseado na profundidade
        // Pontos mais distantes aparecem menores, pontos mais próximos aparecem maiores
        const scale = Math.max(0.7, 1 - (screenPos.depth * 0.3));
        point.style.transform = `translate(-50%, -50%) scale(${scale})`;
        
        // Atualizar a direção do ponto
        updateNavPointDirection(point, position);
      } else {
        // Ponto não está visível na tela
        point.style.display = 'none';
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
      
      /* MELHORADO: Pontos de navegação estilo Matterport */
      .mp-nav-point {
        position: absolute;
        width: 40px;
        height: 40px;
        transform: translate(-50%, -50%);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        pointer-events: auto;
        transition: all 0.3s ease;
        z-index: 200;
      }
      
      .mp-nav-point-outer {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.3);
        border: 2px solid rgba(255, 255, 255, 0.9);
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 255, 255, 0.3);
        transition: all 0.3s ease;
        animation: pulse 2s infinite;
      }
      
      .mp-nav-point-inner {
        position: absolute;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background-color: white;
        transition: all 0.3s ease;
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
      }
      
      .mp-nav-point-direction {
        position: absolute;
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-bottom: 12px solid white;
        transform: translateY(16px);
        opacity: 0.6;
        transition: all 0.3s ease;
      }
      
      .mp-nav-point-label {
        position: absolute;
        bottom: -30px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      }
      
      .mp-nav-point:hover .mp-nav-point-label {
        opacity: 1;
      }
      
      .mp-nav-point-hover .mp-nav-point-outer {
        background-color: rgba(0, 153, 255, 0.6);
        border-color: white;
      }
      
      .mp-nav-point-hover .mp-nav-point-inner {
        background-color: white;
        transform: scale(1.1);
      }
      
      @keyframes pulse {
        0% {
          transform: scale(1);
          opacity: 0.8;
        }
        50% {
          transform: scale(1.05);
          opacity: 1;
        }
        100% {
          transform: scale(1);
          opacity: 0.8;
        }
      }
      
      /* Animação de clique */
      @keyframes clickEffect {
        0% {
          transform: translate(-50%, -50%) scale(0.5);
          opacity: 1;
        }
        100% {
          transform: translate(-50%, -50%) scale(2);
          opacity: 0;
        }
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
    console.log('Estilos Matterport aplicados');
    
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
    event.preventDefault();
    event.stopPropagation();
    
    // Obter o elemento pai que contém o atributo data-scene-index
    let target = event.target;
    while (target && !target.hasAttribute('data-scene-index')) {
      target = target.parentElement;
    }
    
    if (!target) {
      console.warn('Clique em elemento sem índice de cena');
      return;
    }
    
    // Obter o índice da cena alvo
    const sceneIndex = parseInt(target.getAttribute('data-scene-index'));
    if (isNaN(sceneIndex)) {
      console.warn('Índice de cena inválido');
      return;
    }
    
    console.log(`Clique em ponto de navegação para cena ${sceneIndex}`);
    
    // Adicionar efeito visual de clique
    const outerCircle = target.querySelector('.mp-nav-point-outer');
    if (outerCircle) {
      outerCircle.style.transform = 'scale(0.8)';
      setTimeout(() => {
        outerCircle.style.transform = 'scale(1)';
      }, 200);
    }
    
    // Navegar para a cena correspondente
    navigateToScene(sceneIndex);
  }

  // Função para alternar entre modo unificado e cena única
  function toggleUnifiedMode() {
    // Inverter o estado atual
    unifiedMode = !unifiedMode;
    
    // Exibir mensagem informativa
    const mensagem = unifiedMode ? 
      'Modo unificado: Todas as nuvens de pontos visíveis' : 
      'Modo único: Apenas nuvem da cena atual visível';
    showMessage(mensagem);
    console.log(mensagem);
    
    // Atualizar a visibilidade das nuvens de pontos
    updatePointCloudsVisibility();
  }

  // Função para atualizar a visibilidade das nuvens de pontos com base no modo
  function updatePointCloudsVisibility() {
    if (!pointClouds || pointClouds.length === 0) {
      console.log('Nenhuma nuvem de pontos para atualizar');
      return;
    }
    
    console.log(`Atualizando visibilidade de ${pointClouds.length} nuvens de pontos (Modo: ${unifiedMode ? 'unificado' : 'único'})`);
    
    if (unifiedMode) {
      // No modo unificado, todas as nuvens ficam visíveis
      pointClouds.forEach(cloud => {
        if (cloud) cloud.visible = true;
      });
      console.log('Todas as nuvens de pontos estão visíveis');
    } else {
      // No modo único, apenas a nuvem da cena atual fica visível
      pointClouds.forEach((cloud, index) => {
        if (cloud) cloud.visible = (index === currentSceneIndex);
      });
      console.log(`Apenas a nuvem da cena ${currentSceneIndex} está visível`);
    }
  }

  // Função para configurar o mini-mapa estilo Matterport
  function setupMiniMap() {
    console.log('Configurando mini-mapa estilo Matterport');
    
    // Cria container para o mini-mapa
    miniMapContainer = document.createElement('div');
    miniMapContainer.id = 'mini-map';
    miniMapContainer.style.position = 'absolute';
    miniMapContainer.style.bottom = '20px';
    miniMapContainer.style.right = '20px';
    miniMapContainer.style.width = '200px';
    miniMapContainer.style.height = '200px';
    miniMapContainer.style.border = '2px solid #fff';
    miniMapContainer.style.borderRadius = '5px';
    miniMapContainer.style.overflow = 'hidden';
    miniMapContainer.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
    miniMapContainer.style.zIndex = '100';
    document.body.appendChild(miniMapContainer);
    
    // Cria cena para o mini-mapa
    miniMap = new THREE.Scene();
    miniMap.background = new THREE.Color(0x333333);
    
    // Cria câmera para visão de topo
    miniMapCamera = new THREE.OrthographicCamera(
      -10, 10, 10, -10, 0.1, 1000
    );
    miniMapCamera.position.set(0, 20, 0);
    miniMapCamera.lookAt(0, 0, 0);
    miniMapCamera.up.set(0, 0, -1); // Ajusta para que o norte fique para cima
    
    // Adiciona iluminação básica
    const light = new THREE.AmbientLight(0xffffff, 1);
    miniMap.add(light);
    
    // Cria renderer separado para o mini-mapa
    const miniMapRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    miniMapRenderer.setSize(200, 200);
    miniMapRenderer.setPixelRatio(window.devicePixelRatio);
    miniMapContainer.appendChild(miniMapRenderer.domElement);
    
    // Cria indicador da posição do usuário
    const markerGeometry = new THREE.CircleGeometry(0.3, 32);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    userPositionMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    userPositionMarker.rotation.x = -Math.PI / 2; // Roda para ficar no plano horizontal
    miniMap.add(userPositionMarker);
    
    // Cria grid de referência
    const gridHelper = new THREE.GridHelper(20, 20, 0x555555, 0x333333);
    gridHelper.rotateX(Math.PI / 2);
    miniMap.add(gridHelper);
    
    // Adiciona botão para alternar a visibilidade do mini-mapa
    const toggleMiniMapButton = document.createElement('button');
    toggleMiniMapButton.textContent = 'Mapa';
    toggleMiniMapButton.className = 'mp-btn';
    toggleMiniMapButton.title = 'Alternar Mini-Mapa';
    toggleMiniMapButton.innerHTML = '🗺️';
    toggleMiniMapButton.style.position = 'absolute';
    toggleMiniMapButton.style.top = '5px';
    toggleMiniMapButton.style.right = '5px';
    toggleMiniMapButton.style.zIndex = '101';
    toggleMiniMapButton.style.width = '30px';
    toggleMiniMapButton.style.height = '30px';
    toggleMiniMapButton.style.padding = '0';
    toggleMiniMapButton.addEventListener('click', toggleMiniMap);
    miniMapContainer.appendChild(toggleMiniMapButton);
    
    // Função para renderizar o mini-mapa
    function renderMiniMap() {
      // Atualiza posição do marcador do usuário
      if (userPositionMarker && camera) {
        userPositionMarker.position.set(camera.position.x, 0, camera.position.z);
        
        // Rotação do marcador para indicar para onde o usuário está olhando
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        const angle = Math.atan2(direction.x, direction.z);
        userPositionMarker.rotation.z = angle;
      }
      
      // Centraliza câmera do mini-mapa na posição do usuário
      if (miniMapCamera && camera) {
        miniMapCamera.position.set(camera.position.x, 20, camera.position.z);
        miniMapCamera.lookAt(camera.position.x, 0, camera.position.z);
      }
      
      // Renderiza mini-mapa
      miniMapRenderer.render(miniMap, miniMapCamera);
      
      // Continua o loop de renderização
      requestAnimationFrame(renderMiniMap);
    }
    
    // Inicia o loop de renderização do mini-mapa
    renderMiniMap();
    
    console.log('Mini-mapa configurado');
    return miniMapRenderer;
  }

  // Função para alternar a visibilidade do mini-mapa
  function toggleMiniMap() {
    isMiniMapVisible = !isMiniMapVisible;
    if (miniMapContainer) {
      miniMapContainer.style.display = isMiniMapVisible ? 'block' : 'none';
    }
  }

  // Função para atualizar o mini-mapa quando uma nova cena é carregada
  function updateMiniMapForScene(sceneData) {
    if (!miniMap) return;
    
    // Limpa pontos de navegação anteriores
    miniMap.children.forEach(child => {
      if (child.userData && child.userData.type === 'navpoint-minimap') {
        miniMap.remove(child);
      }
    });
    
    // Adiciona pontos para todas as cenas no mini-mapa
    if (scenes && scenes.length > 0) {
      scenes.forEach((scene, index) => {
        if (scene.center && Array.isArray(scene.center) && scene.center.length >= 3) {
          // Cria um ponto no mini-mapa para cada cena
          const pointGeometry = new THREE.CircleGeometry(0.2, 16);
          const pointMaterial = new THREE.MeshBasicMaterial({ 
            color: index === currentSceneIndex ? 0x00ff00 : 0x3388ff
          });
          const point = new THREE.Mesh(pointGeometry, pointMaterial);
          point.position.set(scene.center[0], 0, scene.center[2]);
          point.rotation.x = -Math.PI / 2; // Gira para ficar no plano horizontal
          point.userData = {
            type: 'navpoint-minimap',
            sceneIndex: index
          };
          miniMap.add(point);
          
          // Se houver mais de uma cena, conecte os pontos com linhas
          if (index > 0 && scenes[index-1].center) {
            const prevCenter = scenes[index-1].center;
            const lineGeometry = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(prevCenter[0], 0, prevCenter[2]),
              new THREE.Vector3(scene.center[0], 0, scene.center[2])
            ]);
            const lineMaterial = new THREE.LineBasicMaterial({ color: 0x555555 });
            const line = new THREE.Line(lineGeometry, lineMaterial);
            line.userData = { type: 'navpoint-minimap' };
            miniMap.add(line);
          }
        }
      });
    }
    
    // Se tiver planta baixa, adiciona ao mini-mapa
    if (sceneData && sceneData.files && sceneData.files.floor_plan) {
      // Carrega a textura da planta baixa
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(sceneData.files.floor_plan, (texture) => {
        const material = new THREE.MeshBasicMaterial({ 
          map: texture,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide
        });
        
        // Tamanho estimado para a planta baixa
        const width = 15;
        const height = 15;
        const geometry = new THREE.PlaneGeometry(width, height);
        const floorPlan = new THREE.Mesh(geometry, material);
        
        // Posiciona no plano horizontal
        floorPlan.rotation.x = -Math.PI / 2;
        
        // Remove planta baixa anterior se existir
        miniMap.children.forEach(child => {
          if (child.userData && child.userData.type === 'floorplan-minimap') {
            miniMap.remove(child);
          }
        });
        
        floorPlan.userData = { type: 'floorplan-minimap' };
        miniMap.add(floorPlan);
      });
    }
  }

  // Adicionar funcionalidade de captura de tela e compartilhamento
  function setupShareFeatures() {
    // Cria o container para os botões de compartilhamento
    const shareContainer = document.createElement('div');
    shareContainer.style.position = 'absolute';
    shareContainer.style.top = '20px';
    shareContainer.style.right = '20px';
    shareContainer.style.display = 'flex';
    shareContainer.style.flexDirection = 'column';
    shareContainer.style.gap = '10px';
    shareContainer.style.zIndex = '100';
    document.body.appendChild(shareContainer);
    
    // Botão de captura de tela
    const screenshotButton = document.createElement('button');
    screenshotButton.className = 'mp-btn';
    screenshotButton.innerHTML = '📷';
    screenshotButton.title = 'Capturar Tela';
    screenshotButton.addEventListener('click', takeScreenshot);
    shareContainer.appendChild(screenshotButton);
    
    // Botão de compartilhamento
    const shareButton = document.createElement('button');
    shareButton.className = 'mp-btn';
    shareButton.innerHTML = '🔗';
    shareButton.title = 'Compartilhar';
    shareButton.addEventListener('click', shareScene);
    shareContainer.appendChild(shareButton);
    
    // Botão de tour virtual
    const tourButton = document.createElement('button');
    tourButton.className = 'mp-btn';
    tourButton.innerHTML = '🎬';
    tourButton.title = 'Iniciar Tour Virtual';
    tourButton.addEventListener('click', startGuidedTour);
    shareContainer.appendChild(tourButton);
    
    console.log('Recursos de compartilhamento configurados');
  }

  // Função para capturar uma imagem da cena atual
  function takeScreenshot() {
    try {
      // Oculta elementos da UI temporariamente
      const elementsToHide = [
        document.getElementById('info'),
        document.getElementById('measure-info'),
        miniMapContainer,
        document.querySelector('.mp-controls'),
        document.querySelector('.mp-top-bar'),
        document.querySelector('.mp-side-controls')
      ];
      
      elementsToHide.forEach(el => {
        if (el) el.style.visibility = 'hidden';
      });
      
      // Renderiza a cena
      renderer.render(scene, camera);
      
      // Captura a imagem
      const dataURL = renderer.domElement.toDataURL('image/png');
      
      // Restaura visibilidade dos elementos
      elementsToHide.forEach(el => {
        if (el) el.style.visibility = 'visible';
      });
      
      // Cria um link para download da imagem
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = `matterport-clone-${currentSceneData?.name || 'scene'}.png`;
      link.click();
      
      showMessage('Screenshot capturado!');
    } catch (error) {
      console.error('Erro ao capturar screenshot:', error);
      showMessage('Erro ao capturar screenshot');
    }
  }

  // Função para compartilhar a cena atual
  function shareScene() {
    // Gera URL com parâmetros para a cena atual
    const url = new URL(window.location.href);
    
    // Limpa parâmetros existentes
    url.search = '';
    
    // Adiciona parâmetros para a cena atual
    if (currentSceneIndex !== undefined) {
      url.searchParams.set('scene', currentSceneIndex);
    }
    
    // Adiciona posição e orientação da câmera
    if (camera) {
      url.searchParams.set('pos', `${camera.position.x.toFixed(2)},${camera.position.y.toFixed(2)},${camera.position.z.toFixed(2)}`);
      
      // Adiciona direção da câmera
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      url.searchParams.set('dir', `${direction.x.toFixed(2)},${direction.y.toFixed(2)},${direction.z.toFixed(2)}`);
    }
    
    // Adiciona modo atual
    url.searchParams.set('mode', isDollhouseMode ? 'dollhouse' : 'panorama');
    
    // Cria caixa de diálogo para compartilhamento
    const shareDialog = document.createElement('div');
    shareDialog.style.position = 'fixed';
    shareDialog.style.top = '50%';
    shareDialog.style.left = '50%';
    shareDialog.style.transform = 'translate(-50%, -50%)';
    shareDialog.style.background = 'rgba(0, 0, 0, 0.9)';
    shareDialog.style.color = 'white';
    shareDialog.style.padding = '20px';
    shareDialog.style.borderRadius = '10px';
    shareDialog.style.zIndex = '1000';
    shareDialog.style.maxWidth = '500px';
    shareDialog.style.width = '80%';
    shareDialog.style.textAlign = 'center';
    
    shareDialog.innerHTML = `
      <h3>Compartilhar esta Cena</h3>
      <p>Copie o link abaixo para compartilhar esta visualização exata:</p>
      <input type="text" value="${url.toString()}" style="width:100%; padding:10px; margin:10px 0; border-radius:5px;" readonly onclick="this.select()">
      <div style="display:flex; justify-content:center; gap:10px; margin-top:20px;">
        <button id="copy-link" style="padding:8px 15px; background:#4CAF50; color:white; border:none; border-radius:5px; cursor:pointer;">Copiar Link</button>
        <button id="close-dialog" style="padding:8px 15px; background:#f44336; color:white; border:none; border-radius:5px; cursor:pointer;">Fechar</button>
      </div>
    `;
    
    document.body.appendChild(shareDialog);
    
    // Adiciona eventos
    document.getElementById('copy-link').addEventListener('click', () => {
      const input = shareDialog.querySelector('input');
      input.select();
      document.execCommand('copy');
      showMessage('Link copiado para área de transferência!');
    });
    
    document.getElementById('close-dialog').addEventListener('click', () => {
      document.body.removeChild(shareDialog);
    });
  }

  // Função para iniciar um tour guiado
  function startGuidedTour() {
    if (scenes.length < 2) {
      showMessage('Não há cenas suficientes para um tour');
      return;
    }
    
    showMessage('Iniciando tour virtual...');
    
    // Array para controlar quais cenas já foram visitadas
    const visitedScenes = new Array(scenes.length).fill(false);
    visitedScenes[currentSceneIndex] = true;
    
    // Função recursiva para visitar próxima cena
    function visitNextScene() {
      // Verifica se todas as cenas foram visitadas
      if (visitedScenes.every(visited => visited)) {
        showMessage('Tour virtual completo!');
        return;
      }
      
      // Encontra cenas adjacentes (próximas) da cena atual
      const currentCenter = scenes[currentSceneIndex].center;
      let nearestSceneIndex = -1;
      let shortestDistance = Infinity;
      
      scenes.forEach((scene, index) => {
        if (!visitedScenes[index] && scene.center) {
          const distance = Math.sqrt(
            Math.pow(currentCenter[0] - scene.center[0], 2) +
            Math.pow(currentCenter[1] - scene.center[1], 2) +
            Math.pow(currentCenter[2] - scene.center[2], 2)
          );
          
          if (distance < shortestDistance) {
            shortestDistance = distance;
            nearestSceneIndex = index;
          }
        }
      });
      
      // Se encontrou uma próxima cena
      if (nearestSceneIndex !== -1) {
        visitedScenes[nearestSceneIndex] = true;
        
        // Navega para a próxima cena
        setTimeout(() => {
          navigateToScene(nearestSceneIndex);
          
          // Após a transição, agenda a próxima navegação
          setTimeout(visitNextScene, 5000); // 5 segundos em cada cena
        }, 1000);
      } else {
        showMessage('Tour virtual completo!');
      }
    }
    
    // Inicia o tour
    setTimeout(visitNextScene, 2000);
  }

  // Adicionar função de processamento de parâmetros de URL
  function processUrlParameters() {
    console.log('Processando parâmetros da URL...');
    
    const urlParams = new URLSearchParams(window.location.search);
    
    // Se temos parâmetro de cena, carregamos a cena especificada
    if (urlParams.has('scene')) {
      const sceneIndex = parseInt(urlParams.get('scene'));
      if (!isNaN(sceneIndex) && sceneIndex >= 0 && scenes && sceneIndex < scenes.length) {
        console.log(`Carregando cena ${sceneIndex} da URL`);
        setTimeout(() => {
          navigateToScene(sceneIndex);
        }, 1000); // Pequeno delay para garantir que a cena inicial foi carregada
      }
    }
    
    // Se temos parâmetros de posição da câmera
    if (urlParams.has('pos')) {
      try {
        const posValues = urlParams.get('pos').split(',').map(v => parseFloat(v));
        if (posValues.length === 3 && posValues.every(v => !isNaN(v))) {
          setTimeout(() => {
            camera.position.set(posValues[0], posValues[1], posValues[2]);
            console.log(`Câmera posicionada em [${posValues.join(', ')}] da URL`);
          }, 1500);
        }
      } catch (e) {
        console.warn('Erro ao processar parâmetro de posição da URL:', e);
      }
    }
    
    // Se temos parâmetros de direção da câmera
    if (urlParams.has('dir')) {
      try {
        const dirValues = urlParams.get('dir').split(',').map(v => parseFloat(v));
        if (dirValues.length === 3 && dirValues.every(v => !isNaN(v))) {
          setTimeout(() => {
            const lookAt = new THREE.Vector3(
              camera.position.x + dirValues[0],
              camera.position.y + dirValues[1],
              camera.position.z + dirValues[2]
            );
            controls.target.copy(lookAt);
            controls.update();
            console.log(`Câmera direcionada para [${dirValues.join(', ')}] da URL`);
          }, 1500);
        }
      } catch (e) {
        console.warn('Erro ao processar parâmetro de direção da URL:', e);
      }
    }
    
    // Se temos parâmetro de modo (dollhouse ou panorama)
    if (urlParams.has('mode')) {
      setTimeout(() => {
        const mode = urlParams.get('mode').toLowerCase();
        if (mode === 'dollhouse' && !isDollhouseMode) {
          toggleDollhouseMode();
          console.log('Modo dollhouse ativado da URL');
        } else if (mode === 'panorama' && isDollhouseMode) {
          toggleDollhouseMode();
          console.log('Modo panorama ativado da URL');
        }
      }, 2000);
    }
    
    // Se temos parâmetro para iniciar tour automático
    if (urlParams.has('tour') && urlParams.get('tour') === 'true') {
      setTimeout(() => {
        startGuidedTour();
        console.log('Tour automático iniciado da URL');
      }, 3000);
    }
    
    console.log('Processamento de parâmetros da URL concluído');
  }

  // Adicionar funcionalidade de incorporação (embed)
  function setupEmbedFeatures() {
    // Verifica se estamos em modo incorporado
    const isEmbedded = window.location.search.includes('embed=true');
    
    if (isEmbedded) {
      console.log('Executando em modo incorporado');
      
      // Ajusta estilos para modo incorporado
      document.body.classList.add('embedded');
      
      // Adiciona estilos CSS para modo incorporado
      const embedStyles = document.createElement('style');
      embedStyles.textContent = `
        body.embedded .mp-top-bar {
          height: 40px;
        }
        body.embedded .mp-controls {
          transform: scale(0.8);
          bottom: 10px;
        }
        body.embedded #mini-map {
          transform: scale(0.8);
          bottom: 10px;
          right: 10px;
        }
        body.embedded #info {
          font-size: 12px;
          padding: 5px;
        }
      `;
      document.head.appendChild(embedStyles);
      
      // Adiciona logo da marca
      const logoContainer = document.createElement('div');
      logoContainer.style.position = 'absolute';
      logoContainer.style.bottom = '10px';
      logoContainer.style.left = '10px';
      logoContainer.style.zIndex = '100';
      logoContainer.style.background = 'rgba(0,0,0,0.5)';
      logoContainer.style.padding = '5px';
      logoContainer.style.borderRadius = '5px';
      
      logoContainer.innerHTML = '<span style="color:white; font-weight:bold;">Matterport Clone</span>';
      document.body.appendChild(logoContainer);
      
      // Adiciona botão para abrir em modo fullscreen
      const fullscreenButton = document.createElement('button');
      fullscreenButton.className = 'mp-btn';
      fullscreenButton.innerHTML = '🔍';
      fullscreenButton.title = 'Abrir em tela cheia';
      fullscreenButton.style.position = 'absolute';
      fullscreenButton.style.top = '10px';
      fullscreenButton.style.left = '10px';
      fullscreenButton.style.zIndex = '100';
      
      fullscreenButton.addEventListener('click', () => {
        const url = new URL(window.location.href);
        url.searchParams.delete('embed');
        window.open(url.toString(), '_blank');
      });
      
      document.body.appendChild(fullscreenButton);
    }
  }

  // Função para atualizar a URL com informações da cena atual para compartilhamento
  function updateURLWithSceneInfo(sceneIndex) {
    // Apenas atualiza se o navegador suporta history API
    if (!window.history || !window.history.replaceState) return;
    
    try {
      // Cria uma nova URL baseada na atual
      const url = new URL(window.location.href);
      
      // Adiciona o parâmetro de cena
      if (sceneIndex !== undefined) {
        url.searchParams.set('scene', sceneIndex);
      } else {
        url.searchParams.delete('scene');
      }
      
      // Adiciona a posição da câmera atual
      if (camera) {
        const posStr = `${camera.position.x.toFixed(2)},${camera.position.y.toFixed(2)},${camera.position.z.toFixed(2)}`;
        url.searchParams.set('pos', posStr);
        
        // Adiciona a direção da câmera
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const dirStr = `${dir.x.toFixed(2)},${dir.y.toFixed(2)},${dir.z.toFixed(2)}`;
        url.searchParams.set('dir', dirStr);
      }
      
      // Atualiza a URL sem recarregar a página
      window.history.replaceState({sceneIndex}, document.title, url.toString());
      
      console.log(`URL atualizada para compartilhamento: ${url.toString()}`);
    } catch (error) {
      console.warn('Erro ao atualizar URL:', error);
    }
  }

  // Função para converter posição 3D para coordenadas de tela
  function worldToScreen(position) {
    // Clonar a posição para não modificar o original
    const vector = new THREE.Vector3().copy(position);
    
    // Projetar a posição 3D para o espaço da tela
    vector.project(camera);
    
    // Converter para coordenadas de pixels
    const widthHalf = window.innerWidth / 2;
    const heightHalf = window.innerHeight / 2;
    
    const x = (vector.x * widthHalf) + widthHalf;
    const y = -(vector.y * heightHalf) + heightHalf;
    
    // Verificar se o ponto está dentro da tela e na frente da câmera
    // Agora com uma verificação mais robusta para a visibilidade
    if (x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight || vector.z > 1) {
      return null; // Ponto fora da tela ou atrás da câmera
    }
    
    // Calculamos também a "profundidade" normalizada do ponto para efeitos visuais
    // valores próximos de 0 estão mais perto, valores próximos de 1 estão mais longe
    const depth = (vector.z + 1) / 2;
    
    return { x, y, depth };
  }

  // Atualiza a pré-visualização da linha de medição
  function updateMeasurementPreview(intersects) {
    // Se não temos o primeiro ponto, não fazemos nada
    if (measurementPoints.length !== 1) return;
    
    // Se estamos usando panorâmicas
    if (panoramaSphere && measurementPoints[0].direction) {
      // Obter posição do mouse
      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );
      
      // Calcular direção do raio
      raycaster.setFromCamera(mouse, camera);
      const direction = raycaster.ray.direction.clone();
      
      // Distância estimada padrão para pré-visualização
      const estimatedDistance = 5; // 5 metros
      
      // Calcular pontos 3D
      const pos1 = camera.position.clone().add(
        measurementPoints[0].direction.clone().multiplyScalar(estimatedDistance)
      );
      
      const pos2 = camera.position.clone().add(
        direction.clone().multiplyScalar(estimatedDistance)
      );
      
      // Criar ou atualizar linha de pré-visualização
      if (measurementPreview) {
        const positions = measurementPreview.geometry.attributes.position.array;
        positions[0] = pos1.x;
        positions[1] = pos1.y;
        positions[2] = pos1.z;
        positions[3] = pos2.x;
        positions[4] = pos2.y;
        positions[5] = pos2.z;
        measurementPreview.geometry.attributes.position.needsUpdate = true;
      } else {
        // Criar linha de pré-visualização
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array([
          pos1.x, pos1.y, pos1.z,
          pos2.x, pos2.y, pos2.z
        ]);
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.LineDashedMaterial({
          color: 0xff0000,
          dashSize: 0.2,
          gapSize: 0.1,
          linewidth: 2
        });
        
        measurementPreview = new THREE.Line(geometry, material);
        measurementPreview.computeLineDistances(); // Necessário para linhas tracejadas
        scene.add(measurementPreview);
      }
      
      // Atualizar distância exibida
      if (measureInfoElement) {
        const distance = pos1.distanceTo(pos2);
        measureInfoElement.textContent = `Distância aproximada: ${distance.toFixed(2)} m`;
        measureInfoElement.style.display = 'block';
      }
      
      return;
    }
    
    // Fallback para nuvem de pontos
    if (!intersects || intersects.length === 0) return;
    
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
        linewidth: 2
      });
      
      measurementPreview = new THREE.Line(geometry, material);
      scene.add(measurementPreview);
      
      // Exibe o elemento de informação de medição
      if (measureInfoElement) {
        measureInfoElement.style.display = 'block';
      }
    }
  }

  // Limpar medição completa
  function clearMeasurement() {
    // Limpar pontos temporários
    clearMeasurementPoints();
    
    // Remover linha de medição
    if (measurementLine) {
      scene.remove(measurementLine);
      measurementLine = null;
    }
    
    // Remover linha de preview
    if (measurementPreview) {
      scene.remove(measurementPreview);
      measurementPreview = null;
    }
    
    // Esconder info de medição
    if (measureInfoElement) {
      measureInfoElement.style.display = 'none';
    }
  }

  // Função para detectar andares na cena
  function detectFloorsInScene() {
    const floors = [];
    const floorHeights = new Set();
    
    // Altura do piso detectada
    const baseFloorLevel = detectFloorLevel();
    floorHeights.add(baseFloorLevel);
    
    // Buscar alturas de andares a partir das posições das cenas
    scenes.forEach(scene => {
      if (scene.position) {
        const y = scene.position.y;
        
        // Consideramos que diferenças maiores que 2 metros indicam andares diferentes
        if (Math.abs(y - baseFloorLevel) > 2) {
          floorHeights.add(Math.round(y * 2) / 2); // Arredonda para o 0.5m mais próximo
        }
      }
    });
    
    // Converte para array e ordena
    const sortedHeights = Array.from(floorHeights).sort((a, b) => a - b);
    
    // Atribui nomes aos andares (Térreo, 1º Andar, etc.)
    sortedHeights.forEach((height, index) => {
      let name;
      if (index === 0) {
        name = "Térreo";
      } else {
        name = `${index}º Andar`;
      }
      
      floors.push({
        index,
        height,
        name
      });
    });
    
    return floors;
  }

  // Cria seletor de andares para modo dollhouse
  function createFloorSelector(floors) {
    // Remove seletor anterior se existir
    removeDollhouseUI();
    
    // Criar container para o seletor de andares
    const selectorContainer = document.createElement('div');
    selectorContainer.id = 'floor-selector';
    selectorContainer.className = 'floor-selector';
    selectorContainer.style.position = 'absolute';
    selectorContainer.style.top = '50%';
    selectorContainer.style.right = '20px';
    selectorContainer.style.transform = 'translateY(-50%)';
    selectorContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    selectorContainer.style.borderRadius = '8px';
    selectorContainer.style.padding = '10px';
    selectorContainer.style.zIndex = '100';
    selectorContainer.style.display = 'flex';
    selectorContainer.style.flexDirection = 'column';
    selectorContainer.style.alignItems = 'center';
    selectorContainer.style.gap = '10px';
    
    // Título
    const title = document.createElement('div');
    title.textContent = 'Andares';
    title.style.color = 'white';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '5px';
    selectorContainer.appendChild(title);
    
    // Botões para cada andar (ordem inversa para ter térreo embaixo)
    [...floors].reverse().forEach(floor => {
      const button = document.createElement('button');
      button.className = 'floor-button';
      button.textContent = floor.name;
      button.dataset.floorHeight = floor.height;
      button.style.padding = '8px 15px';
      button.style.backgroundColor = '#2196F3';
      button.style.color = 'white';
      button.style.border = 'none';
      button.style.borderRadius = '4px';
      button.style.cursor = 'pointer';
      button.style.width = '100%';
      
      // Evento para focar neste andar
      button.addEventListener('click', () => {
        focusOnFloor(floor.height);
        
        // Destacar botão selecionado
        document.querySelectorAll('.floor-button').forEach(btn => {
          btn.style.backgroundColor = '#2196F3';
        });
        button.style.backgroundColor = '#4CAF50';
      });
      
      selectorContainer.appendChild(button);
    });
    
    // Botão para vista explosionada (todos os andares)
    const explodedViewBtn = document.createElement('button');
    explodedViewBtn.textContent = 'Vista Explodida';
    explodedViewBtn.style.padding = '8px 15px';
    explodedViewBtn.style.backgroundColor = '#FF9800';
    explodedViewBtn.style.color = 'white';
    explodedViewBtn.style.border = 'none';
    explodedViewBtn.style.borderRadius = '4px';
    explodedViewBtn.style.cursor = 'pointer';
    explodedViewBtn.style.width = '100%';
    explodedViewBtn.style.marginTop = '10px';
    
    explodedViewBtn.addEventListener('click', createExplodedView);
    selectorContainer.appendChild(explodedViewBtn);
    
    document.body.appendChild(selectorContainer);
  }
  
  // Focar em um andar específico
  function focusOnFloor(floorHeight) {
    // Encontrar altura do teto (aproximadamente 3m acima do piso)
    const ceilingHeight = floorHeight + 3;
    
    // Esconder objetos que não pertencem a este andar
    scene.traverse(obj => {
      // Só processamos objetos visíveis com posição
      if (!obj.visible || !obj.position) return;
      
      // Verificamos se o objeto está no andar selecionado
      const objY = obj.position.y;
      
      // Se for uma nuvem de pontos, usamos uma abordagem especial
      if (obj.isPoints) {
        // Verificamos se a nuvem tem atributo de posição
        if (obj.geometry && obj.geometry.getAttribute('position')) {
          const positions = obj.geometry.getAttribute('position');
          const count = positions.count;
          
          // Criamos um novo atributo de cores para colorir por andar
          if (!obj.geometry.getAttribute('color')) {
            const colors = new Float32Array(count * 3);
            obj.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          }
          
          const colors = obj.geometry.getAttribute('color');
          
          // Colorimos pontos por andar
          for (let i = 0; i < count; i++) {
            const y = positions.getY(i);
            
            // Define cor com base na altura (andar atual vs outros andares)
            if (y >= floorHeight - 0.5 && y <= ceilingHeight) {
              // Pontos do andar atual - cor normal
              colors.setXYZ(i, 1, 1, 1);
            } else {
              // Pontos de outros andares - semitransparentes
              colors.setXYZ(i, 0.3, 0.3, 0.3);
            }
          }
          
          colors.needsUpdate = true;
          obj.material.vertexColors = true;
          obj.material.opacity = 1.0;
          obj.material.transparent = true;
        }
      } else if (obj.isMesh) {
        // Para objetos normais, simplesmente ajustamos a visibilidade
        if (objY >= floorHeight - 0.5 && objY <= ceilingHeight) {
          obj.visible = true;
          
          // Destacar objetos do andar selecionado
          if (obj.material) {
            obj.material.opacity = 1.0;
            if (obj.userData.originalColor) {
              obj.material.color.set(obj.userData.originalColor);
            }
          }
        } else {
          // Tornar objetos de outros andares semitransparentes
          if (obj.material) {
            if (!obj.userData.originalColor) {
              obj.userData.originalColor = obj.material.color.clone();
            }
            obj.material.opacity = 0.3;
            obj.material.transparent = true;
            obj.material.color.set(0x999999);
          }
        }
      }
    });
    
    // Mover câmera para visualizar o andar selecionado
    const sceneCenter = currentSceneData ? currentSceneData.center : [0, 0, 0];
    
    // Posição para visualizar o andar (ligeiramente acima e afastada)
    const cameraPos = new THREE.Vector3(
      sceneCenter[0] - 8,
      floorHeight + 5,
      sceneCenter[2] - 8
    );
    
    // Alvo no centro do andar
    const cameraTarget = new THREE.Vector3(
      sceneCenter[0],
      floorHeight + 1,
      sceneCenter[2]
    );
    
    // Animar câmera para a nova posição
    animateCameraMovement(
      camera.position.clone(),
      cameraPos,
      controls.target.clone(),
      cameraTarget,
      1000
    );
    
    showMessage(`Visualizando: ${floorHeight >= 0 ? floorHeight.toFixed(1) + 'm' : 'Subsolo'}`);
  }
  
  // Criar vista explodida de todos os andares
  function createExplodedView() {
    // Obter todos os andares
    const floors = detectFloorsInScene();
    
    // Fator de separação entre andares
    const floorSeparation = 5; // metros
    
    // Mapear alturas originais para alturas explodidas
    const heightMap = {};
    floors.forEach((floor, index) => {
      heightMap[floor.height] = floor.height + (index * floorSeparation);
    });
    
    // Ajustar posição dos objetos com base no mapa de alturas
    scene.traverse(obj => {
      // Só modificamos objetos visíveis com posição
      if (!obj.visible || !obj.position) return;
      
      // Para nuvens de pontos, podemos precisar deslocar pontos
      if (obj.isPoints && obj.geometry && obj.geometry.getAttribute('position')) {
        const positions = obj.geometry.getAttribute('position');
        const count = positions.count;
        
        // Se não tivermos uma cópia das posições originais, criamos uma
        if (!obj.userData.originalPositions) {
          const originalPositions = new Float32Array(count * 3);
          for (let i = 0; i < count; i++) {
            originalPositions[i*3] = positions.getX(i);
            originalPositions[i*3+1] = positions.getY(i);
            originalPositions[i*3+2] = positions.getZ(i);
          }
          obj.userData.originalPositions = originalPositions;
        }
        
        // Obtemos as posições originais
        const originalPositions = obj.userData.originalPositions;
        
        // Atualizamos as posições com base no mapa de alturas
        for (let i = 0; i < count; i++) {
          const originalY = originalPositions[i*3+1];
          
          // Encontrar o andar mais próximo para este ponto
          let closestFloor = floors[0].height;
          let minDistance = Math.abs(originalY - closestFloor);
          
          floors.forEach(floor => {
            const distance = Math.abs(originalY - floor.height);
            if (distance < minDistance) {
              minDistance = distance;
              closestFloor = floor.height;
            }
          });
          
          // Aplicar a nova altura do andar
          if (heightMap[closestFloor] !== undefined) {
            const newY = originalY + (heightMap[closestFloor] - closestFloor);
            positions.setY(i, newY);
          }
        }
        
        positions.needsUpdate = true;
      } else if (obj.isMesh) {
        // Para meshes, guardamos a posição original se ainda não tivermos
        if (!obj.userData.originalPosition) {
          obj.userData.originalPosition = obj.position.clone();
        }
        
        const originalY = obj.userData.originalPosition.y;
        
        // Encontrar o andar mais próximo
        let closestFloor = floors[0].height;
        let minDistance = Math.abs(originalY - closestFloor);
        
        floors.forEach(floor => {
          const distance = Math.abs(originalY - floor.height);
          if (distance < minDistance) {
            minDistance = distance;
            closestFloor = floor.height;
          }
        });
        
        // Aplicar a nova altura
        if (heightMap[closestFloor] !== undefined) {
          const deltaY = heightMap[closestFloor] - closestFloor;
          obj.position.y = originalY + deltaY;
        }
        
        // Tornar todos os objetos visíveis
        obj.visible = true;
        
        // Restaurar cores originais
        if (obj.material) {
          if (obj.userData.originalColor) {
            obj.material.color.copy(obj.userData.originalColor);
          }
          obj.material.opacity = 1.0;
        }
      }
    });
    
    // Ajustar câmera para ver toda a vista explodida
    const sceneCenter = currentSceneData ? currentSceneData.center : [0, 0, 0];
    const highestFloor = Math.max(...Object.values(heightMap));
    
    // Posição para ver todos os andares
    const cameraPos = new THREE.Vector3(
      sceneCenter[0] - 15,
      highestFloor + 10,
      sceneCenter[2] - 15
    );
    
    // Alvo no meio da vista explodida
    const cameraTarget = new THREE.Vector3(
      sceneCenter[0],
      (floors[0].height + highestFloor) / 2,
      sceneCenter[2]
    );
    
    // Animar câmera
    animateCameraMovement(
      camera.position.clone(),
      cameraPos,
      controls.target.clone(),
      cameraTarget,
      1500
    );
    
    showMessage('Vista explodida criada');
  }
  
  // Aplicar estilo visual para o modo dollhouse
  function applyDollhouseStyle(floors) {
    // Cores por andar (paleta harmoniosa)
    const floorColors = [
      0x4CAF50, // Verde
      0x2196F3, // Azul
      0xFF9800, // Laranja
      0x9C27B0, // Roxo
      0xF44336, // Vermelho
      0x00BCD4, // Ciano
      0xFFEB3B  // Amarelo
    ];
    
    // Mapeamento de alturas para cores
    const colorMap = {};
    floors.forEach((floor, index) => {
      colorMap[floor.height] = floorColors[index % floorColors.length];
    });
    
    // Aplicar estilo aos objetos
    scene.traverse(obj => {
      if (!obj.visible) return;
      
      // Colorir nuvens de pontos por andar
      if (obj.isPoints && obj.geometry && obj.geometry.getAttribute('position')) {
        const positions = obj.geometry.getAttribute('position');
        const count = positions.count;
        
        // Criar atributo de cor se não existir
        if (!obj.geometry.getAttribute('color')) {
          const colors = new Float32Array(count * 3);
          obj.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }
        
        const colors = obj.geometry.getAttribute('color');
        
        // Colorir pontos por andar
        for (let i = 0; i < count; i++) {
          const y = positions.getY(i);
          
          // Encontrar o andar mais próximo
          let closestFloor = floors[0].height;
          let minDistance = Math.abs(y - closestFloor);
          
          floors.forEach(floor => {
            const distance = Math.abs(y - floor.height);
            if (distance < minDistance) {
              minDistance = distance;
              closestFloor = floor.height;
            }
          });
          
          // Obter cor para este andar
          const color = new THREE.Color(colorMap[closestFloor] || 0xcccccc);
          
          // Definir cor do ponto
          colors.setXYZ(i, color.r, color.g, color.b);
        }
        
        colors.needsUpdate = true;
        obj.material.vertexColors = true;
      } else if (obj.isMesh && obj.material) {
        // Guardar cor original
        if (!obj.userData.originalColor) {
          obj.userData.originalColor = obj.material.color.clone();
        }
        
        // Colorir por andar para meshes também
        const y = obj.position.y;
        
        // Encontrar andar mais próximo
        let closestFloor = floors[0].height;
        let minDistance = Math.abs(y - closestFloor);
        
        floors.forEach(floor => {
          const distance = Math.abs(y - floor.height);
          if (distance < minDistance) {
            minDistance = distance;
            closestFloor = floor.height;
          }
        });
        
        // Aplicar cor do andar
        if (colorMap[closestFloor]) {
          const color = new THREE.Color(colorMap[closestFloor]);
          obj.material.color.copy(color);
        }
      }
    });
  }
  
  // Remover os elementos da UI do dollhouse
  function removeDollhouseUI() {
    // Remover seletor de andares
    const floorSelector = document.getElementById('floor-selector');
    if (floorSelector) {
      document.body.removeChild(floorSelector);
    }
  }
  
  // Remover efeitos visuais do dollhouse
  function removeDollhouseStyle() {
    scene.traverse(obj => {
      // Restaurar cores originais
      if (obj.isMesh && obj.material && obj.userData.originalColor) {
        obj.material.color.copy(obj.userData.originalColor);
        obj.material.opacity = 1.0;
        obj.material.transparent = false;
      }
      
      // Restaurar posições originais
      if (obj.userData.originalPosition) {
        obj.position.copy(obj.userData.originalPosition);
      }
      
      // Restaurar posições originais em nuvens de pontos
      if (obj.isPoints && obj.geometry && obj.userData.originalPositions) {
        const positions = obj.geometry.getAttribute('position');
        const count = positions.count;
        const originalPositions = obj.userData.originalPositions;
        
        // Restaurar posições
        for (let i = 0; i < count; i++) {
          positions.setXYZ(
            i,
            originalPositions[i*3],
            originalPositions[i*3+1],
            originalPositions[i*3+2]
          );
        }
        
        positions.needsUpdate = true;
      }
    });
  }
})();