import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { OmniProvider } from './components/OmniProvider.tsx'

console.log('Cache buster v2');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <OmniProvider>
        <App />
      </OmniProvider>
    </AuthProvider>
  </StrictMode>,
)
