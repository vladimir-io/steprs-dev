const CAPABILITIES = [
  { id: "preflight", label: "Pre-Flight", detail: "Machine + tool fit" },
  { id: "tools", label: "Holes", detail: "Drill list" },
  { id: "stock", label: "Stock", detail: "Billet size" },
  { id: "schema", label: "Header", detail: "Units, AP" },
] as const;

export function PlatformStrip() {
  return (
    <ul className="platform-strip" aria-label="Capabilities">
      {CAPABILITIES.map((item, index) => (
        <li
          key={item.id}
          className="platform-strip__item"
          style={{ animationDelay: `${0.12 + index * 0.06}s` }}
        >
          <span className="platform-strip__label">{item.label}</span>
          <span className="platform-strip__detail">{item.detail}</span>
        </li>
      ))}
    </ul>
  );
}
