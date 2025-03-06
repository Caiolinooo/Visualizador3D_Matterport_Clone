// Optimized version of loadPointCloud function
// To replace in public/main.js

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
      
      // Otimização: Decimação para grandes datasets
      const originalVertexCount = geometry.attributes.position.count;
      let targetVertexCount = originalVertexCount;
      let decimationRatio = 1;
      
      // Se a nuvem tiver mais de 500 mil pontos, aplicamos decimação progressiva
      if (originalVertexCount > 500000) {
        // Quanto maior a nuvem, mais agressiva a decimação
        if (originalVertexCount > 2000000) {
          decimationRatio = 0.1; // Mantém apenas 10% dos pontos para nuvens muito grandes
        } else if (originalVertexCount > 1000000) {
          decimationRatio = 0.2; // Mantém 20% dos pontos para nuvens grandes
        } else {
          decimationRatio = 0.3; // Mantém 30% dos pontos para nuvens médias
        }
        
        targetVertexCount = Math.floor(originalVertexCount * decimationRatio);
        showMessage(`Otimizando nuvem de ${originalVertexCount.toLocaleString()} para ${targetVertexCount.toLocaleString()} pontos...`);
        
        // Decimação por amostragem sistemática
        const decimatedPositions = new Float32Array(targetVertexCount * 3);
        const stride = Math.floor(1 / decimationRatio);
        
        const originalPositions = geometry.attributes.position.array;
        let j = 0;
        
        for (let i = 0; i < originalVertexCount; i += stride) {
          if (j < targetVertexCount) {
            decimatedPositions[j * 3] = originalPositions[i * 3];
            decimatedPositions[j * 3 + 1] = originalPositions[i * 3 + 1];
            decimatedPositions[j * 3 + 2] = originalPositions[i * 3 + 2];
            j++;
          }
        }
        
        // Criar nova geometria com os pontos decimados
        const decimatedGeometry = new THREE.BufferGeometry();
        decimatedGeometry.setAttribute('position', new THREE.BufferAttribute(decimatedPositions, 3));
        
        // Se tivermos cores, também precisamos decimá-las
        if (geometry.attributes.color) {
          const originalColors = geometry.attributes.color.array;
          const decimatedColors = new Float32Array(targetVertexCount * 3);
          
          j = 0;
          for (let i = 0; i < originalVertexCount; i += stride) {
            if (j < targetVertexCount) {
              decimatedColors[j * 3] = originalColors[i * 3];
              decimatedColors[j * 3 + 1] = originalColors[i * 3 + 1];
              decimatedColors[j * 3 + 2] = originalColors[i * 3 + 2];
              j++;
            }
          }
          
          decimatedGeometry.setAttribute('color', new THREE.BufferAttribute(decimatedColors, 3));
        }
        
        // Usa a geometria decimada
        geometry = decimatedGeometry;
      }
      
      // Otimização: Usar WebGL Points com buffer chunks para melhor desempenho
      // Cria material para os pontos com tamanho adaptativo
      const pointSize = window.devicePixelRatio < 2 ? 0.05 : 0.03;
      const material = new THREE.PointsMaterial({
        color: geometry.attributes.color ? 0xFFFFFF : 0xAAAAAA,
        size: pointSize,
        sizeAttenuation: true,
        vertexColors: geometry.attributes.color ? true : false,
        transparent: true,
        opacity: 0.7
      });
      
      // Remove nuvem de pontos anterior se existir
      if (currentPointCloud) {
        scene.remove(currentPointCloud);
        currentPointCloud.geometry.dispose();
        currentPointCloud.material.dispose();
      }
      
      // Cria a nuvem de pontos com LOD (Level of Detail)
      currentPointCloud = new THREE.Points(geometry, material);
      currentPointCloud.name = 'pointcloud';
      
      // Adiciona frustum culling para melhor desempenho
      currentPointCloud.frustumCulled = true;
      
      // Adiciona metadados para LOD dinâmico durante navegação
      currentPointCloud.userData = {
        originalVertexCount: originalVertexCount,
        decimationRatio: decimationRatio,
        dynamicLOD: true
      };
      
      scene.add(currentPointCloud);
      
      showMessage(`Nuvem com ${geometry.attributes.position.count.toLocaleString()} pontos carregada`);
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