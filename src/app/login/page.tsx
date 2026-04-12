"use client";

import { Suspense, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al iniciar sesión");
        return;
      }

      router.push(from);
      router.refresh();
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-xs font-medium text-[#8888AA] uppercase tracking-wider"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          className="w-full rounded-xl border border-[#2A2A3D] bg-[#1C1C27] px-3.5 py-2.5 text-sm text-[#F0F0FF] placeholder-[#8888AA] outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-xs font-medium text-[#8888AA] uppercase tracking-wider"
        >
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-xl border border-[#2A2A3D] bg-[#1C1C27] px-3.5 py-2.5 text-sm text-[#F0F0FF] placeholder-[#8888AA] outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#EF4444]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-[#6366F1] py-2.5 text-sm font-medium text-white transition hover:bg-[#4F46E5] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-[#F0F0FF] tracking-tight">
            Omero
          </h1>
          <p className="mt-1 text-sm text-[#8888AA]">Presupuesto del hogar</p>
        </div>

        <div className="rounded-2xl border border-[#2A2A3D] bg-[#13131A] p-6">
          <h2 className="mb-5 text-base font-medium text-[#F0F0FF]">
            Iniciar sesión
          </h2>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-4 text-center text-xs text-[#8888AA]">
          Uso personal · Casa Figueira
        </p>
      </div>
    </div>
  );
}
