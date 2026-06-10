import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import Home from './pages/Home'
import About from './pages/About'
import NotFound from './pages/NotFound'
import LoginPage from './pages/LoginPage'

// Central route configuration for the SPA.
// Uses `Component` (not `element`) so this stays a plain .ts file with no JSX.
export const router = createBrowserRouter([
  // Auth pages render standalone, outside the main app layout.
  { path: '/login', Component: LoginPage },

  // Everything else renders inside the App layout (nav + footer).
  {
    path: '/',
    Component: App,
    children: [
      { index: true, Component: Home },
      { path: 'about', Component: About },
      { path: '*', Component: NotFound },
    ],
  },
])
