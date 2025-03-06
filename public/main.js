(function(){
  let scene, camera, renderer, controls;
  let currentPanorama, currentPointCloud;
  let measurementPoints = [];
  let isMeasuring = false;
  let axesHelper, gridHelper;
  let initialLoad = true;

  // Função para criar sprites de texto
  function makeTextSprite(message) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = "Bold 20px Arial";
    const metrics = context.measureText(message);
    const textWidth = metrics.width;
    canvas.width = textWidth + 20;
    canvas.height = 40;
    context.fillStyle = "rgba(255,255,255,1.0)";
    context.fillText(message, 10, 25);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(10, 5, 1.0);
    return sprite;
  }

  // Inicialização do Three.js
  function initViewer() {
    scene = new THREE.Scene();
    // Configurar o eixo Z como 'up'
    scene.up = new THREE.Vector3(0, 0, 1);
    scene.background = new THREE.Color(0x505050);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.up = new THREE.Vector3(0, 0, 1);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minPolarAngle = THREE.Math.degToRad(20);
    controls.maxPolarAngle = THREE.Math.degToRad(70);
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    // Não ajustamos a posição padrão aqui
    
    // Luz ambiente
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    // Adicionar grid helper para orientação no plano XY (com Z como up)
    gridHelper = new THREE.GridHelper(200, 50);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    // Adicionar eixos cartesianos
    axesHelper = new THREE.AxesHelper(10);
    scene.add(axesHelper);

    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('click', handleMeasurementClick);
    renderer.domElement.addEventListener('mousemove', onMeasurementMouseMove);

    createSidebar();
    createUIControls();
    createMeasurementToggleControl();
    animate();

    // Execute a animação de entrada: inicia com uma vista 'doll house' e depois transita para a vista interativa
    playEntryAnimation();

    // Após a animação de entrada, carregar todas as cenas
    setTimeout(() => {
      loadAllScenes();
    }, 3000);
  }

  function onWindowResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate(){
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  // Cria a barra lateral para listar as cenas
  function createSidebar(){
    const sidebar = document.createElement('div');
    sidebar.id = 'sidebar';
    sidebar.style.position = 'absolute';
    sidebar.style.top = '10px';
    sidebar.style.left = '10px';
    sidebar.style.width = '300px';
    sidebar.style.maxHeight = '90vh';
    sidebar.style.overflowY = 'auto';
    sidebar.style.backgroundColor = 'rgba(0,0,0,0.7)';
    sidebar.style.color = '#fff';
    sidebar.style.padding = '10px';
    sidebar.style.fontFamily = 'Arial, sans-serif';
    sidebar.innerHTML = '<h2>Cenas Processadas</h2><p>Carregando...</p>';
    document.body.appendChild(sidebar);
  }

  // Função para criar marcador e adicionar ao Three.js
  function addMarker(sceneData) {
    if(!sceneData.center) return; // se não houver centro, pula
    const markerGeometry = new THREE.SphereGeometry(1, 12, 12);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(sceneData.center[0], 1, sceneData.center[2]);
    marker.userData = { info: {
      name: sceneData.name,
      center: sceneData.center,
      links: sceneData.files
    } };
    scene.add(marker);
    
    const sprite = makeTextSprite(sceneData.name);
    sprite.position.set(sceneData.center[0], 3, sceneData.center[2]);
    scene.add(sprite);
  }

  // Busca cenas processadas a partir do endpoint /api/matterport
  async function loadMatterportScenes() {
    try {
      console.log('Iniciando fetch de /api/matterport');
      const response = await fetch('/api/matterport');
      if (!response.ok) {
        throw new Error('Erro na requisição: ' + response.status);
      }
      const scenes = await response.json();
      console.log('Cenas recuperadas:', scenes);
      populateSidebar(scenes);
      if (scenes.length > 0) {
        loadScene(scenes[0]);
      } else {
        console.log('Nenhuma cena processada, criando cena padrão');
        const boxGeometry = new THREE.BoxGeometry();
        const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.set(0, 1, 0);
        scene.add(box);
      }
    } catch (err) {
      console.error('Erro em loadMatterportScenes:', err);
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        sidebar.innerText = 'Erro ao carregar cenas processadas';
      }
      console.log('Erro ocorrido. Criando cena padrão como fallback.');
      const boxGeometry = new THREE.BoxGeometry();
      const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const box = new THREE.Mesh(boxGeometry, boxMaterial);
      box.position.set(0, 1, 0);
      scene.add(box);
    }
  }

  // Popula a sidebar com as cenas recebidas
  function populateSidebar(scenes) {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = '<h2>Cenas Processadas</h2>';
    scenes.forEach(sceneData => {
      const sceneDiv = document.createElement('div');
      sceneDiv.className = 'scene-item';
      sceneDiv.style.borderBottom = '1px solid #555';
      sceneDiv.style.marginBottom = '5px';
      sceneDiv.style.paddingBottom = '5px';
      sceneDiv.style.cursor = 'pointer';
      sceneDiv.innerHTML = `<h3>${sceneData.name}</h3>
                          <p>Centro: ${sceneData.center ? sceneData.center.join(', ') : 'N/A'}</p>`;
      sceneDiv.addEventListener('click', () => { flyToScene(sceneData); });
      sidebar.appendChild(sceneDiv);
    });
  }

  // Carrega uma cena: panorama e nuvem real
  function loadScene(sceneData) {
    clearScene();

    if (!initialLoad) {
      camera.position.set(0, 1.6, 3);
      controls.target.set(0, 0, 0);
      controls.update();
    }

    // Adiciona rótulo, se houver centro (opcional)
    if (sceneData.center) {
      const label = makeTextSprite(sceneData.name);
      label.position.set(sceneData.center[0], sceneData.center[1] + 2, sceneData.center[2]);
      scene.add(label);
    }

    // Carrega a panorâmica, se houver
    if (sceneData.files && sceneData.files.panorama) {
      loadPanorama(sceneData.files.panorama);
    }

    // Carrega a nuvem, se houver
    if (sceneData.files && sceneData.files.cloud) {
      loadPointCloud(sceneData.files.cloud, sceneData.center);
    }

    initialLoad = false;
  }

  // Remove objetos antigos (exceto os marcados com userData.keep)
  function clearScene(){
    for(let i = scene.children.length - 1; i >= 0; i--) {
      const obj = scene.children[i];
      if(obj.userData && obj.userData.keep) continue;
      scene.remove(obj);
    }
  }

  // Carrega a panorâmica usando TextureLoader
  function loadPanorama(panoramaURL) {
    console.log('Carregando panorama: ' + panoramaURL);
    const geometry = new THREE.SphereGeometry(50, 60, 40);
    geometry.scale(-1, 1, 1);
    new THREE.TextureLoader().load(panoramaURL, texture => {
      console.log('Panorama carregado com sucesso');
      const material = new THREE.MeshBasicMaterial({ map: texture });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.userData.keep = true;
      scene.add(sphere);
      currentPanorama = sphere;
    }, xhr => {
      console.log((xhr.loaded / xhr.total * 100) + '% carregado');
    }, error => {
      console.error('Falha ao carregar panorama:', error);
    });
  }

  // Função para criar círculos de navegação com base na geometria da nuvem
  function createNavigationCircles(geometry) {
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }
    const bb = geometry.boundingBox;
    const minX = bb.min.x;
    const maxX = bb.max.x;
    const minZ = bb.min.z;
    const maxZ = bb.max.z;
    const spacing = 5; // espaçamento entre os círculos
    for (let x = minX; x < maxX; x += spacing) {
      for (let z = minZ; z < maxZ; z += spacing) {
        const circleGeometry = new THREE.CircleGeometry(2, 32);
        const circleMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true });
        const circle = new THREE.Mesh(circleGeometry, circleMaterial);
        circle.rotation.x = -Math.PI / 2; // deixar o círculo horizontal
        // Posiciona o círculo no centro da célula, considerando que o piso está no nível mínimo da nuvem
        circle.position.set(x + spacing / 2, bb.min.y + 0.1, z + spacing / 2);
        circle.userData.nav = true; // marca este objeto como item de navegação
        scene.add(circle);
      }
    }
  }

  // Função para animar a transição da câmera
  function animateCameraTransition(newCamPos, newTarget, duration = 1000) {
    let startTime = null;
    const initialCamPos = camera.position.clone();
    const initialTarget = controls.target.clone();

    function animateStep(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Função de easing easeInOutQuad
      const easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      camera.position.lerpVectors(initialCamPos, newCamPos, easeT);
      controls.target.lerpVectors(initialTarget, newTarget, easeT);
      controls.update();
      if (t < 1) {
        requestAnimationFrame(animateStep);
      }
    }
    requestAnimationFrame(animateStep);
  }

  // Função para animar a entrada (doll house view e transição para vista interativa)
  function playEntryAnimation() {
    // Definir a vista inicial do "doll house" -- vista aérea
    const dollhouseCamPos = new THREE.Vector3(0, 50, 0);
    const dollhouseTarget = new THREE.Vector3(0, 0, 0);
    camera.position.copy(dollhouseCamPos);
    controls.target.copy(dollhouseTarget);
    controls.update();
    console.log('Iniciando vista Doll House');

    // Após 1 segundo, transitar para a vista interativa padrão
    setTimeout(() => {
      const interactiveCamPos = new THREE.Vector3(0, 1.6, 3);
      const interactiveTarget = new THREE.Vector3(0, 0, 0);
      console.log('Transitando para vista interativa');
      animateCameraTransition(interactiveCamPos, interactiveTarget, 2000);
    }, 1000);
  }

  // Modificar moveToLocation para usar transição suave
  function moveToLocation(targetPos) {
    // Define o novo alvo e a nova posição da câmera com um offset vertical
    const newTarget = targetPos.clone();
    const newCamPos = new THREE.Vector3(targetPos.x, targetPos.y + 1.6, targetPos.z);
    console.log('Iniciando transição para: ', targetPos);
    animateCameraTransition(newCamPos, newTarget, 1000);
  }

  // Função auxiliar para obter um ponto de medição baseando-se na nuvem de pontos
  function getPointFromPointCloud(raycaster) {
    if (currentPointCloud) {
      raycaster.params.Points = { threshold: 0.2 };
      const intersects = raycaster.intersectObject(currentPointCloud, true);
      if (intersects.length > 0) {
        return intersects[0].point;
      }
    }
    return null;
  }

  function getMeasurePoint(raycaster, fallbackPlaneZ) {
    let pt = getPointFromPointCloud(raycaster);
    if (pt === null) {
      fallbackPlaneZ = (fallbackPlaneZ !== undefined) ? fallbackPlaneZ : 0;
      const plane = new THREE.Plane(new THREE.Vector3(0,0,1), -fallbackPlaneZ);
      pt = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, pt)) {
        return pt;
      } else {
        return null;
      }
    } else {
      return pt;
    }
  }

  // Função auxiliar para obter o ponto mais próximo na nuvem de pontos a partir da posição do mouse (em NDC)
  function findNearestPoint(mouse, camera, pointCloud) {
    if (!pointCloud || !pointCloud.geometry || !pointCloud.geometry.attributes.position) return null;
    const positions = pointCloud.geometry.attributes.position.array;
    const count = pointCloud.geometry.attributes.position.count;
    let bestDistSq = Infinity;
    const bestPoint = new THREE.Vector3();
    const tempVec = new THREE.Vector3();
    const worldVec = new THREE.Vector3();
    const threshold = 0.1; // limiar em NDC (aumentado para melhorar a detecção)
    console.log('findNearestPoint: Iniciando busca de pontos na nuvem, count =', (pointCloud && pointCloud.geometry && pointCloud.geometry.attributes.position ? pointCloud.geometry.attributes.position.count : 'indisponível'));

    for (let i = 0; i < count; i++) {
      tempVec.set(positions[i*3], positions[i*3+1], positions[i*3+2]);
      worldVec.copy(tempVec);
      pointCloud.localToWorld(worldVec);
      // projeta o ponto para as coordenadas NDC
      const ndc = worldVec.clone().project(camera);
      const dx = ndc.x - mouse.x;
      const dy = ndc.y - mouse.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestPoint.copy(worldVec);
      }
    }
    return (bestDistSq <= threshold * threshold) ? bestPoint : null;
  }

  // Modificar handleMeasurementClick para iniciar e finalizar a medição interativa
  function handleMeasurementClick(event) {
    console.log('handleMeasurementClick acionado. isMeasuring:', isMeasuring);
    console.log('currentPointCloud:', currentPointCloud);
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );

    // Se o clique for em um objeto de navegação, prioriza a movimentação da câmera
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length > 0 && intersects[0].object.userData && intersects[0].object.userData.nav) {
      moveToLocation(intersects[0].object.position);
      return;
    }

    if (!isMeasuring) {
      console.log('Medição não ativada. Ignorando clique.');
      return;
    }

    // Procura o ponto da nuvem mais próximo do clique
    const point = findNearestPoint(mouse, camera, currentPointCloud);
    if (!point) {
      console.log('Nenhum ponto encontrado próximo ao clique.');
      return; // se não encontrar ponto próximo, não realiza medição
    }

    if (measurementPoints.length === 0) {
      measurementPoints.push(point);
    } else if (measurementPoints.length === 1) {
      measurementPoints.push(point);
      updateMeasurementDisplayFinal();
    }
  }

  function updateMeasurementDisplayFinal(){
    if(measurementPoints.length === 2){
      const distance = measurementPoints[0].distanceTo(measurementPoints[1]);
      let display = document.getElementById('distance');
      if(!display){
        display = document.createElement('div');
        display.id = 'distance';
        display.style.position = 'absolute';
        display.style.top = '10px';
        display.style.right = '10px';
        display.style.background = 'rgba(0,0,0,0.7)';
        display.style.color = '#fff';
        display.style.padding = '10px';
        display.style.fontFamily = 'Arial, sans-serif';
        document.body.appendChild(display);
      }
      display.textContent = 'Distância: ' + distance.toFixed(2) + ' m';

      // Remove a linha de pré-visualização, se existir
      if(window.measurementPreview){
        scene.remove(window.measurementPreview);
        window.measurementPreview = null;
      }

      // Remove a linha de medição anterior, se houver
      if(window.measurementLine){
        scene.remove(window.measurementLine);
      }

      const lineGeometry = new THREE.BufferGeometry().setFromPoints(measurementPoints);
      const greenMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 4 });
      const whiteMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });

      const greenLine = new THREE.Line(lineGeometry, greenMaterial);
      const whiteLine = new THREE.Line(lineGeometry, whiteMaterial);

      const measurementGroup = new THREE.Group();
      measurementGroup.add(greenLine);
      measurementGroup.add(whiteLine);

      scene.add(measurementGroup);
      window.measurementLine = measurementGroup;

      measurementPoints = [];
    }
  }

  // Adicionar nova função para atualizar a linha de pré-visualização da medição conforme o mouse se move
  function onMeasurementMouseMove(event) {
    if (isMeasuring && measurementPoints.length === 1) {
      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );

      const previewPoint = findNearestPoint(mouse, camera, currentPointCloud);
      if (previewPoint) {
        if (window.measurementPreview) {
          window.measurementPreview.geometry.setFromPoints([measurementPoints[0], previewPoint]);
        } else {
          const lineGeometry = new THREE.BufferGeometry().setFromPoints([measurementPoints[0], previewPoint]);
          const lineMaterial = new THREE.LineDashedMaterial({ color: 0xff0000, dashSize: 0.5, gapSize: 0.2 });
          const previewLine = new THREE.Line(lineGeometry, lineMaterial);
          previewLine.computeLineDistances();
          scene.add(previewLine);
          window.measurementPreview = previewLine;
        }
        let display = document.getElementById('distance');
        if (!display) {
          display = document.createElement('div');
          display.id = 'distance';
          display.style.position = 'absolute';
          display.style.top = '10px';
          display.style.right = '10px';
          display.style.background = 'rgba(0,0,0,0.7)';
          display.style.color = '#fff';
          display.style.padding = '10px';
          display.style.fontFamily = 'Arial, sans-serif';
          document.body.appendChild(display);
        }
        const distance = measurementPoints[0].distanceTo(previewPoint);
        display.textContent = 'Distância: ' + distance.toFixed(2) + ' m';
      }
    }
  }

  window.toggleMeasurement = function(){
    isMeasuring = !isMeasuring;
    const btn = document.getElementById('toggleMeasure');
    if(btn) btn.style.backgroundColor = isMeasuring ? '#4CAF50' : '';
    console.log('toggleMeasurement: isMeasuring agora é', isMeasuring);
  };

  function createUIControls(){
    const btn = document.createElement('button');
    btn.innerText = 'Alternar Eixos/Grid';
    btn.style.position = 'absolute';
    btn.style.bottom = '10px';
    btn.style.left = '10px';
    btn.style.padding = '10px';
    btn.style.backgroundColor = '#333';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => {
        if(axesHelper && gridHelper){
            axesHelper.visible = !axesHelper.visible;
            gridHelper.visible = !gridHelper.visible;
        }
    });
    document.body.appendChild(btn);
  }

  // Adicionar a função flyToScene
  function flyToScene(sceneData) {
    if (!sceneData.center) return;
    const center = new THREE.Vector3(sceneData.center[0], sceneData.center[1], sceneData.center[2]);
    // Posição da câmera: 0 no X, -5 no Y (abaixo do centro) e 2 no Z
    const cameraOffset = new THREE.Vector3(0, -5, 2);
    const newCameraPos = center.clone().add(cameraOffset);
    camera.position.set(newCameraPos.x, newCameraPos.y, newCameraPos.z);
    
    // Alvo ajustado: 0 no X, +5 no Y (acima do centro) e 0 no Z
    const targetOffset = new THREE.Vector3(0, 5, 0);
    const newTarget = center.clone().add(targetOffset);
    controls.target.copy(newTarget);
    controls.update();
  }

  // Carrega a nuvem real utilizando PLYLoader
  function loadPointCloud(cloudURL, center) {
    console.log('Carregando nuvem de pontos de: ' + cloudURL);
    const loader = new THREE.PLYLoader();
    loader.load(cloudURL, geometry => {
      console.log('PLY carregado com sucesso:', geometry);
      geometry.computeVertexNormals();
      const material = new THREE.PointsMaterial({
        color: 0xFFA500,
        size: 0.05,
        sizeAttenuation: true
      });
      const pointCloud = new THREE.Points(geometry, material);
      pointCloud.userData.keep = true;
      // Se for passado o centro, recentro a nuvem
      if(center) {
        const offset = new THREE.Vector3(center[0], center[1], center[2]);
        pointCloud.position.sub(offset);
      }
      scene.add(pointCloud);
      currentPointCloud = pointCloud;
      console.log('Nuvem de pontos adicionada à cena.');
      createNavigationCircles(geometry);
    }, xhr => {
      const percent = (xhr.loaded / xhr.total * 100).toFixed(2);
      console.log(percent + '% carregado');
    }, error => {
      console.error('Erro ao carregar point cloud:', error);
    });
  }

  // NOVAS FUNÇÕES PARA CARREGAR TODAS AS CENAS INTERLIGADAS

  // Função para carregar todas as cenas do endpoint e adicionar cada uma na cena
  function loadAllScenes() {
    fetch('/api/matterport')
      .then(response => response.json())
      .then(scenes => {
        console.log('Cenas completas:', scenes);
        scenes.forEach(sceneData => {
          loadSceneForMultiple(sceneData);
        });
      })
      .catch(err => {
        console.error('Erro ao carregar todas as cenas:', err);
      });
  }

  // Função para carregar uma cena sem limpar o cenário (mantendo as nuvens já carregadas)
  function loadSceneForMultiple(sceneData) {
    // Adiciona marcador e label para a cena
    if (sceneData.center) {
      const markerGeometry = new THREE.SphereGeometry(1, 12, 12);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(sceneData.center[0], sceneData.center[1], sceneData.center[2]);
      scene.add(marker);

      const sprite = makeTextSprite(sceneData.name);
      sprite.position.set(sceneData.center[0], sceneData.center[1] + 2, sceneData.center[2]);
      scene.add(sprite);
    }
    
    // Carrega a nuvem de pontos para a cena, reposicionando-a com base no centro
    if (sceneData.files && sceneData.files.cloud) {
      loadPointCloudForScene(sceneData.files.cloud, sceneData.center);
    }
  }

  // Função para carregar a nuvem de pontos para uma cena específica e reposicioná-la
  function loadPointCloudForScene(cloudURL, center) {
    console.log('Carregando nuvem da cena de: ' + cloudURL);
    const loader = new THREE.PLYLoader();
    loader.load(cloudURL, geometry => {
      console.log('PLY carregado para cena:', geometry);
      geometry.computeVertexNormals();
      const material = new THREE.PointsMaterial({
        color: 0xFFA500,
        size: 0.05,
        sizeAttenuation: true
      });
      const pointCloud = new THREE.Points(geometry, material);
      pointCloud.userData.keep = true;
      // Se o centro for fornecido, recentro a nuvem
      if(center) {
        const offset = new THREE.Vector3(center[0], center[1], center[2]);
        pointCloud.position.sub(offset);
      }
      scene.add(pointCloud);
      currentPointCloud = pointCloud;
      console.log('Nuvem de pontos adicionada à cena para ' + cloudURL);
    }, xhr => {
      const percent = (xhr.loaded / xhr.total * 100).toFixed(2);
      console.log(percent + '% carregado');
    }, error => {
      console.error('Erro ao carregar nuvem de pontos:', error);
    });
  }

  // Função para criar controles de medição
  function createMeasurementToggleControl(){
    const btn = document.createElement('button');
    btn.id = 'toggleMeasure';
    btn.innerText = 'Ativar Medição';
    btn.style.position = 'absolute';
    btn.style.bottom = '10px';
    btn.style.right = '10px';
    btn.style.padding = '10px';
    btn.style.backgroundColor = '#333';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => {
      toggleMeasurement();
      btn.innerText = isMeasuring ? 'Medição Ativada' : 'Ativar Medição';
      console.log('Medição:', isMeasuring ? 'Ativada' : 'Desativada');
    });
    document.body.appendChild(btn);
  }

  document.addEventListener('DOMContentLoaded', function() {
    initViewer();
  });
})(); 