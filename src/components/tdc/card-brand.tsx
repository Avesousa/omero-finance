/**
 * Card brand + bank detection and logo component.
 * Accepts either structured fields (cardType/entity) or a legacy name string.
 */

type Brand = "VISA" | "MC" | "AMEX" | null;

export function detectBrand(name: string): Brand {
  const up = name.toUpperCase();
  if (up.includes("AMEX") || up.includes("AMERICAN EXPRESS")) return "AMEX";
  if (up.includes("MASTERCARD") || /\bMC\b/.test(up)) return "MC";
  if (up.includes("VISA")) return "VISA";
  return null;
}

/** Strips brand + bank keywords from the display name so they aren't shown twice. */
export function cleanCardName(name: string): string {
  return name
    .replace(/\bamerican\s+express\b/gi, "")
    .replace(/\bmastercard\b/gi, "")
    .replace(/\bamex\b/gi, "")
    .replace(/\bvisa\b/gi, "")
    .replace(/\bmc\b/gi, "")
    .replace(/\bgalicia\b/gi, "")
    .replace(/\bbanco\s+naci[oó]n\b/gi, "")
    .replace(/\bmercadopago\b/gi, "")
    .replace(/\bcentopay\b/gi, "")
    .replace(/\bcentcopay\b/gi, "")
    .replace(/\bbn\b/gi, "")
    .replace(/\bmp\b/gi, "")
    .replace(/\bcp\b/gi, "")
    .replace(/\bbbva\b/gi, "")
    .replace(/\bbrubank\b/gi, "")
    .replace(/\bbk\b/gi, "")
    .replace(/\scencopay\b/gi, "")
    .trim();
}

// ── SVG brand logos ────────────────────────────────────────────────

function MastercardLogo({ size = 28 }: { size?: number }) {
  const r      = size * 0.36;
  const cx     = size / 2;
  const cy     = size / 2;
  const offset = size * 0.14;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Mastercard">
      <circle cx={cx - offset} cy={cy} r={r} fill="#EB001B" />
      <circle cx={cx + offset} cy={cy} r={r} fill="#F79E1B" />
      <path
        d={`M ${cx} ${cy - r * 0.87}
            A ${r} ${r} 0 0 1 ${cx} ${cy + r * 0.87}
            A ${r} ${r} 0 0 1 ${cx} ${cy - r * 0.87}`}
        fill="#FF5F00"
        opacity="0.9"
      />
    </svg>
  );
}

function VisaLogo({ size = 28 }: { size?: number }) {
  const w = Math.round(size * 1.8);
  const h = Math.round(size * 0.65);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="Visa">
      <rect width={w} height={h} rx={4} fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
      <text
        x={w / 2} y={h * 0.78}
        fontFamily="'Arial Black', Arial, sans-serif"
        fontWeight="900"
        fontSize={h * 0.65}
        fill="currentColor"
        textAnchor="middle"
        letterSpacing="-0.5"
      >
        VISA
      </text>
    </svg>
  );
}

function AmexLogo({ size = 28 }: { size?: number }) {
  const w = Math.round(size * 1.8);
  const h = Math.round(size * 0.65);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="American Express">
      <rect width={w} height={h} rx={4} fill="#2557D6" />
      <text
        x={w / 2} y={h * 0.76}
        fontFamily="'Arial', sans-serif"
        fontWeight="700"
        fontSize={h * 0.6}
        fill="#fff"
        textAnchor="middle"
      >
        AMEX
      </text>
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────

interface CardBrandIconProps {
  /** Legacy name string — used when structured fields are unavailable */
  name?: string;
  /** Structured card type: "VISA" | "MC" | "AMEX" — takes priority over name detection */
  cardType?: string | null;
  /** Structured entity name — shown as label when showBank is true */
  entity?: string | null;
  size?: number;
  showBank?: boolean;
}

export function CardBrandIcon({ name = "", cardType, entity, size = 28, showBank = true }: CardBrandIconProps) {
  const brand: Brand = cardType
    ? (cardType.toUpperCase() as Brand)
    : detectBrand(name);

  const bankLabel = entity ?? null;

  return (
    <span className="inline-flex items-center gap-1.5 flex-shrink-0">
      {brand === "MC"   && <MastercardLogo size={size} />}
      {brand === "VISA" && <VisaLogo size={size} />}
      {brand === "AMEX" && <AmexLogo size={size} />}
      {!brand && (
        <span
          className="inline-flex items-center justify-center rounded text-[9px] font-bold px-1"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)", minWidth: size, height: Math.round(size * 0.65) }}
        >
          TDC
        </span>
      )}
      {showBank && bankLabel && (
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
        >
          {bankLabel}
        </span>
      )}
    </span>
  );
}
