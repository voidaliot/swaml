import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative assets work at /swaml/, on custom domains and in a local preview.
export default defineConfig({ plugins: [react()], base: './' });
