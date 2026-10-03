"use client";

import { useState } from "react";
import {
  FREQUENCY_LABEL, FREQUENCY_UNIT, fmtMoney, numberToInput, occurrencesInPeriod, parseMoney,
  periodLabel, round2, todayIso, currentPeriod,
  type CategoryDTO, type Currency, type EntryDTO, type Frequency, type Kind, type RecurringDTO,
} from "@/lib/plan/core";
import {
  Chips, ErrorText, Field, MoneyInput, NativeSelect, PrimaryButton, SecondaryButton,
  Segmented, Sheet, Switch, TextInput, api, useAction,
} from "./plan-ui";

const FREQUENCIES: readonly { value: Frequency; label: string }[] = [
  { value: "MONTHLY", label: "Mensual" },
  { value: "BIWEEKLY", label: "Quincenal" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "DAILY", label: "Diario" },
];

const WEEKDAYS = [
  { id: "1", label: "Lun" }, { id: "2", label: "Mar" }, { id: "3", label: "Mié" },
  { id: "4", label: "Jue" }, { id: "5", label: "Vie" }, { id: "6", label: "Sáb" }, { id: "0", label: "Dom" },
];

const CURRENCIES: readonly { value: Currency; label: string }[] = [
  { value: "ARS", label: "Pesos" },
  { value: "USD", label: "Dólares" },
];

export interface EntrySheetProps {
  kind: Kind;
  period: string;
  categories: CategoryDTO[];
  /** Si viene, se edita ese movimiento. */
  entry?: EntryDTO;
  /** Regla del fijo que se está editando (para mostrar su frecuencia). */
  rule?: RecurringDTO;
  /** Al crear: arranca en "fijo". */
  defaultFixed?: boolean;
  onClose: () => void;
}

