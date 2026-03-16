import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthProvider';
import { ToastProvider } from './components/ToastProvider';
import { DataProvider } from './contexts/DataProvider';
import { RouterProvider } from './contexts/RouterProvider';
import { ActivityProvider } from './contexts/ActivityProvider';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <DataProvider>
          <ActivityProvider>
            <RouterProvider>
              <App />
            </RouterProvider>
          </ActivityProvider>
        </DataProvider>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);