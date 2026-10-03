import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { MuseumProvider } from './state/MuseumContext.jsx'
import './styles.css'
import './public-experience.css'

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <MuseumProvider><BrowserRouter><App /></BrowserRouter></MuseumProvider>
  </React.StrictMode>,
)
