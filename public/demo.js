// Arquivo de demonstração para garantir que pelo menos algo seja mostrado
document.addEventListener('DOMContentLoaded', function() {
  let demoInitialized = false;
  
  // Verifique se a página está presa no carregamento por mais de 5 segundos
  setTimeout(function() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay && loadingOverlay.style.display !== 'none' && !demoInitialized) {
      console.log('Forçando saída do estado de carregamento e mostrando demo');
      demoInitialized = true;
      
      // Esconde o loading
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 500);
      
      // Verifica se já existe um canvas de renderização
      const existingCanvas = document.querySelector('canvas');
      if (existingCanvas) {
        console.log('Canvas já existe, não criando demo redundante');
        return;
      }
      
      try {
        // Inicializa Three.js
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x222222);
        
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(3, 3, 3);
        
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);
        
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 0, 0);
        
        // Adiciona um cubo
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
        
        // Adiciona luz
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);
        
        // Animação
        function animate() {
          if (!demoInitialized) return; // Para a animação se o modo demo for desativado
          
          requestAnimationFrame(animate);
          cube.rotation.x += 0.01;
          cube.rotation.y += 0.01;
          controls.update();
          renderer.render(scene, camera);
        }
        animate();
        
        // Texto informativo
        const info = document.getElementById('info');
        if (info) {
          info.textContent = 'MODO DEMO - Servidor não está respondendo';
          info.style.opacity = '1';
          info.style.color = 'red';
        }
      } catch (error) {
        console.error('Erro ao inicializar demo:', error);
      }
    }
  }, 5000);
}); 