"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight, Edit2, Loader2, Plus, Star, Trash2, X, Check,
  Banknote, PiggyBank, TrendingUp, Wallet, Smartphone,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ── Types ────────────────────────────────────────────────────────────

export type AccountType = "CHECKING" | "SAVINGS" | "INVESTMENT" | "CASH" | "DIGITAL";
export type Currency    = "ARS" | "USD";

export interface AccountUser {
  id:          string;
  name:        string;
  avatarColor: string;
}

export interface AccountItem {
  id:        string;
  name:      string;
  type:      AccountType;
  currency:  Currency;
  balance:   number;
  isDefault: boolean;
  userId:    string | null;
  user:      AccountUser | null;
}

// ── Constants ────────────────────────────────────────────────────────

const TYPE_LABELS: Record<AccountType, string> = {
  CHECKING:   "Cuenta corriente",
  SAVINGS:    "Caja de ahorro",
  INVESTMENT: "Inversión",
  CASH:       "Efectivo",
  DIGITAL:    "Billetera digital",
};

const TYPE_ICONS: Record<AccountType, React.ElementType> = {
  CHECKING:   Banknote,
  SAVINGS:    PiggyBank,
  INVESTMENT: TrendingUp,
  CASH:       Wallet,
  DIGITAL:    Smartphone,
};

const USERS = [
  { id: "cm_user_avelino", name: "Avelino", color: "#6366F1" },
  { id: "cm_user_maria",   name: "María",   color: "#EC4899" },
];

// ── Helpers ──────────────────────────────────────────────────────────

function fmt(n: number, currency: Currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency, maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(n);
}

function AccountIcon({ type, size = 16 }: { type: AccountType; size?: number }) {
  const Icon = TYPE_ICONS[type];
  return <Icon size={size} />;
}

// ── Transfer Modal ───────────────────────────────────────────────────

interface TransferModalProps {
  fromAccount: AccountItem;
  accounts:    AccountItem[];
  onClose:     () => void;
  onDone:      (fromId: string, toId: string, delta: number) => void;
}

