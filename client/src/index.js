import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { SocketProvider } from './context/SocketContext';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <SocketProvider>
      <App />
    </SocketProvider>
  </React.StrictMode>
);