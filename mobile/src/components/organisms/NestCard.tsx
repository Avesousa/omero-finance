import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatPercent } from "../../i18n/format";
import { useMascot } from "../../mascots/MascotProvider";
import { getMascot } from "../../mascots/registry";
import { useMascotNest, useMascotStory } from "../../mascots/useMascotLine";
import type { MascotId, NestChapter } from "../../mascots/types";
import { Pill, ProgressBar, Surface, Text, VStack } from "../atoms";

export interface NestCardProps {
  /** Capítulo del nido (1..3) y avance dentro del capítulo (0..1). */
  chapter: NestChapter;
  progress: number;
  /** Qué parte de lo que tenés ya es tuyo, 0..1. */
  equity: number;
  /** Por defecto, la mascota elegida. */
  mascotId?: MascotId;
  testID?: string;
}

const SCENE_RATIO = 200 / 320;

/** "Tu nido": la escena de la mascota elegida según el capítulo, su frase y el avance. */
export function NestCard({ chapter, progress, equity, mascotId, testID = "nest-card" }: NestCardProps) {
  const { t } = useTranslation("wealth");
  const { mode, space } = useTheme();
  const { mascotId: chosen } = useMascot();
  const id = mascotId ?? chosen;
  const { Nest } = getMascot(id);
  const nest = useMascotNest(id);
  const story = useMascotStory(id);
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.floor(e.nativeEvent.layout.width));
  const title = story.chapterTitle(chapter);
  const percent = formatPercent(progress);

  return (
    <Surface testID={testID}>
      <VStack gap={3}>
        <Text variant="cardTitle">{nest.name}</Text>
        <Pill tone={mode === "atrevido" ? "accent" : "neutral"} label={t("nest.chapter", { n: chapter, title })} />
        <View
          onLayout={onLayout}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${t("nest.scene", { name: nest.name, n: chapter })}. ${nest.caption(chapter)}`}
          style={{ width: "100%", aspectRatio: 1 / SCENE_RATIO }}
        >
          {width > 0 ? <Nest chapter={chapter} progress={progress} mode={mode} size={width} /> : null}
        </View>
        <Text variant="body">{nest.caption(chapter)}</Text>
        <VStack gap={2} style={{ paddingTop: space[1] }}>
          <ProgressBar tone="positive" value={progress} accessibilityLabel={t("nest.chapterProgress", { percent })} />
          <Text variant="secondary" tone="inkMuted">
            {t("nest.chapterProgress", { percent })}
          </Text>
        </VStack>
        <Text variant="bodyStrong" tone="positiveInk">
          {t("nest.equity", { percent: formatPercent(equity) })}
        </Text>
      </VStack>
    </Surface>
  );
}
