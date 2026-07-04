export function HomeHero() {
  return (
    <header className="home-hero">
      <h1 className="home-hero__title">
        Client-side STEP triage.
        <span className="home-hero__title-break" />
        <span className="home-hero__title-quiet">Zero upload. No machine crashes.</span>
      </h1>
      <p className="home-hero__lead">
        Run your STEP files through an instant, local pre-flight check before opening heavy CAM software. Verify tool reach, Z-axis stack clearance, and workholding fits in 60 milliseconds. 100% inside your browser worker via Rust WebAssembly.
      </p>
      <p className="home-hero__privacy">
        Because a snapped endmill is a terrible way to discover a deep pocket.
      </p>
    </header>
  );
}
