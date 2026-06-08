import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

<style>
  html, body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    background-color: #1a0533; /* Mets ici la couleur de fond de ton appli pour éviter le flash blanc au chargement */
  }
</style>
