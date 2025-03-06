# CLAUDE.md - Development Guidelines

## Commands
- `yarn start` or `node app.js` - Start the Express server
- `python process.py [input_dir]` - Process point cloud data (requires Python with open3d, numpy, PIL)
- Frontend development: `vite` or appropriate vite command (TBD)

## Code Style
- **JavaScript**: Use ES6+ features, consistent semicolon usage
- **Python**: Follow PEP 8 style guide, docstrings for functions
- **React**: Functional components with hooks preferred
- **Error Handling**: Use try/catch blocks with specific error messages
- **Naming**: camelCase for JS variables/functions, PascalCase for React components
- **Comments**: Document complex algorithms and public APIs
- **Imports**: Group imports (built-in, external, internal) with newlines between groups

## Project Structure
- `/api` - Backend API endpoints
- `/public` - Static frontend assets
- `/src` - React frontend source
- `/lib` - Shared utilities
- `/input_data` - 3D scan input data
- `/output` - Processed data and visualizations