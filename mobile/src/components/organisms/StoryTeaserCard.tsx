import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { formatPercent } from "../../i18n/format";
import { useMascotStory } from "../../mascots/useMascotLine";
import { HStack, ProgressBar, Surface, Text, VStack } from "../atoms";
import { MascotAvatar } from "../molecules";
import { useTheme } from "../../design-system";

export interface StoryTeaserCardProps {
  /** Capítulo en curso (1..3). */
  chapter: number;
  /** Avance del capítulo, 0..1. */
  progress: number;
  onPress?: () => void;
}

/** Teaser de la historia de la mascota elegida: "Capítulo N · <título>", barra de avance y porcentaje. */
export function StoryTeaserCard({ chapter, progress, onPress }: StoryTeaserCardProps) {
  const { t } = useTranslation("home");
  const { sizes, space } = useTheme();
  const story = useMascotStory();
  const percent = formatPercent(progress);
  const title = t("story.teaser", { n: chapter, title: story.chapterTitle(chapter) });
  const card = (
    <Surface testID="story-card">
      <HStack gap={3}>
        <MascotAvatar size={sizes.headerAvatar} mood="feliz" />
        <VStack gap={2} style={{ flex: 1, paddingVertical: space[1] }}>
          <Text variant="secondarySemi" tone="inkMuted">
            {t("story.teaserLabel", { mascot: story.name })}
          </Text>
          <Text variant="bodyStrong">{title}</Text>
          <HStack gap={3}>
            <View style={{ flex: 1 }}>
              <ProgressBar tone="positive" value={progress} accessibilityLabel={t("story.progress", { percent })} />
            </View>
            <Text variant="secondaryStrong">{percent}</Text>
          </HStack>
        </VStack>
      </HStack>
    </Surface>
  );
  if (!onPress) return card;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${t("story.progress", { percent })}`} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {card}
    </Pressable>
  );
}
