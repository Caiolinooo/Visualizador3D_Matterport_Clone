// Improved function to create a stitched equirectangular panorama from TrueView cube faces
// This can be integrated into server.js

// Function to stitch cube faces into equirectangular panorama
function stitchCubeFaces(cubeImages) {
  return new Promise(async (resolve, reject) => {
    try {
      // Import necessary libraries
      const { createCanvas, loadImage } = require('canvas');
      const fs = require('fs');
      const path = require('path');
      
      // Create a large canvas for the equirectangular output
      // Typical equirectangular ratio is 2:1 (360° horizontal, 180° vertical)
      const width = 4096;  // Output width
      const height = width / 2; // Equirectangular height (2:1 ratio)
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      
      // Fill with black background
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);
      
      // Load all 6 cube face images
      const faceOrder = ['face0', 'face1', 'face2', 'face3', 'face4', 'face5'];
      const images = {};
      
      for (const face of faceOrder) {
        if (cubeImages[face]) {
          // Remove leading slash for filesystem path
          const imagePath = path.join(__dirname, cubeImages[face].substring(1));
          
          if (fs.existsSync(imagePath)) {
            try {
              images[face] = await loadImage(imagePath);
            } catch (err) {
              console.error(`Error loading image for ${face}:`, err);
            }
          }
        }
      }
      
      // Function to project cubemap to equirectangular
      // This uses a pixel-by-pixel mapping from equirectangular coordinates to cube face
      for (let y = 0; y < height; y++) {
        // Convert y to latitude (-π/2 to π/2)
        const latitude = Math.PI * (y / height - 0.5);
        
        for (let x = 0; x < width; x++) {
          // Convert x to longitude (-π to π)
          const longitude = 2 * Math.PI * (x / width - 0.5);
          
          // Calculate 3D vector from longitude/latitude
          const nx = Math.cos(latitude) * Math.cos(longitude);
          const ny = Math.sin(latitude);
          const nz = Math.cos(latitude) * Math.sin(longitude);
          
          // Determine which face to use based on the largest component
          let faceIdx = 0;
          let u = 0, v = 0;
          let maxVal = Math.abs(nx);
          
          if (Math.abs(ny) > maxVal) {
            faceIdx = ny > 0 ? 4 : 5;  // Top or bottom face
            maxVal = Math.abs(ny);
          }
          
          if (Math.abs(nz) > maxVal) {
            faceIdx = nz > 0 ? 2 : 0;  // Front or back face
            maxVal = Math.abs(nz);
          }
          
          if (nx > maxVal) {
            faceIdx = 1; // Right face
          } else if (nx < -maxVal) {
            faceIdx = 3; // Left face
          }
          
          // Calculate UV coordinates on the face
          const face = `face${faceIdx}`;
          const faceImage = images[face];
          
          if (faceImage) {
            switch (faceIdx) {
              case 0: // Back face (negative X)
                u = (nz / -nx + 1) / 2;
                v = (ny / -nx + 1) / 2;
                break;
              case 1: // Right face (positive X)
                u = (-nz / nx + 1) / 2;
                v = (ny / nx + 1) / 2;
                break;
              case 2: // Front face (positive Z)
                u = (nx / nz + 1) / 2;
                v = (ny / nz + 1) / 2;
                break;
              case 3: // Left face (negative Z)
                u = (-nx / -nz + 1) / 2;
                v = (ny / -nz + 1) / 2;
                break;
              case 4: // Top face (positive Y)
                u = (nx / ny + 1) / 2;
                v = (-nz / ny + 1) / 2;
                break;
              case 5: // Bottom face (negative Y)
                u = (nx / -ny + 1) / 2;
                v = (nz / -ny + 1) / 2;
                break;
            }
            
            // Sample the pixel from the cube face
            if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
              const srcX = Math.floor(u * faceImage.width);
              const srcY = Math.floor(v * faceImage.height);
              
              // Get pixel color from source image
              ctx.drawImage(
                faceImage,
                srcX, srcY, 1, 1,
                x, y, 1, 1
              );
            }
          }
        }
      }
      
      // Generate output filename
      const outputDir = path.join(__dirname, 'output', 'trueview_stitched');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Extract scene name from the first image path
      const firstImagePath = cubeImages.face0;
      const sceneName = path.basename(path.dirname(firstImagePath));
      const outputPath = path.join(outputDir, `${sceneName}_stitched.jpg`);
      
      // Write the panorama to file
      const out = fs.createWriteStream(outputPath);
      const stream = canvas.createJPEGStream({ quality: 0.95 });
      stream.pipe(out);
      
      out.on('finish', () => {
        resolve(`/output/trueview_stitched/${sceneName}_stitched.jpg`);
      });
      
      out.on('error', (err) => {
        reject(err);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

// Add this function to the server.js file and modify the scanFaroScenesAsync function:

// Update in scanFaroScenesAsync() where TrueView scenes are processed:
/*
if (fs.existsSync(trueviewDir)) {
  // ... existing code ...
  
  for (const scanDir of trueviewScans) {
    // ... existing code ...
    
    // Create stitched panorama if it doesn't exist yet
    const stitchedPanoDir = path.join(__dirname, 'output', 'trueview_stitched');
    const stitchedPanoPath = path.join(stitchedPanoDir, `${scanDir}_stitched.jpg`);
    
    if (!fs.existsSync(stitchedPanoPath)) {
      if (!fs.existsSync(stitchedPanoDir)) {
        fs.mkdirSync(stitchedPanoDir, { recursive: true });
      }
      
      try {
        // Try to create stitched panorama
        const stitchedPanoUrl = await stitchCubeFaces(cubeImages);
        if (stitchedPanoUrl) {
          // Use the stitched panorama instead of just the front face
          scenes.push({
            name: scanDir,
            source: 'trueview',
            center: coordinates,
            files: {
              meta: `/input_data/trueview/${scanDir}/CubeMapMeta.xml`,
              cube: cubeImages,
              panorama: stitchedPanoUrl
            }
          });
          continue; // Skip the default scene push below
        }
      } catch (e) {
        console.error(`Erro ao criar panorâmica para ${scanDir}:`, e);
      }
    } else {
      // Stitched panorama already exists
      scenes.push({
        name: scanDir,
        source: 'trueview',
        center: coordinates,
        files: {
          meta: `/input_data/trueview/${scanDir}/CubeMapMeta.xml`,
          cube: cubeImages,
          panorama: `/output/trueview_stitched/${scanDir}_stitched.jpg`
        }
      });
      continue; // Skip the default scene push below
    }
    
    // Default scene push (only used if stitching fails or is not available)
    scenes.push({
      name: scanDir,
      source: 'trueview',
      center: coordinates,
      files: {
        meta: `/input_data/trueview/${scanDir}/CubeMapMeta.xml`,
        cube: cubeImages,
        panorama: cubeImages.face0 // Temporariamente usa face frontal
      }
    });
  }
}
*/