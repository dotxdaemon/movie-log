// ABOUTME: Boots the React renderer into the Electron window.
// ABOUTME: Connects the app shell to the browser DOM entrypoint.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
