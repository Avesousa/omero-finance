import { useState } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Chip, HStack, Surface, Text, TextField, VStack } from "../../components/atoms";
import { FormField } from "../../components/molecules";
import { ApiError } from "../../../lib/api";
import { useSession } from "../../../lib/session";
import type { FinanceRole } from "../../../lib/types";
import { isFinancePaletteKey, DEFAULT_SHARED_COLOR, type FinancePaletteKey } from "../../design-system/tokens/financeColors";
import { useActiveFinance } from "../../providers/ActiveFinanceProvider";
import { addMember, fetchMembers, financeKeys, removeMember, setMemberRole, updateFinance } from "./api";
import { ColorPicker } from "./ColorPicker";
import { FinanceFormShell, leaveFinanceForm } from "./FinanceFormShell";

const ROLES: FinanceRole[] = ["ADMIN", "EDITOR", "VIEWER"];
const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.message ? e.message : fallback);

/** Detalle de un Hogar: nombre y color (solo Administrador), miembros, agregar por correo, cambiar rol, quitar o salirse. */
export function FinanceDetailScreen() {
  const { t } = useTranslation("finances");
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const qc = useQueryClient();
  const { finances, refresh } = useActiveFinance();
  const finance = finances.find((f) => f.id === id) ?? null;
  const isAdmin = finance?.role === "ADMIN";

  const [name, setName] = useState(finance?.name ?? "");
  const [color, setColor] = useState<FinancePaletteKey>(isFinancePaletteKey(finance?.color) ? finance.color : DEFAULT_SHARED_COLOR);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<FinanceRole>("EDITOR");
  const [error, setError] = useState<string | null>(null);

  const members = useQuery({ queryKey: financeKeys.members(id), queryFn: () => fetchMembers(id), enabled: !!id });
  const reload = async () => {
    await qc.invalidateQueries({ queryKey: financeKeys.members(id) });
    await refresh();
  };

  const save = useMutation({
    mutationFn: () => updateFinance(id, { name: name.trim(), color }),
    onSuccess: reload,
    onError: (e) => setError(errText(e, t("errorGeneric"))),
  });
  const add = useMutation({
    mutationFn: () => addMember(id, email.trim(), role),
    onSuccess: async () => {
      setEmail("");
      await reload();
    },
    onError: (e) => setError(errText(e, t("errorGeneric"))),
  });
  const changeRole = useMutation({
    mutationFn: (v: { userId: string; role: FinanceRole }) => setMemberRole(id, v.userId, v.role),
    onSuccess: reload,
    onError: (e) => setError(errText(e, t("errorGeneric"))),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => removeMember(id, userId),
    onSuccess: async (_r, userId) => {
      await reload();
      if (userId === user?.id) leaveFinanceForm();
    },
    onError: (e) => setError(errText(e, t("errorGeneric"))),
  });

  const confirmRemove = (userId: string, memberName: string) => {
    const self = userId === user?.id;
    Alert.alert(
      self ? t("members.leaveConfirm", { finance: finance?.name ?? "" }) : t("members.removeConfirm", { name: memberName, finance: finance?.name ?? "" }),
      undefined,
      [
        { text: t("members.cancel"), style: "cancel" },
        { text: self ? t("members.leave") : t("members.remove"), style: "destructive", onPress: () => remove.mutate(userId) },
      ],
    );
  };

  const list = members.data ?? [];
  const onlyOwner = list.length <= 1;

  return (
    <FinanceFormShell title={finance?.name ?? t("detail.title")}>
      {isAdmin ? (
        <VStack gap={4}>
          <FormField label={t("detail.nameLabel")} error={error}>
            <TextField testID="detail-name" accessibilityLabel={t("detail.nameLabel")} value={name} onChangeText={setName} maxLength={60} />
          </FormField>
          {finance?.kind === "SHARED" ? (
            <FormField label={t("detail.colorLabel")}>
              <ColorPicker value={color} onChange={setColor} disabled={save.isPending} />
            </FormField>
          ) : (
            <Text variant="secondary" tone="inkMuted">{t("detail.personalNote")}</Text>
          )}
          <Button testID="detail-save" label={t("detail.save")} variant="secondary" busy={save.isPending} disabled={!name.trim()} onPress={() => { setError(null); save.mutate(); }} />
        </VStack>
      ) : null}

      <VStack gap={3}>
        <Text variant="cardTitle">{t("members.title")}</Text>
        {onlyOwner && !members.isPending ? <Text variant="secondary" tone="inkMuted">{t("members.empty")}</Text> : null}
        {list.map((m) => {
          const self = m.userId === user?.id;
          return (
            <Surface key={m.userId} testID={`member-${m.userId}`}>
              <VStack gap={2}>
                <Text variant="bodyStrong" numberOfLines={1}>{m.name}{self ? " (vos)" : ""}</Text>
                <Text variant="secondary" tone="inkMuted" numberOfLines={1}>{m.email}</Text>
                {m.isOwner ? (
                  <Text variant="secondaryStrong">{t("members.owner")} · {t(`role.${m.role}`)}</Text>
                ) : isAdmin ? (
                  <HStack gap={2} wrap>
                    {ROLES.map((r) => (
                      <Chip key={r} label={t(`role.${r}`)} active={m.role === r} disabled={changeRole.isPending} onPress={() => m.role !== r && changeRole.mutate({ userId: m.userId, role: r })} />
                    ))}
                  </HStack>
                ) : (
                  <Text variant="secondaryStrong">{t(`role.${m.role}`)}</Text>
                )}
                {!m.isOwner && (isAdmin || self) ? (
                  <Button variant="text" label={self ? t("members.leave") : t("members.remove")} onPress={() => confirmRemove(m.userId, m.name)} />
                ) : null}
              </VStack>
            </Surface>
          );
        })}
      </VStack>

      {isAdmin && finance?.kind === "SHARED" ? (
        <VStack gap={3}>
          <Text variant="cardTitle">{t("members.add")}</Text>
          <FormField label={t("members.emailLabel")}>
            <TextField
              testID="member-email"
              accessibilityLabel={t("members.emailLabel")}
              placeholder={t("members.emailPlaceholder")}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </FormField>
          <FormField label={t("members.roleLabel")}>
            <HStack gap={2} wrap>
              {ROLES.map((r) => (
                <Chip key={r} label={t(`role.${r}`)} active={role === r} onPress={() => setRole(r)} />
              ))}
            </HStack>
          </FormField>
          <Button testID="member-add" label={t("members.addSubmit")} busy={add.isPending} disabled={!email.trim()} onPress={() => { setError(null); add.mutate(); }} />
        </VStack>
      ) : null}
    </FinanceFormShell>
  );
}
