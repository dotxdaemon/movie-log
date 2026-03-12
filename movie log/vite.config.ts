// ABOUTME: Configures the React renderer build and the Vitest test runner for the desktop app.
// ABOUTME: Keeps the browser bundle file-friendly and the test environment focused on Node logic.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
