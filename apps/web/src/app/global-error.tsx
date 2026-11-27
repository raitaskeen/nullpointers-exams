"use client";

/**
 * Last-resort screen when the root layout itself fails. It can't rely on the app's CSS or providers,
 * so it carries its own minimal styling.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#fbfbfd", color: "#1b1d24", padding: 24 }}>
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 26, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Something broke</h1>
          <p style={{ color: "#5b6070", margin: "0 0 24px", lineHeight: 1.6 }}>
            The app hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ minHeight: 44, padding: "0 20px", borderRadius: 10, border: 0, background: "#2f5bd3", color: "#fff", fontWeight: 600, fontSize: 15, cursor: "pointer" }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
