"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#050507",
          color: "#f7f6f3",
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", margin: 0 }}>steprs.dev</h1>
          <p style={{ margin: 0, opacity: 0.72, maxWidth: "28rem" }}>
            A critical error occurred. Refresh the page to continue triaging
            STEP files locally.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "0.5rem",
              padding: "0.5rem 1rem",
              border: "1px solid #444",
              borderRadius: "2px",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
