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

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
  
  // Elementos DOM
  const loadingOverlay = document.getElementById('loading-overlay');
  const infoElement = document.getElementById('info');
  const measureInfoElement = document.getElementById('measure-info');
  const floorPlanElement = document.getElementById('floor-plan');
  
  // Inicialização
  function init() {
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
  }
  
  // Configuração da cena Three.js
  function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.002);
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
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI;
    controls.enablePan = true;
    
    // Não permite zoom com o scroll do mouse (apenas com pinch)
    controls.enableZoom = true;
    controls.zoomSpeed = 1.0;
    
    // Posição inicial
    controls.target.set(0, 1.6, -1);
    controls.update();
  }
  
  // Configuração de event listeners
  function setupEventListeners() {
    window.addEventListener('resize', onWindowResize, false);
    renderer.domElement.addEventListener('click', onDocumentClick, false);
    renderer.domElement.addEventListener('mousemove', onDocumentMouseMove, false);
    
    // Se clicar no botão escape, sai do modo atual (medição, tags)
    window.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        isMeasuring = false;
        isTagMode = false;
        updateUIState();
      }
    });
  }
  
  // Configuração da interface
  function setupUI() {
    // Botões da interface
    document.getElementById('btn-dollhouse').addEventListener('click', toggleDollhouseView);
    document.getElementById('btn-floorplan').addEventListener('click', toggleFloorPlan);
    document.getElementById('btn-measure').addEventListener('click', toggleMeasureMode);
    document.getElementById('btn-tags').addEventListener('click', toggleTagMode);
    document.getElementById('btn-tour').addEventListener('click', toggleAutoTour);
    
    // Atualizando estado inicial da UI
    updateUIState();
  }
  
  // Loop de animação
  function animate() {
    requestAnimationFrame(animate);
    
    controls.update();
    
    // Atualiza posição de qualquer elemento dependente da câmera (labels, etc)
    updateLabelsPosition();
    
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
    showLoading(true);
    
    fetch('/api/matterport')
      .then(response => {
        if (!response.ok) throw new Error('Erro ao carregar cenas');
        return response.json();
      })
      .then(data => {
        scenes = data;
        populateScenesMenu(scenes);
        
        if (scenes.length > 0) {
          loadScene(scenes[0]);
        } else {
          showLoading(false);
          showMessage('Nenhuma cena disponível');
        }
      })
      .catch(error => {
        console.error('Erro:', error);
        showLoading(false);
        showMessage('Erro ao carregar cenas: ' + error.message);
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
    showLoading(true);
    
    // Limpa cena atual
    clearScene();
    
    // Restaura configurações padrão
    resetModes();
    
    // Informa qual cena está sendo carregada
    showMessage(`Carregando cena: ${sceneData.name}`);
    
    // Carrega a panorâmica
    if (sceneData.files && sceneData.files.panorama) {
      loadPanorama(Array.isArray(sceneData.files.panorama) 
        ? sceneData.files.panorama[0] 
        : sceneData.files.panorama);
    }
    
    // Carrega a nuvem de pontos
    if (sceneData.files && sceneData.files.cloud) {
      loadPointCloud(sceneData.files.cloud);
    }
    
    // Carrega a planta baixa
    if (sceneData.files && sceneData.files.floor_plan) {
      loadFloorPlan(sceneData.files.floor_plan);
    }
    
    // Adiciona pontos de navegação entre cenas
    addNavigationPoints();
    
    // Posiciona a câmera na cena
    positionCameraInScene(sceneData);
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
  
  // Carrega uma panorâmica
  function loadPanorama(panoramaUrl) {
    if (!panoramaUrl) {
      console.warn('URL de panorâmica não fornecida');
      return;
    }
    
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      panoramaUrl,
      // Sucesso
      function(texture) {
        // Cria uma esfera para a panorâmica
        const geometry = new THREE.SphereGeometry(90, 64, 32);
        geometry.scale(-1, 1, 1); // Inverte a geometria para que a textura fique do lado interno
        
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide // Renderiza o lado interno da esfera
        });
        
        // Remove panorâmica anterior se existir
        if (panoramaSphere) {
          scene.remove(panoramaSphere);
        }
        
        panoramaSphere = new THREE.Mesh(geometry, material);
        panoramaSphere.name = 'panorama';
        scene.add(panoramaSphere);
        
        showMessage('Panorâmica carregada');
      },
      // Progresso
      function(xhr) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        showMessage(`Carregando panorâmica... ${percent}%`);
      },
      // Erro
      function(error) {
        console.error('Erro ao carregar panorâmica:', error);
        showMessage('Erro ao carregar panorâmica');
      }
    );
  }
  
  // Carrega nuvem de pontos (formato PLY)
  function loadPointCloud(cloudUrl) {
    if (!cloudUrl) {
      console.warn('URL de nuvem de pontos não fornecida');
      return;
    }
    
    const plyLoader = new THREE.PLYLoader();
    plyLoader.load(
      cloudUrl,
      // Sucesso
      function(geometry) {
        geometry.computeVertexNormals();
        
        // Cria material para os pontos
        const material = new THREE.PointsMaterial({
          color: 0xFFFFFF,
          size: 0.05,
          sizeAttenuation: true,
          vertexColors: true,
          transparent: true,
          opacity: 0.7
        });
        
        // Remove nuvem de pontos anterior se existir
        if (currentPointCloud) {
          scene.remove(currentPointCloud);
        }
        
        // Cria a nuvem de pontos
        currentPointCloud = new THREE.Points(geometry, material);
        currentPointCloud.name = 'pointcloud';
        scene.add(currentPointCloud);
        
        showMessage('Nuvem de pontos carregada');
        showLoading(false);
      },
      // Progresso
      function(xhr) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        showMessage(`Carregando nuvem de pontos... ${percent}%`);
      },
      // Erro
      function(error) {
        console.error('Erro ao carregar nuvem de pontos:', error);
        showMessage('Erro ao carregar nuvem de pontos');
        showLoading(false);
      }
    );
  }
  
  // Carrega a planta baixa
  function loadFloorPlan(floorPlanUrl) {
    if (!floorPlanUrl) {
      console.warn('URL de planta baixa não fornecida');
      return;
    }
    
    // Carrega a imagem da planta baixa e a armazena para exibição posterior
    const floorPlanImg = new Image();
    floorPlanImg.onload = function() {
      floorPlanElement.innerHTML = '';
      floorPlanElement.appendChild(floorPlanImg);
      floorPlanImg.style.width = '100%';
      floorPlanImg.style.height = '100%';
      floorPlanImg.style.objectFit = 'contain';
    };
    
    floorPlanImg.onerror = function() {
      console.error('Erro ao carregar imagem da planta baixa');
    };
    
    floorPlanImg.src = floorPlanUrl;
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
    handleNavPointClick(intersects);
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
    if (sceneIndex >= 0 && sceneIndex < scenes.length) {
      // Animação de fade out
      fadeOut(function() {
        currentSceneIndex = sceneIndex;
        loadScene(scenes[sceneIndex]);
        // Fade in após carregar
        setTimeout(fadeIn, 500);
      });
    }
  }
  
  // Trata clique em pontos de navegação
  function handleNavPointClick(intersects) {
    if (intersects.length > 0) {
      const object = intersects[0].object;
      
      if (object.userData && object.userData.type === 'navpoint') {
        navigateToScene(object.userData.targetScene);
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
    
    floorPlanElement.style.display = isFloorPlanVisible ? 'block' : 'none';
    
    updateUIState();
  }
  
  // Alterna a vista doll house
  function toggleDollhouseView() {
    isDollhouseMode = !isDollhouseMode;
    
    if (isDollhouseMode) {
      // Salva posição atual da câmera
      camera.userData.lastPosition = camera.position.clone();
      camera.userData.lastTarget = controls.target.clone();
      
      // Move a câmera para cima, olhando para baixo
      const currentScene = scenes[currentSceneIndex];
      const center = currentScene.center ? new THREE.Vector3(...currentScene.center) : new THREE.Vector3(0, 0, 0);
      
      // Posição da câmera elevada
      const dollhousePosition = center.clone().add(new THREE.Vector3(0, 15, 0));
      
      // Anima transição para dollhouse
      animateCameraMove(dollhousePosition, center);
      
      showMessage('Vista Doll House ativada');
    } else {
      // Restaura posição anterior da câmera
      if (camera.userData.lastPosition && camera.userData.lastTarget) {
        animateCameraMove(camera.userData.lastPosition, camera.userData.lastTarget);
      }
      
      showMessage('Vista normal restaurada');
    }
    
    updateUIState();
  }
  
  // Anima a movimentação da câmera
  function animateCameraMove(targetPosition, lookAtTarget) {
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    let startTime = null;
    const duration = 1000; // 1 segundo
    
    function animate(currentTime) {
      if (!startTime) startTime = currentTime;
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      
      // Easing function (ease in-out)
      const easedProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      
      // Interpola posição
      camera.position.lerpVectors(startPosition, targetPosition, easedProgress);
      
      // Interpola alvo
      controls.target.lerpVectors(startTarget, lookAtTarget, easedProgress);
      controls.update();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }
    
    requestAnimationFrame(animate);
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
    if (show) {
      loadingOverlay.style.display = 'flex';
      loadingOverlay.style.opacity = '1';
    } else {
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
  
  // Efeito de fade out
  function fadeOut(callback) {
    const fadeOverlay = document.createElement('div');
    fadeOverlay.style.position = 'fixed';
    fadeOverlay.style.top = '0';
    fadeOverlay.style.left = '0';
    fadeOverlay.style.width = '100%';
    fadeOverlay.style.height = '100%';
    fadeOverlay.style.backgroundColor = '#000';
    fadeOverlay.style.opacity = '0';
    fadeOverlay.style.zIndex = '1000';
    fadeOverlay.style.transition = 'opacity 0.5s';
    document.body.appendChild(fadeOverlay);
    
    // Força reflow
    void fadeOverlay.offsetWidth;
    
    fadeOverlay.style.opacity = '1';
    
    setTimeout(() => {
      if (callback) callback();
      
      // Não remove o overlay ainda, será usado para fade in
      fadeOverlay.id = 'fade-overlay';
    }, 500);
  }
  
  // Efeito de fade in
  function fadeIn() {
    const fadeOverlay = document.getElementById('fade-overlay');
    if (!fadeOverlay) return;
    
    fadeOverlay.style.opacity = '0';
    
    setTimeout(() => {
      document.body.removeChild(fadeOverlay);
    }, 500);
  }
  
  // Inicia o aplicativo quando o DOM estiver pronto
  document.addEventListener('DOMContentLoaded', init);
})();