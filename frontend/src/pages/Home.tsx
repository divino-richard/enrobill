import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// Shape of the GET /api/health response.
interface HealthResponse {
  status: string
  service: string
  time: string
}

// Home page — calls the Laravel API to confirm the frontend and backend
// are wired together. Uses shadcn/ui components.
function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadHealth = async () => {
    try {
      const res = await api.get<HealthResponse>('/health')
      setHealth(res.data)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    setLoading(true)
    setError(null)
    void loadHealth()
  }

  useEffect(() => {
    // Simple fetch-on-mount. (When data needs grow, prefer a data library or a
    // react-router loader over fetching in an effect.)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHealth()
  }, [])

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome to Enrobill
        </h1>
        <p className="text-muted-foreground">
          A React + Vite single-page app backed by a Laravel API.
        </p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>API status</CardTitle>
          <CardDescription>Live response from the backend.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <p className="text-sm text-muted-foreground">Checking API…</p>
          )}
          {error && (
            <p className="text-sm text-destructive">Could not reach API: {error}</p>
          )}
          {health && (
            <pre className="rounded-md bg-muted p-3 text-sm overflow-x-auto">
              {JSON.stringify(health, null, 2)}
            </pre>
          )}
          <Button onClick={handleRefresh} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}

export default Home
