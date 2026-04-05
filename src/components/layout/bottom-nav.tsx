"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutDashboard, CreditCard, MoreHorizontal, Sparkles } from "lucide-react";

const NAV_ITEMS = [
  { href: "/",          icon: Home,            label: "Inicio"   },
  { href: "/dashboard", icon: LayoutDashboard, label: "Resumen"  },
  { href: "/tdc",       icon: CreditCard,      label: "Tarjetas" },
  { href: "/mas",       icon: MoreHorizontal,  label: "Más"      },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))", paddingLeft: "1rem", paddingRight: "1rem" }}
    >
      <nav
        className="glass w-full max-w-sm flex items-center justify-around px-2 py-2 rounded-2xl"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-nav)",
        }}
      >
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all"
              style={{
                color:           active ? "var(--accent)" : "var(--text-secondary)",
                backgroundColor: active ? "var(--accent-subtle)" : "transparent",
                minWidth: 64,
              }}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.2 : 1.7}
              />
              <span
                className="text-[10px] font-semibold tracking-wide leading-none"
                style={{ opacity: active ? 1 : 0.7 }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
