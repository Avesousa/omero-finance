"use client";

import { useState } from "react";
import { Loader2, Save, KeyRound, Palette, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

const AVATAR_COLORS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#EF4444",
  "#F97316", "#EAB308", "#22C55E", "#14B8A6",
  "#3B82F6", "#64748B",
];

interface Member {
  id: string;
  name: string;
  avatarColor: string;
  role: string;
}

interface ProfileClientProps {
  userId:      string;
  name:        string;
  email:       string;
  avatarColor: string;
  householdName: string;
  householdType: string;
  members:     Member[];
}

function Section({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
      >
        <Icon size={15} style={{ color: "var(--accent)" }} />
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
      </div>
      <div className="px-4 py-4 space-y-3">{children}</div>
    </div>
  );
}

function Avatar({ color, name, size = 36 }: { color: string; name: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function ProfileClient({
  userId, name: initialName, email: initialEmail,
  avatarColor: initialColor, householdName, householdType, members,
}: ProfileClientProps) {
  const router = useRouter();

  // ── Datos personales
  const [name,  setName]  = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  // ── Contraseña
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd,     setNewPwd]     = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd]   = useState(false);
  const [pwdMsg, setPwdMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  // ── Avatar
  const [color,       setColor]       = useState(initialColor);
  const [savingColor, setSavingColor] = useState(false);

  async function handleSaveProfile() {
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      setProfileMsg({ ok: true, text: "Datos actualizados" });
      router.refresh();
    } catch (e) {
      setProfileMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSavePassword() {
    setPwdMsg(null);
    if (newPwd !== confirmPwd) {
      setPwdMsg({ ok: false, text: "Las contraseñas no coinciden" });
      return;
    }
    if (newPwd.length < 8) {
      setPwdMsg({ ok: false, text: "Mínimo 8 caracteres" });
      return;
    }
    setSavingPwd(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al cambiar contraseña");
      setPwdMsg({ ok: true, text: "Contraseña actualizada" });
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (e) {
      setPwdMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSavingPwd(false);
    }
  }

  async function handleSaveColor(newColor: string) {
    setColor(newColor);
    setSavingColor(true);
    try {
      await fetch("/api/auth/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarColor: newColor }),
      });
      router.refresh();
    } finally {
      setSavingColor(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Datos personales ── */}
      <Section title="Datos personales" icon={User}>
        <div className="flex items-center gap-3 mb-4">
          <Avatar color={color} name={name} size={44} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{name}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{email}</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Nombre</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {profileMsg && (
          <p className="text-xs" style={{ color: profileMsg.ok ? "var(--accent-green)" : "var(--accent-red)" }}>
            {profileMsg.text}
          </p>
        )}

        <button
          onClick={handleSaveProfile}
          disabled={savingProfile || !name.trim() || !email.trim()}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", opacity: savingProfile ? 0.7 : 1 }}
        >
          {savingProfile ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Guardar datos
        </button>
      </Section>

      {/* ── Color de avatar ── */}
      <Section title="Color de avatar" icon={Palette}>
        <div className="flex flex-wrap gap-2.5">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => handleSaveColor(c)}
              className="w-9 h-9 rounded-full transition-all"
              style={{
                backgroundColor: c,
                outline: c === color ? `3px solid var(--text-primary)` : "none",
                outlineOffset: 2,
                opacity: savingColor && c !== color ? 0.5 : 1,
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Avatar color={color} name={name} size={28} />
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {savingColor ? "Guardando…" : "Seleccioná un color"}
          </p>
        </div>
      </Section>

      {/* ── Cambiar contraseña ── */}
      <Section title="Cambiar contraseña" icon={KeyRound}>
        <div className="space-y-2">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Contraseña actual</label>
          <Input
            type="password"
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            placeholder="••••••••"
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Nueva contraseña</label>
          <Input
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Confirmar nueva contraseña</label>
          <Input
            type="password"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            placeholder="Repetí la nueva contraseña"
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {pwdMsg && (
          <p className="text-xs" style={{ color: pwdMsg.ok ? "var(--accent-green)" : "var(--accent-red)" }}>
            {pwdMsg.text}
          </p>
        )}

        <button
          onClick={handleSavePassword}
          disabled={savingPwd || !currentPwd || !newPwd || !confirmPwd}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", opacity: savingPwd ? 0.7 : 1 }}
        >
          {savingPwd ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
          Cambiar contraseña
        </button>
      </Section>

      {/* ── Info del hogar ── */}
      <Section title="Hogar" icon={User}>
        <div className="space-y-1 mb-3">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{householdName}</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Tipo: {householdType.charAt(0) + householdType.slice(1).toLowerCase()}
          </p>
        </div>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <Avatar color={m.avatarColor} name={m.name} size={32} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {m.name} {m.id === userId && <span style={{ color: "var(--accent)" }}>(vos)</span>}
                </p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
