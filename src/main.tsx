import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { SettingsProvider } from './SettingsContext';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <SettingsProvider><App /></SettingsProvider>
);
