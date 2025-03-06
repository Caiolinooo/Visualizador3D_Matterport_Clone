// Arquivo para verificar se as dependências foram carregadas corretamente
(function checkDependencies() {
  console.log('Verificando dependências...');
  
  // Verifica Three.js
  if (typeof THREE === 'undefined') {
    console.error('ERROR: THREE não está definido. O Three.js não foi carregado corretamente.');
    document.body.innerHTML = '<div style="color: red; font-size: 24px; text-align: center; margin-top: 100px;">ERRO: Three.js não foi carregado. Verifique a conexão com a internet.</div>';
    return false;
  }
  
  console.log('THREE está disponível:', typeof THREE);
  
  // Verifica OrbitControls
  if (typeof THREE.OrbitControls === 'undefined') {
    console.error('ERROR: THREE.OrbitControls não está definido.');
    document.body.innerHTML = '<div style="color: red; font-size: 24px; text-align: center; margin-top: 100px;">ERRO: OrbitControls não foi carregado.</div>';
    return false;
  }
  
  console.log('OrbitControls está disponível:', typeof THREE.OrbitControls);
  
  // Verifica PLYLoader
  if (typeof THREE.PLYLoader === 'undefined') {
    console.error('ERROR: THREE.PLYLoader não está definido.');
    document.body.innerHTML = '<div style="color: red; font-size: 24px; text-align: center; margin-top: 100px;">ERRO: PLYLoader não foi carregado.</div>';
    return false;
  }
  
  console.log('PLYLoader está disponível:', typeof THREE.PLYLoader);
  
  console.log('Todas as dependências estão carregadas!');
  return true;
})(); 