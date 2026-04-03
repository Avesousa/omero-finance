"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, X, DollarSign, CreditCard, Banknote, PiggyBank, TrendingUp, Wallet, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StatementSnapshot {
  id: string;
  cardName: string;
  amountToPay: number;       // ARS portion
  usdAmount: number | null;
  minimumPayment: number | null;
  month: string;
  year: number;
  currentRate: number;       // live rate for USD→ARS conversion
}

interface AccountSnap {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  isDefault: boolean;
  user: { name: string; avatarColor: string } | null;
}

interface PaymentModalProps {
  statement: StatementSnapshot;
  onClose: () => void;
  onPaid: (source: string) => void;
}

type AmountMode = "total" | "minimo" | "otro";
type PayFlow   = "ars" | "usd";

const TYPE_ICONS: Record<string, React.ElementType> = {
  CHECKING:   Banknote,
  SAVINGS:    PiggyBank,
  INVESTMENT: TrendingUp,
  CASH:       Wallet,
  DIGITAL:    Smartphone,
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  }).format(n);
}

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2,
  }).format(n);
}

export function PaymentModal({ statement, onClose, onPaid }: PaymentModalProps) {
  const router = useRouter();
  const [accounts, setAccounts]       = useState<AccountSnap[]>([]);
  const [loadingAccounts, setLA]      = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const [flow, setFlow]               = useState<PayFlow>("ars");
  const [mode, setMode]               = useState<AmountMode>("total");
  const [otroValue, setOtroValue]     = useState("");
  const [selectedAccount, setAccount] = useState<AccountSnap | null>(null);
  const [exchangeRate, setExchangeRate] = useState("");

  const hasUsd = !!statement.usdAmount;
  const hasMin = !!statement.minimumPayment;

  const usdInArs  = statement.usdAmount ? statement.usdAmount * statement.currentRate : 0;
  const totalFull = statement.amountToPay + usdInArs;

  const arsAmount = (() => {
    if (mode === "minimo" && statement.minimumPayment) return statement.minimumPayment;
    if (mode === "otro") return parseFloat(otroValue) || 0;
    return totalFull;
  })();

  const arsAccounts = accounts.filter((a) => a.currency === "ARS");
  const usdAccounts = accounts.filter((a) => a.currency === "USD");
  const visibleAccounts = flow === "usd" ? usdAccounts : arsAccounts;

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: AccountSnap[]) => {
        setAccounts(data);
        // Pre-select the default ARS account, or first ARS account
        const def = data.find((a) => a.currency === "ARS" && a.isDefault)
          ?? data.find((a) => a.currency === "ARS");
        if (def) setAccount(def);
      })
      .catch(() => {})
      .finally(() => setLA(false));
  }, []);

  // Switch default account when flow changes
  useEffect(() => {
    const cur = flow === "usd" ? "USD" : "ARS";
    const def = accounts.find((a) => a.currency === cur && a.isDefault)
      ?? accounts.find((a) => a.currency === cur);
    if (def) setAccount(def);
  }, [flow, accounts]);

  async function confirm(paymentSource: string, deductAmount: number, accountId?: string, customAmount?: number) {
    setSaving(true); setError(null);
    try {
      const body: Record<string, unknown> = {
        isPaid: true,
        paymentSource,
        ...(customAmount !== undefined && { customAmount }),
        ...(accountId && { accountId, deductAmount }),
      };
      const res = await fetch(`/api/tdc/${statement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error al registrar el pago");
      router.refresh();
      onPaid(paymentSource);
      onClose();
    } catch (e) { setError((e as Error).message); }
    finally     { setSaving(false); }
  }

  function handleArsConfirm() {
    if (!selectedAccount) { setError("Seleccioná una cuenta"); return; }
    if (mode === "otro" && (!otroValue || isNaN(parseFloat(otroValue)))) {
      setError("Ingresá un monto válido"); return;
    }
    const customAmt = mode !== "total" ? arsAmount : undefined;
    confirm(selectedAccount.name, arsAmount, selectedAccount.id, customAmt);
  }

  function handleUsdConfirm() {
    if (!selectedAccount) { setError("Seleccioná una cuenta"); return; }
    const usdAmt = statement.usdAmount ?? 0;
    confirm(selectedAccount.name, usdAmt, selectedAccount.id);
  }

  function handleUsdWithExchange() {
    if (!exchangeRate || isNaN(parseFloat(exchangeRate))) {
      setError("Ingresá el tipo de cambio"); return;
    }
    if (!selectedAccount) { setError("Seleccioná una cuenta"); return; }
    const converted = (statement.usdAmount ?? 0) * parseFloat(exchangeRate);
    confirm(`CAMBIO_USD:${exchangeRate}:${selectedAccount.name}`, converted, selectedAccount.id);
  }

  const hasEnoughUsdInAccount = selectedAccount && statement.usdAmount
    ? selectedAccount.balance >= statement.usdAmount
    : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard size={16} style={{ color: "var(--accent-green)" }} />
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Registrar pago
            </h2>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-secondary)" }}>
            <X size={20} />
          </button>
        </div>

        {/* Card + total */}
        <div
          className="rounded-xl px-4 py-2.5 flex items-center justify-between"
          style={{ backgroundColor: "var(--bg-elevated)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{statement.cardName}</p>
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {fmt(totalFull)}
            </p>
            {hasUsd && (
              <p className="text-[10px] tabular-nums" style={{ color: "var(--accent)" }}>
                {fmtUsd(statement.usdAmount!)} ≈ {fmt(usdInArs)}
              </p>
            )}
          </div>
        </div>

        {/* Flow selector: ARS / USD */}
        {hasUsd && (
          <div className="flex gap-2">
            <button
              onClick={() => setFlow("ars")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border"
              style={{
                borderColor:     flow === "ars" ? "var(--accent-green)" : "var(--border)",
                backgroundColor: flow === "ars" ? "rgba(34,197,94,0.08)" : "var(--bg-elevated)",
                color:           flow === "ars" ? "var(--accent-green)" : "var(--text-secondary)",
              }}
            >
              <CreditCard size={13} /> Pagar en ARS
            </button>
            <button
              onClick={() => setFlow("usd")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border"
              style={{
                borderColor:     flow === "usd" ? "var(--accent)" : "var(--border)",
                backgroundColor: flow === "usd" ? "rgba(99,102,241,0.08)" : "var(--bg-elevated)",
                color:           flow === "usd" ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              <DollarSign size={13} /> Pagar en USD
            </button>
          </div>
        )}

        {loadingAccounts ? (
          <div className="flex justify-center py-4">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
          </div>
        ) : (
          <>
            {/* ── ARS FLOW ── */}
            {flow === "ars" && (
              <div className="space-y-3">
                {/* Amount picker */}
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                    ¿Cuánto pagás?
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => setMode("total")}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm"
                      style={{
                        borderColor:     mode === "total" ? "var(--accent-green)" : "var(--border)",
                        backgroundColor: mode === "total" ? "rgba(34,197,94,0.08)" : "var(--bg-elevated)",
                        color:           mode === "total" ? "var(--accent-green)" : "var(--text-primary)",
                      }}
                    >
                      <span className="font-medium">Total</span>
                      <span className="tabular-nums font-bold">{fmt(totalFull)}</span>
                    </button>

                    {hasMin && (
                      <button
                        onClick={() => setMode("minimo")}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm"
                        style={{
                          borderColor:     mode === "minimo" ? "var(--accent-amber)" : "var(--border)",
                          backgroundColor: mode === "minimo" ? "rgba(245,158,11,0.08)" : "var(--bg-elevated)",
                          color:           mode === "minimo" ? "var(--accent-amber)" : "var(--text-primary)",
                        }}
                      >
                        <span className="font-medium">Mínimo</span>
                        <span className="tabular-nums font-bold">{fmt(statement.minimumPayment!)}</span>
                      </button>
                    )}

                    <button
                      onClick={() => setMode("otro")}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm"
                      style={{
                        borderColor:     mode === "otro" ? "var(--accent)" : "var(--border)",
                        backgroundColor: mode === "otro" ? "rgba(99,102,241,0.08)" : "var(--bg-elevated)",
                        color:           mode === "otro" ? "var(--accent)" : "var(--text-primary)",
                      }}
                    >
                      <span className="font-medium">Otro monto</span>
                      {mode === "otro" && otroValue
                        ? <span className="tabular-nums font-bold">{fmt(parseFloat(otroValue) || 0)}</span>
                        : <span style={{ color: "var(--text-secondary)" }}>ingresá el monto</span>}
                    </button>

                    {mode === "otro" && (
                      <Input
                        type="number" inputMode="decimal" placeholder="0" autoFocus
                        value={otroValue} onChange={(e) => setOtroValue(e.target.value)}
                        className="h-10 tabular-nums"
                        style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                      />
                    )}
                  </div>
                </div>

                {/* Account selector */}
                <AccountSelector
                  accounts={arsAccounts}
                  selected={selectedAccount}
                  onSelect={setAccount}
                  payAmount={arsAmount}
                />

                <ConfirmButton onClick={handleArsConfirm} saving={saving} />
              </div>
            )}

            {/* ── USD FLOW ── */}
            {flow === "usd" && (
              <div className="space-y-3">
                {usdAccounts.length === 0 && (
                  <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid var(--accent-amber)" }}>
                    <p className="text-xs" style={{ color: "var(--accent-amber)" }}>
                      No tenés cuentas en USD registradas
                    </p>
                  </div>
                )}

                {usdAccounts.length > 0 && hasEnoughUsdInAccount && (
                  <>
                    <AccountSelector
                      accounts={usdAccounts}
                      selected={selectedAccount}
                      onSelect={setAccount}
                      payAmount={statement.usdAmount ?? 0}
                      isUsd
                    />
                    <ConfirmButton onClick={handleUsdConfirm} saving={saving} />
                  </>
                )}

                {usdAccounts.length > 0 && !hasEnoughUsdInAccount && (
                  <>
                    <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid var(--accent-amber)" }}>
                      <p className="text-xs font-medium" style={{ color: "var(--accent-amber)" }}>
                        Saldo insuficiente en cuenta USD
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                        Ingresá el tipo de cambio al que vendiste los dólares
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
                        Tipo de cambio (ARS por USD)
                      </Label>
                      <Input
                        type="number" inputMode="decimal" placeholder="ej. 1500"
                        value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)}
                        className="h-10"
                        style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                      />
                      {exchangeRate && !isNaN(parseFloat(exchangeRate)) && (
                        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                          Equivale a {fmt((statement.usdAmount ?? 0) * parseFloat(exchangeRate))}
                        </p>
                      )}
                    </div>
                    <AccountSelector
                      accounts={arsAccounts}
                      selected={selectedAccount}
                      onSelect={setAccount}
                      payAmount={(statement.usdAmount ?? 0) * (parseFloat(exchangeRate) || 0)}
                    />
                    <ConfirmButton onClick={handleUsdWithExchange} saving={saving} />
                  </>
                )}
              </div>
            )}
          </>
        )}

        {error && <p className="text-xs" style={{ color: "var(--accent-red)" }}>{error}</p>}
      </div>
    </div>
  );
}

function AccountSelector({
  accounts, selected, onSelect, payAmount, isUsd = false,
}: {
  accounts: AccountSnap[];
  selected: AccountSnap | null;
  onSelect: (a: AccountSnap) => void;
  payAmount: number;
  isUsd?: boolean;
}) {
  if (accounts.length === 0) return null;
  return (
    <div>
      <Label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
        ¿De qué cuenta?
      </Label>
      <div className="flex flex-col gap-1.5">
        {accounts.map((a) => {
          const Icon = TYPE_ICONS[a.type] ?? Wallet;
          const afterBalance = isUsd
            ? a.balance - payAmount
            : a.balance - payAmount;
          const isSelected = selected?.id === a.id;
          return (
            <button
              key={a.id}
              onClick={() => onSelect(a)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left"
              style={{
                borderColor:     isSelected ? "var(--accent)" : "var(--border)",
                backgroundColor: isSelected ? "rgba(99,102,241,0.08)" : "var(--bg-elevated)",
              }}
            >
              <Icon size={14} style={{ color: isSelected ? "var(--accent)" : "var(--text-secondary)", flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{a.name}</p>
                {a.user && (
                  <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{a.user.name}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
                  {isUsd
                    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(a.balance)
                    : new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(a.balance)}
                </p>
                {payAmount > 0 && (
                  <p className="text-[10px] tabular-nums" style={{ color: afterBalance < 0 ? "var(--accent-red)" : "var(--accent-green)" }}>
                    → {isUsd
                      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(afterBalance)
                      : new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(afterBalance)}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ConfirmButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
      style={{ backgroundColor: "var(--accent-green)", color: "#fff" }}
    >
      {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
      {saving ? "Registrando…" : "Confirmar pago"}
    </button>
  );
}
