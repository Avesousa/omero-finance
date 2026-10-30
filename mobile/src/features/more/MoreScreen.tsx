import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, Icon, Pill, Surface, Text, VStack } from "../../components/atoms";
import { ListRow, MascotAvatar, SectionHeader, SegmentedToggle } from "../../components/molecules";
import { ScreenTemplate } from "../../components/templates";
import { DATA_SOURCE } from "../../data";
import { THEME_MODES, useTheme } from "../../design-system";
import { SUPPORTED_ENABLED, SUPPORTED_LANGUAGES, currentLanguage } from "../../i18n";
import { listMascots, useMascot, useMascotStory } from "../../mascots";
import { useSession } from "../../../lib/session";

/** Más: modo (Tranqui/Atrevido), mascota, idioma y —en modo api— cuenta y cierre de sesión. */
export function MoreScreen() {
  const { t } = useTranslation("more");
  const { t: tc } = useTranslation("common");
  const { mode, setMode, space } = useTheme();
  const { mascotId, setMascotId } = useMascot();
  const story = useMascotStory();
  const { user, signOut } = useSession();
  const active = currentLanguage();

  return (
    <ScreenTemplate>
      <Text variant="screenTitle" accessibilityRole="header">
        {t("title")}
      </Text>

      <VStack gap={2}>
        <SectionHeader title={t("mode.title")} />
        <Surface>
          <VStack gap={3}>
            <SegmentedToggle
              testID="mode-toggle"
              accessibilityLabel={t("mode.title")}
              value={mode}
              onChange={setMode}
              options={THEME_MODES.map((m) => ({ value: m, label: t(`mode.${m}`) }))}
            />
            <Text variant="secondary" tone="inkMuted">
              {t("mode.hint")}
            </Text>
          </VStack>
        </Surface>
      </VStack>

      <VStack gap={2}>
        <SectionHeader title={t("mascot.title")} />
        <Surface>
          <VStack gap={3}>
            <View testID="mascot-picker" accessibilityRole="radiogroup" accessibilityLabel={t("mascot.title")} style={{ flexDirection: "row", gap: space[2] }}>
              {listMascots().map((m) => {
                const selected = m.id === mascotId;
                return <MascotOption key={m.id} id={m.id} selected={selected} onPress={() => setMascotId(m.id)} />;
              })}
            </View>
            <Text variant="body" tone="inkMuted">
              {story.oneLiner}
            </Text>
          </VStack>
        </Surface>
      </VStack>

      <VStack gap={2}>
        <SectionHeader title={t("language.title")} />
        <Surface style={{ paddingVertical: space[2] }}>
          {SUPPORTED_LANGUAGES.map((lng) => {
            const enabled = SUPPORTED_ENABLED.includes(lng);
            return (
              <ListRow
                key={lng}
                testID={`language-${lng}`}
                title={t(`language.${lng}`)}
                right={
                  enabled ? (
                    lng === active ? <Icon name="checkmark-circle" tone="positiveInk" /> : null
                  ) : (
                    <Pill label={t("language.comingSoon")} />
                  )
                }
              />
            );
          })}
        </Surface>
      </VStack>

      {DATA_SOURCE === "api" ? (
        <VStack gap={2}>
          <SectionHeader title={t("account.title")} />
          <Surface>
            <VStack gap={3}>
              {user ? (
                <View style={{ gap: 2 }}>
                  <Text variant="bodyStrong">{user.name}</Text>
                  <Text variant="secondary" tone="inkMuted">
                    {user.email}
                  </Text>
                </View>
              ) : null}
              <Button testID="logout" variant="secondary" label={tc("actions.logout")} onPress={() => void signOut()} />
            </VStack>
          </Surface>
        </VStack>
      ) : null}
    </ScreenTemplate>
  );
}

function MascotOption({ id, selected, onPress }: { id: Parameters<typeof useMascotStory>[0]; selected: boolean; onPress: () => void }) {
  const { t } = useTranslation("more");
  const story = useMascotStory(id);
  const { colors, radius, space, sizes } = useTheme();
  return (
    <Pressable
      testID={`mascot-${id}`}
      accessibilityRole="radio"
      accessibilityLabel={t("mascot.select", { name: `${story.name}, ${story.species}` })}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: sizes.touch,
        alignItems: "center",
        gap: space[2],
        paddingVertical: space[3],
        borderRadius: radius.card,
        backgroundColor: selected ? colors.accent : colors.bg,
        borderWidth: sizes.hairline,
        borderColor: selected ? colors.accent : colors.border,
      }}
    >
      <MascotAvatar size={sizes.bubbleAvatar} id={id} mood={selected ? "feliz" : "calma"} />
      <Text variant="secondaryStrong" tone={selected ? "onAccent" : "ink"} numberOfLines={1}>
        {story.name}
      </Text>
    </Pressable>
  );
}
