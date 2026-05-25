import { defineConfig } from 'vite' // defineConfig is a helper that provides TypeScript autocompletion/type-checking for Vite config options
import react from '@vitejs/plugin-react' // official Vite plugin that handles React JSX transforms, Babel/SWC processing, and Hot Module Replacement fast-refresh

// https://vite.dev/config/
export default defineConfig({  // export the Vite configuration object; Vite reads this when starting the dev server or running a build
  plugins: [react()],  // register the React plugin so Vite can compile .jsx files and enable instant component refresh during development
})
