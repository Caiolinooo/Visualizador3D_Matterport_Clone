let scene, camera, renderer, controls;
let measurementPoints = [];
let isMeasuring = false;

export function initViewer(THREE, OrbitControls) {
    // Configuração inicial
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    
    // Configuração do renderizador
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Controles de câmera
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    camera.position.set(0, 1.6, 3);

    // Iluminação
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    // Carregamento de dados
    loadPanorama(THREE);
    loadPointCloud(THREE);

    // Event listeners
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('click', handleMeasurementClick);

    animate();
}

function loadPanorama(THREE) {
    const geometry = new THREE.SphereGeometry(50, 60, 40);
    geometry.scale(-1, 1, 1);
    
    new THREE.TextureLoader().load('panorama.jpg', texture => {
        const material = new THREE.MeshBasicMaterial({ map: texture });
        const sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);
    });
}

function loadPointCloud(THREE) {
    fetch('points.txt')
        .then(response => response.text())
        .then(data => {
            const points = data.split('\n').filter(l => l).map(line => {
                const [x, y, z] = line.split(/[\s,]+/).map(Number);
                return new THREE.Vector3(x, y, z);
            });

            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.PointsMaterial({
                color: 0xFFA500,
                size: 0.05,
                sizeAttenuation: true
            });

            const cloud = new THREE.Points(geometry, material);
            scene.add(cloud);
        });
}

function handleMeasurementClick(event) {
    if (!isMeasuring) return;

    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length > 0) {
        measurementPoints.push(intersects[0].point);
        updateMeasurementDisplay();
    }
}

function updateMeasurementDisplay() {
    if (measurementPoints.length === 2) {
        const distance = measurementPoints[0].distanceTo(measurementPoints[1]);
        document.getElementById('distance').textContent = distance.toFixed(2);
        measurementPoints = [];
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Funções de interface
window.toggleMeasurement = () => {
    isMeasuring = !isMeasuring;
    document.querySelector('button').style.backgroundColor = isMeasuring ? '#4CAF50' : '';
};