import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { IconContext } from '@phosphor-icons/react';
import App from './App';
import './styles/index.css';

if (import.meta.env.DEV) {
  void Promise.all([import('@axe-core/react'), import('react-dom')]).then(([axeModule, reactDomModule]) => {
    axeModule.default(React, reactDomModule, 1000);
  });
}

const rootElement = document.getElementById('root')!;
const application = (
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <IconContext.Provider value={{ weight: 'thin' }}>
        <App />
      </IconContext.Provider>
    </BrowserRouter>
  </React.StrictMode>
);

ReactDOM.createRoot(rootElement).render(application);
