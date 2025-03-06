const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static('public')); // Serve static files from the 'public' directory

app.get('/api/scenes', (req, res) => {
    const scansDir = path.resolve('input_data/scans');
    console.log(`Looking for e57 files in: ${scansDir}`);

    try {
        const e57Files = fs.readdirSync(scansDir, { withFileTypes: true })
            .filter(d => d.isFile() && d.name.endsWith('.e57'));
        console.log(`Detected e57 files:`, e57Files.map(d => d.name));

        const scenes = e57Files
            .map(d => {
                const sceneName = d.name.replace('.e57', '');
                console.log(`Processing scene: ${sceneName}`);
                
                const panoramaPath = path.join(sceneName, 'panorama.jpg');
                const absolutePanoramaPath = path.resolve('public', panoramaPath);
                console.log(`Checking for panorama at: ${absolutePanoramaPath}`);

                if (!fs.existsSync(absolutePanoramaPath)) {
                    console.error(`Panorama file not found: ${absolutePanoramaPath}`);
                    return null; 
                }
                return {
                    name: sceneName,
                    panorama: `/${sceneName}/panorama.jpg`,
                };
            })
            .filter(scene => scene !== null);

        res.json(scenes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load scenes', details: error.message });
    }
});

try {
    app.listen(5173, () => {
        console.log('Server running at http://localhost:5173');
    });
} catch (error) {
    console.error('Failed to start server:', error);
}
