import { Link } from 'react-router-dom'

// Catch-all route for unknown client-side paths.
function NotFound() {
  return (
    <section>
      <h1>404</h1>
      <p>That page doesn’t exist.</p>
      <Link to="/">Back to home</Link>
    </section>
  )
}

export default NotFound
