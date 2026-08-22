export default function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "brand compact" : "brand"} aria-label="Omega Financial"><img src="/omega-financial-logo-email.png" alt="Omega Financial" /></div>;
}
