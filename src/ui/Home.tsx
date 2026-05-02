export function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <section style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>Frenzy</h1>
        <p style={{ fontSize: "1.125rem", opacity: 0.8 }}>
          Stay tuned.
        </p>
      </section>
    </main>
  );
}