export function EntrySheet({ kind, period, categories, entry, rule, defaultFixed, onClose }: EntrySheetProps) {
  const isIncome = kind === "INCOME";
  const isEdit = !!entry;
  const isFixedEntry = !!entry?.recurringId;
  const action = useAction();

  const [fixed, setFixed] = useState(isEdit ? isFixedEntry : !!defaultFixed);
  const [amount, setAmount] = useState(numberToInput(entry?.amount));
  const [currency, setCurrency] = useState<Currency>(entry?.currency ?? "ARS");
  const [name, setName] = useState(entry?.name ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(entry?.categoryId ?? null);
  const [targetCategoryId, setTargetCategoryId] = useState(entry?.targetCategoryId ?? "");
  const [date, setDate] = useState(
    entry ? entry.date ?? "" : period === currentPeriod() ? todayIso() : "",
  );
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? "MONTHLY");
  const [weekday, setWeekday] = useState<string | null>(rule?.weekday != null ? String(rule.weekday) : null);
  const [applyToRule, setApplyToRule] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const ownCategories = categories.filter(
    (c) => c.kind === kind && !c.systemKey && (!c.isArchived || c.id === categoryId),
  );
  const expenseCategories = categories.filter(
    (c) => c.kind === "EXPENSE" && (!c.isArchived || c.id === targetCategoryId),
  );

  const parsed = parseMoney(amount);
  const occurrences = occurrencesInPeriod(frequency, period, weekday != null ? Number(weekday) : null);
  const creatingFixed = !isEdit && fixed;

  const title = isEdit
    ? `Editar ${isIncome ? "ingreso" : "gasto"}${isFixedEntry ? " fijo" : ""}`
    : `Nuevo ${isIncome ? "ingreso" : "gasto"}`;

  function save() {
    if (!name.trim()) return action.setError("Ponele un nombre");
    if (!(parsed > 0)) return action.setError("Ingresá un monto mayor a cero");

    const common = {
      name: name.trim(),
      amount: parsed,
      currency,
      categoryId,
      ...(isIncome ? { targetCategoryId: targetCategoryId || null } : {}),
    };

    if (isEdit) {
      return action.run(
        () => api("PATCH", `/api/plan/entries/${entry.id}`, {
          ...common,
          ...(isFixedEntry
            ? { applyToRule, ...(applyToRule ? { frequency, weekday: weekday != null ? Number(weekday) : null } : {}) }
            : { date: date || null }),
        }),
        onClose,
      );
    }

    return action.run(
      () => api("POST", "/api/plan/entries", {
        period,
        kind,
        ...common,
        ...(fixed
          ? { fixed: { frequency, weekday: weekday != null ? Number(weekday) : null } }
          : { date: date || null }),
      }),
      onClose,
    );
  }

  function remove(scope?: "rule") {
    return action.run(
      () => api("DELETE", `/api/plan/entries/${entry!.id}${scope ? "?scope=rule" : ""}`),
      onClose,
    );
  }

  const frequencyFields = (
    <>
      <Field label="¿Cada cuánto?">
        <Segmented options={FREQUENCIES} value={frequency} onChange={setFrequency} />
      </Field>
      {frequency === "WEEKLY" && (
        <Field label="¿Qué día de la semana?" hint="Sirve para contar si el mes tiene 4 o 5 semanas. Si no elegís, cuento 4.">
          <Chips options={WEEKDAYS} value={weekday} onChange={setWeekday} />
        </Field>
      )}
    </>
  );

  return (
    <Sheet title={title} onClose={onClose}>
      {!isEdit && (
        <Segmented
          options={[
            { value: "variable", label: "Solo este mes" },
            { value: "fixed", label: "Fijo (se repite)" },
          ]}
          value={fixed ? "fixed" : "variable"}
          onChange={(v) => setFixed(v === "fixed")}
        />
      )}

      <Field
        label={
          creatingFixed
            ? `Monto ${FREQUENCY_UNIT[frequency]}`
            : isFixedEntry
              ? `Monto de ${periodLabel(period)}`
              : "Monto"
        }
      >
        <div className="space-y-2">
          <MoneyInput value={amount} onChange={setAmount} currency={currency} large autoFocus={!isEdit} ariaLabel="Monto" />
          <Segmented options={CURRENCIES} value={currency} onChange={setCurrency} />
        </div>
      </Field>

      <Field label="Nombre">
        <TextInput
          aria-label="Nombre"
          placeholder={isIncome ? "Ej: Sueldo" : fixed ? "Ej: Alquiler" : "Ej: Supermercado"}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <Field label="Categoría">
        <Chips
          options={ownCategories.map((c) => ({ id: c.id, label: c.name }))}
          value={categoryId}
          onChange={setCategoryId}
        />
      </Field>

      {creatingFixed && (
        <>
          {frequencyFields}
          {parsed > 0 && frequency !== "MONTHLY" && (
            <p className="text-xs rounded-xl px-3 py-2" style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent)" }}>
              En {periodLabel(period)}: {occurrences} × {fmtMoney(parsed, currency)} ={" "}
              <strong>{fmtMoney(round2(parsed * occurrences), currency)}</strong>
            </p>
          )}
        </>
      )}

      {isIncome && (
        <Field
          label="¿A dónde va esta plata?"
          hint="Si la destinás a algo puntual, aparece marcada en esa línea del presupuesto."
        >
          <NativeSelect value={targetCategoryId} onChange={setTargetCategoryId} ariaLabel="Destino">
            <option value="">Al presupuesto general</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </NativeSelect>
        </Field>
      )}

      {!fixed && (
        <Field label="Fecha (opcional)">
          <TextInput type="date" aria-label="Fecha" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      )}

      {isFixedEntry && (
        <div className="space-y-3 rounded-xl p-3" style={{ backgroundColor: "var(--bg-elevated)" }}>
          <Switch
            checked={applyToRule}
            onChange={setApplyToRule}
            label="Usar estos datos también en los próximos meses"
          />
          {applyToRule ? frequencyFields : (
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              {rule ? `${FREQUENCY_LABEL[rule.frequency]} · ` : ""}El cambio queda solo en {periodLabel(period)}.
            </p>
          )}
        </div>
      )}

      <ErrorText error={action.error} />
      <PrimaryButton onClick={save} busy={action.busy}>
        {isEdit ? "Guardar cambios" : fixed ? "Agregar fijo" : `Agregar ${isIncome ? "ingreso" : "gasto"}`}
      </PrimaryButton>

      {isEdit && !confirmDelete && (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="w-full text-xs font-semibold py-1"
          style={{ color: "var(--accent-red)" }}
        >
          Eliminar
        </button>
      )}
      {isEdit && confirmDelete && (
        <div className="flex gap-2">
          <SecondaryButton onClick={() => setConfirmDelete(false)}>Cancelar</SecondaryButton>
          <SecondaryButton tone="danger" onClick={() => remove()} disabled={action.busy}>
            {isFixedEntry ? "Quitar de este mes" : "Sí, eliminar"}
          </SecondaryButton>
          {isFixedEntry && (
            <SecondaryButton tone="danger" onClick={() => remove("rule")} disabled={action.busy}>
              No se repite más
            </SecondaryButton>
          )}
        </div>
      )}
    </Sheet>
  );
}
