import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext'
import './index.css'

// De login-poort (AuthGate) zit nu in AuthLayout, rond de INTERNE routes.
// De router staat daarom boven de poort, zodat de publieke deelroute
// /gedeeld/:token (zie App.jsx) buiten de login bereikbaar blijft.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
)
