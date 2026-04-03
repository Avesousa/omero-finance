"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import { CardManagement, type CardItem } from "./card-management";

interface TdcPageClientProps {
  cards: CardItem[];
}

export function TdcPageClient({ cards }: TdcPageClientProps) {
  const [showCards, setShowCards] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowCards(true)}
        className="flex items-center gap-2 self-end text-xs font-medium px-3 py-1.5 rounded-xl border"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-secondary)",
          backgroundColor: "var(--bg-elevated)",
        }}
      >
        <Settings2 size={13} />
        Gestionar tarjetas
      </button>

      {showCards && (
        <CardManagement cards={cards} onClose={() => setShowCards(false)} />
      )}
    </>
  );
}
