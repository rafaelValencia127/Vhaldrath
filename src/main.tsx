import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ServicesProvider } from './app/services';
import { App } from './ui/App';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider>
      <App />
    </ServicesProvider>
  </StrictMode>,
);
