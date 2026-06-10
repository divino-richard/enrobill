// Static example page to demonstrate client-side SPA routing.
function About() {
  return (
    <section>
      <h1>About</h1>
      <p>
        This page is rendered entirely on the client. Navigating here does not
        trigger a full page reload — it is handled by React Router.
      </p>
      <p>
        The Laravel backend is API-only; it never renders these pages. It just
        serves JSON from <code>/api/*</code>.
      </p>
    </section>
  )
}

export default About
