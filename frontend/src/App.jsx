import { NavLink, Outlet } from 'react-router-dom'
import './App.css'

// Shared layout for the SPA: top navigation, the active page, and a footer.
function App() {
  return (
    <div className="layout">
      <header className="topbar">
        <span className="brand">Enrobill</span>
        <nav className="nav">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <footer className="footer">
        <small>Enrobill SPA &middot; React + Vite &middot; Laravel API</small>
      </footer>
    </div>
  )
}

export default App
