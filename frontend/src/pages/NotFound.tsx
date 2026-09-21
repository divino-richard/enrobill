import { PageHeader } from "@/components/page-header";
import { Link } from 'react-router-dom'

// Catch-all route for unknown client-side paths.
function NotFound() {
  return (
    <section className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 p-6">
      <PageHeader title="404" description={<>That page doesn’t exist.</>} />
      <Link className="text-primary text-sm font-medium underline underline-offset-4" to="/">Back to home</Link>
    </section>
  )
}

export default NotFound
