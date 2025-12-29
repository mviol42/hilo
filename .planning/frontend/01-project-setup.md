# Task 1: Project Setup

## Goal

Initialize a React + TypeScript + Vite project for the Hi-Lo frontend, configure dependencies, and set up the development environment.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Backend server running (for testing)

## Steps

### 1. Create Vite Project

```bash
cd /Users/mike/git/hilo
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

### 2. Install Dependencies

#### Core Dependencies
```bash
npm install \
  react-router-dom \
  axios \
  socket.io-client \
  @hilo/shared
```

#### Development Dependencies
```bash
npm install -D \
  @types/react-router-dom \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  vitest \
  jsdom \
  tailwindcss \
  postcss \
  autoprefixer
```

### 3. Configure Tailwind CSS (Optional)

```bash
npx tailwindcss init -p
```

Update `tailwind.config.js`:
```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Add to `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 4. Configure TypeScript

Update `tsconfig.json` to extend from shared config:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 5. Configure Vite

Update `vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
  },
})
```

### 6. Set Up Test Configuration

Create `src/tests/setup.ts`:
```typescript
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

// Cleanup after each test
afterEach(() => {
  cleanup()
})
```

### 7. Create Project Structure

```bash
mkdir -p src/{components,pages,hooks,utils,services,context,types,tests}
```

Expected structure:
```
frontend/
├── public/
│   └── vite.svg
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── Card/
│   │   ├── Button/
│   │   └── ...
│   ├── pages/           # Page components
│   │   ├── LandingPage/
│   │   ├── LobbyPage/
│   │   └── GamePage/
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Utility functions
│   ├── services/        # API client, WebSocket manager
│   ├── context/         # React Context providers
│   ├── types/           # Local type definitions
│   ├── tests/           # Test utilities and setup
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

### 8. Configure Package.json Scripts

Update `package.json`:
```json
{
  "name": "frontend",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  }
}
```

### 9. Create Environment Configuration

Create `.env.development`:
```bash
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

Create `.env.production`:
```bash
VITE_API_URL=https://api.hilo-game.com
VITE_WS_URL=https://api.hilo-game.com
```

Create `src/config.ts`:
```typescript
export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  wsUrl: import.meta.env.VITE_WS_URL || 'http://localhost:3000',
} as const
```

### 10. Update Root README

Add frontend instructions to `/Users/mike/git/hilo/README.md`:

```markdown
### Run Frontend (Web UI)

\`\`\`bash
cd frontend
npm run dev
\`\`\`

The frontend will be available at http://localhost:5173
```

## Verification

1. **Dev Server Starts**:
   ```bash
   npm run dev
   # Should start dev server on http://localhost:5173
   ```

2. **Build Succeeds**:
   ```bash
   npm run build
   # Should compile without errors
   ```

3. **Tests Run**:
   ```bash
   npm test
   # Should run (even if no tests yet)
   ```

4. **Type Checking**:
   ```bash
   npx tsc --noEmit
   # Should pass with no errors
   ```

5. **Shared Types Import**:
   Create a test file `src/tests/types.test.ts`:
   ```typescript
   import { describe, it, expect } from 'vitest'
   import type { Card, PlayerView, LobbyState } from '@hilo/shared'

   describe('Shared Types', () => {
     it('should import Card type', () => {
       const card: Card = { rank: 'A', suit: 'hearts' }
       expect(card).toBeDefined()
     })

     it('should import PlayerView type', () => {
       const view: Partial<PlayerView> = { phase: 'setup' }
       expect(view.phase).toBe('setup')
     })
   })
   ```

## Output Files

- `/frontend/package.json` - Project dependencies
- `/frontend/vite.config.ts` - Vite configuration
- `/frontend/tsconfig.json` - TypeScript configuration
- `/frontend/tailwind.config.js` - Tailwind CSS configuration (optional)
- `/frontend/src/config.ts` - Environment configuration
- `/frontend/src/tests/setup.ts` - Test setup file

## Next Steps

- Task 2: Set up routing and navigation
- Task 8: Create shared UI components
- Task 3: Implement API client and WebSocket manager

## Notes

- The `@hilo/shared` package should already be built (from backend setup)
- Vite's proxy configuration allows frontend to call backend API without CORS issues
- Path alias `@/` configured for cleaner imports (e.g., `import { Button } from '@/components/Button'`)
