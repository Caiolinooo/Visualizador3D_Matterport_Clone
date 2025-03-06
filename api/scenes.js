// api/scenes.js
import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readdirSync } from 'fs'

export default defineConfig({
  server: {
    middlewareMode: 'ssr',  // Modo SSR para middleware
    configureServer(server) {
      server.middlewares.use('/api/scenes', (req, res) => {
        const scansDir = resolve('input_data/scans')
        try {
          const folders = readdirSync(scansDir, { withFileTypes: true })
            .filter(dirent => dirent.isFile() && dirent.name.endsWith('.e57'))
            .map(file => file.name.replace('.e57', ''))
          
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(folders))
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Erro ao listar cenas: ' + error.message }))
        }
      })
    }
  }
})