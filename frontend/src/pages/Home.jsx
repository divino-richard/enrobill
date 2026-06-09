import { useEffect, useState } from 'react'
import api from '../lib/api'

// Home page — calls the Laravel API to confirm the frontend and backend
// are wired together.
function Home() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    api
      .get('/health')
      .then((res) => {
        if (active) setHealth(res.data)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <section>
      <h1>Welcome to Enrobill</h1>
      <p>A React + Vite single-page app backed by a Laravel API.</p>

      <h2>API status</h2>
      {loading && <p>Checking API…</p>}
      {error && <p style={{ color: 'crimson' }}>Could not reach API: {error}</p>}
      {health && (
        <pre className="card">{JSON.stringify(health, null, 2)}</pre>
      )}
    </section>
  )
}

export default Home