function TransferModal({ fromAccount, accounts, onClose, onDone }: TransferModalProps) {
  const eligible = accounts.filter(
    (a) => a.id !== fromAccount.id && a.currency === fromAccount.currency
  );
  const [toId, setToId]       = useState(eligible[0]?.id ?? "");
  const [amount, setAmount]   = useState("");
  const [desc, setDesc]       = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleTransfer() {
    const parsed = parseFloat(amount);
    if (!toId || isNaN(parsed) || parsed <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${fromAccount.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toAccountId: toId, amount: parsed, description: desc }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      const data = await res.json();
      onDone(fromAccount.id, toId, parsed);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Transferir desde {fromAccount.name}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-secondary)" }}><X size={20} /></button>
        </div>

        {eligible.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: "var(--text-secondary)" }}>
            No hay otras cuentas en {fromAccount.currency} para transferir.
          </p>
        ) : (
          <>
            {/* Destination */}
            <div>
              <p className="text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Hacia</p>
              <div className="space-y-1.5">
                {eligible.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setToId(a.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors"
                    style={{
                      borderColor:     toId === a.id ? "var(--accent)" : "var(--border)",
                      backgroundColor: toId === a.id ? "rgba(99,102,241,0.08)" : "var(--bg-elevated)",
                    }}
                  >
                    <AccountIcon type={a.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{a.name}</p>
                      <p className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmt(a.balance, a.currency)}</p>
                    </div>
                    {toId === a.id && <Check size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Monto ({fromAccount.currency})</p>
              <Input
                type="number" inputMode="decimal" placeholder="0"
                value={amount} onChange={(e) => setAmount(e.target.value)}
                className="text-lg font-semibold h-12"
                style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
              {Number(amount) > fromAccount.balance && (
                <p className="text-xs mt-1" style={{ color: "var(--accent-red)" }}>
                  Saldo insuficiente (disponible {fmt(fromAccount.balance, fromAccount.currency)})
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Descripción (opcional)</p>
              <Input
                placeholder="ej: ahorro viaje"
                value={desc} onChange={(e) => setDesc(e.target.value)}
                style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>

            {error && <p className="text-xs" style={{ color: "var(--accent-red)" }}>{error}</p>}

            <Button
              onClick={handleTransfer}
              disabled={saving || !toId || !amount || Number(amount) <= 0}
              className="w-full h-11 font-semibold rounded-xl"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <ArrowLeftRight size={16} className="mr-2" />}
              {saving ? "Transfiriendo…" : "Transferir"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

interface AccountManagerProps {
  initial: AccountItem[];
}

export function AccountManager({ initial }: AccountManagerProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountItem[]>(initial);
  const [editId, setEditId]     = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [transferFrom, setTransferFrom] = useState<AccountItem | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // New account form
  const [newName, setNewName]       = useState("");
  const [newType, setNewType]       = useState<AccountType>("SAVINGS");
  const [newCurrency, setNewCur]    = useState<Currency>("ARS");
  const [newBalance, setNewBalance] = useState("");
  const [newUserId, setNewUserId]   = useState<string>("");

  // Edit form
  const [editName, setEditName]       = useState("");
  const [editBalance, setEditBalance] = useState("");
  const [editType, setEditType]       = useState<AccountType>("SAVINGS");

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:     newName.trim(),
          type:     newType,
          currency: newCurrency,
          balance:  newBalance || "0",
          userId:   newUserId || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      const account: AccountItem = await res.json();
      setAccounts((p) => {
        // If new account is default for a user, unset others for same user
        const updated = account.userId
          ? p.map((a) => a.userId === account.userId ? { ...a, isDefault: false } : a)
          : p;
        return [...updated, account];
      });
      setNewName(""); setNewBalance(""); setNewType("SAVINGS"); setNewCur("ARS"); setNewUserId("");
      router.refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, balance: editBalance, type: editType }),
      });
      if (!res.ok) throw new Error();
      const updated: AccountItem = await res.json();
      setAccounts((p) => p.map((a) => a.id === id ? updated : a));
      setEditId(null);
      router.refresh();
    } catch { setError("Error al guardar"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      setAccounts((p) => p.filter((a) => a.id !== id));
      setDeleteId(null);
      router.refresh();
    } finally { setSaving(false); }
  }

  async function handleSetDefault(account: AccountItem) {
    if (!account.userId) return;
    await fetch(`/api/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true, userId: account.userId }),
    });
    setAccounts((p) => p.map((a) =>
      a.userId === account.userId
        ? { ...a, isDefault: a.id === account.id }
        : a
    ));
    router.refresh();
  }

  function handleTransferDone(fromId: string, toId: string, delta: number) {
    setAccounts((p) => p.map((a) => {
      if (a.id === fromId) return { ...a, balance: a.balance - delta };
      if (a.id === toId)   return { ...a, balance: a.balance + delta };
      return a;
    }));
    router.refresh();
  }

  // Group by currency
  const arsAccounts = accounts.filter((a) => a.currency === "ARS");
  const usdAccounts = accounts.filter((a) => a.currency === "USD");
  const arsTotal    = arsAccounts.reduce((s, a) => s + a.balance, 0);
  const usdTotal    = usdAccounts.reduce((s, a) => s + a.balance, 0);

  function AccountRow({ a }: { a: AccountItem }) {
    const user = USERS.find((u) => u.id === a.userId);
    if (editId === a.id) {
      return (
        <div className="px-4 py-3 space-y-2" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)}
            className="h-9 text-sm"
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
          <div className="flex gap-2">
            <Input type="number" value={editBalance} onChange={(e) => setEditBalance(e.target.value)}
              placeholder="Saldo" className="flex-1 h-9 text-sm"
              style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
              {(["SAVINGS","CHECKING","INVESTMENT","CASH","DIGITAL"] as AccountType[]).map((t) => (
                <button key={t} onClick={() => setEditType(t)}
                  className="px-2 py-1 text-xs"
                  style={{ backgroundColor: editType === t ? "var(--accent)" : "var(--bg-elevated)", color: editType === t ? "var(--accent-foreground)" : "var(--text-secondary)" }}>
                  {t === "SAVINGS" ? "Ahorro" : t === "CHECKING" ? "CC" : t === "INVESTMENT" ? "Inv" : t === "CASH" ? "Ef." : "Dig."}
                </button>
              ))}
            </div>
            <button onClick={() => handleEdit(a.id)} disabled={saving}
              className="w-9 h-9 flex items-center justify-center rounded-xl"
              style={{ backgroundColor: "var(--accent-green)", color: "#fff" }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            </button>
            <button onClick={() => setEditId(null)}
              className="w-9 h-9 flex items-center justify-center rounded-xl border"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              <X size={13} />
            </button>
          </div>
        </div>
      );
    }

    if (deleteId === a.id) {
      return (
        <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: "var(--bg-card)" }}>
          <p className="flex-1 text-xs" style={{ color: "var(--text-primary)" }}>¿Eliminar <strong>{a.name}</strong>?</p>
          <button onClick={() => handleDelete(a.id)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
            style={{ backgroundColor: "var(--accent-red)", color: "#fff" }}>Sí</button>
          <button onClick={() => setDeleteId(null)} className="text-xs px-2.5 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>No</button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: "var(--bg-card)" }}>
        {/* Type icon */}
        <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
          <AccountIcon type={a.type} size={16} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{a.name}</p>
            {a.isDefault && user && (
              <Star size={11} fill="currentColor" style={{ color: user.color, flexShrink: 0 }} />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{TYPE_LABELS[a.type]}</p>
            {user && (
              <span className="text-[10px] font-semibold px-1 rounded"
                style={{ backgroundColor: `${user.color}22`, color: user.color }}>
                {user.name}
              </span>
            )}
          </div>
        </div>

        {/* Balance */}
        <p className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: "var(--text-primary)" }}>
          {fmt(a.balance, a.currency)}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setTransferFrom(a)} title="Transferir"
            style={{ color: "var(--text-secondary)" }}>
            <ArrowLeftRight size={14} />
          </button>
          {a.userId && !a.isDefault && (
            <button onClick={() => handleSetDefault(a)} title="Marcar como default"
              style={{ color: "var(--text-secondary)" }}>
              <Star size={14} />
            </button>
          )}
          <button onClick={() => { setEditId(a.id); setEditName(a.name); setEditBalance(String(a.balance)); setEditType(a.type); setError(null); }}
            style={{ color: "var(--text-secondary)" }}>
            <Edit2 size={14} />
          </button>
          <button onClick={() => { setDeleteId(a.id); setError(null); }}
            style={{ color: "var(--accent-red)" }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  }

  function CurrencySection({ label, total, accs, currency }: { label: string; total: number; accs: AccountItem[]; currency: Currency }) {
    if (accs.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>{label}</p>
          <p className="text-xs font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmt(total, currency)}</p>
        </div>
        <div className="rounded-2xl border divide-y overflow-hidden" style={{ borderColor: "var(--border)" }}>
          {accs.map((a) => <AccountRow key={a.id} a={a} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Totals header */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Total ARS</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmt(arsTotal)}</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Total USD</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: "var(--accent-green)" }}>{fmt(usdTotal, "USD")}</p>
        </div>
      </div>

      <CurrencySection label="Pesos (ARS)" total={arsTotal} accs={arsAccounts} currency="ARS" />
      <CurrencySection label="Dólares (USD)" total={usdTotal} accs={usdAccounts} currency="USD" />

      {error && <p className="text-xs" style={{ color: "var(--accent-red)" }}>{error}</p>}

      {/* Add new */}
      <div className="rounded-2xl border p-4 space-y-3" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
        <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Nueva cuenta</p>

        <Input placeholder="Nombre (ej. Caja Ahorro BN)" value={newName} onChange={(e) => setNewName(e.target.value)}
          className="h-9 text-sm"
          style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }} />

        {/* Type */}
        <div className="flex gap-1 flex-wrap">
          {(["SAVINGS","CHECKING","INVESTMENT","CASH","DIGITAL"] as AccountType[]).map((t) => (
            <button key={t} onClick={() => setNewType(t)}
              className="px-2.5 py-1 text-xs rounded-lg border"
              style={{
                backgroundColor: newType === t ? "var(--accent)" : "var(--bg-elevated)",
                borderColor:     newType === t ? "var(--accent)" : "var(--border)",
                color:           newType === t ? "var(--accent-foreground)" : "var(--text-secondary)",
              }}>
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {/* Currency */}
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
            {(["ARS","USD"] as Currency[]).map((c) => (
              <button key={c} onClick={() => setNewCur(c)}
                className="px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: newCurrency === c ? "var(--accent)" : "var(--bg-elevated)",
                  color:           newCurrency === c ? "var(--accent-foreground)" : "var(--text-secondary)",
                }}>{c}</button>
            ))}
          </div>

          {/* Balance */}
          <Input type="number" inputMode="decimal" placeholder="Saldo inicial" value={newBalance}
            onChange={(e) => setNewBalance(e.target.value)}
            className="flex-1 h-9 text-sm"
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
        </div>

        {/* Owner (optional) */}
        <div>
          <p className="text-[10px] mb-1" style={{ color: "var(--text-secondary)" }}>Dueño (opcional — para cuenta default por perfil)</p>
          <div className="flex gap-2">
            <button onClick={() => setNewUserId("")}
              className="flex-1 py-1.5 text-xs rounded-lg border"
              style={{
                backgroundColor: newUserId === "" ? "var(--bg-elevated)" : "transparent",
                borderColor:     newUserId === "" ? "var(--accent)" : "var(--border)",
                color:           newUserId === "" ? "var(--text-primary)" : "var(--text-secondary)",
              }}>Compartida</button>
            {USERS.map((u) => (
              <button key={u.id} onClick={() => setNewUserId(u.id)}
                className="flex-1 py-1.5 text-xs rounded-lg border font-medium"
                style={{
                  backgroundColor: newUserId === u.id ? `${u.color}22` : "transparent",
                  borderColor:     newUserId === u.id ? u.color : "var(--border)",
                  color:           newUserId === u.id ? u.color : "var(--text-secondary)",
                }}>{u.name}</button>
            ))}
          </div>
        </div>

        <Button onClick={handleAdd} disabled={saving || !newName.trim()}
          className="w-full h-9 rounded-xl font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} />}
          {!saving && <span className="ml-1">Agregar cuenta</span>}
        </Button>
      </div>

      {/* Transfer modal */}
      {transferFrom && (
        <TransferModal
          fromAccount={transferFrom}
          accounts={accounts}
          onClose={() => setTransferFrom(null)}
          onDone={handleTransferDone}
        />
      )}
    </div>
  );
}
