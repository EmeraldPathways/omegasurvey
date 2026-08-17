export default function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="brand" aria-label="Omega Financial"><span className="brand-mark" aria-hidden="true">Ω</span>{!compact && <span className="brand-name"><strong>OMEGA</strong><small>FINANCIAL</small></span>}</div>;
}
