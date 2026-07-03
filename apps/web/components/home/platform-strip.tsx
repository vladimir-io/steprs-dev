const CAPABILITIES = [
  { id: "stock", label: "Stock", detail: "Billet for material buy" },
  { id: "tools", label: "Holes", detail: "Nearest catalog drills" },
  { id: "schema", label: "Header", detail: "AP, units, assembly" },
  { id: "aag", label: "AAG", detail: "Topology export" },
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
