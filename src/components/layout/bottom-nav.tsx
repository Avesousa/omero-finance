"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutDashboard, CreditCard, User, MoreHorizontal } from "lucide-react";

const NAV_ITEMS = [
  { href: "/",          icon: Home,            label: "Inicio" },
  { href: "/dashboard", icon: LayoutDashboard, label: "Resumen" },
  { href: "/tdc",       icon: CreditCard,      label: "Tarjetas" },
  { href: "/perfil",    icon: User,            label: "Perfil" },
  { href: "/mas",       icon: MoreHorizontal,  label: "Más" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t pb-safe"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center justify-around px-2 pt-2 pb-1 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors min-w-0"
              style={{
                color: active ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
