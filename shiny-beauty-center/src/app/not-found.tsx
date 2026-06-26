// Minimal fallback not-found for paths outside [locale]
export default function NotFound() {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          margin: 0,
          background: "#fff1f2",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ color: "#f43f5e", marginBottom: "1rem" }}>404</h1>
          <p style={{ color: "#62636e" }}>Page not found</p>
          <a
            href="/en"
            style={{
              color: "#f43f5e",
              display: "inline-block",
              marginTop: "1rem",
              textDecoration: "none",
              border: "1px solid #fda4af",
              padding: "0.5rem 1.5rem",
              borderRadius: "9999px",
            }}
          >
            Home
          </a>
        </div>
      </body>
    </html>
  );
}
