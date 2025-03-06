const fs = require('fs');

function getCenter(filePath) {
  // Lê o arquivo .pts como texto
  const data = fs.readFileSync(filePath, 'utf8');
  // Supondo que a primeira linha seja o número de pontos e as demais linhas possuam 'x y z'
  const lines = data.split('\n').filter(line => line.trim() !== '');
  let totalX = 0, totalY = 0, totalZ = 0;
  let count = 0;
  
  // Processa cada linha depois da primeira
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts.length < 3) continue;
    totalX += parseFloat(parts[0]);
    totalY += parseFloat(parts[1]);
    totalZ += parseFloat(parts[2]);
    count++;
  }
  
  return { x: totalX / count, y: totalY / count, z: totalZ / count };
}

module.exports = { getCenter }; 