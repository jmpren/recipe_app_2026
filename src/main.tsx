import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider'
import { ProfileProvider } from './auth/ProfileProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ProfileProvider>
          <App />
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
