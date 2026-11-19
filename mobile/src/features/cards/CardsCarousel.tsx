import { useEffect, useRef, useState } from "react";
import { forwardRef, useImperativeHandle } from "react";
import { Animated, FlatList, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { CardVisual } from "../../components/organisms";
import { useTheme } from "../../design-system";

export interface CarouselSlide {
  key: string;
  title: string;
  caption: string;
  amount: string;
  bank?: string | null;
  network?: string | null;
  holder?: string | null;
  aggregate?: boolean;
  /** Color de fondo de la vista que suma todas. */
  color?: string;
}

/** Carrusel horizontal de tarjetas (la primera suele ser «Todas»): desliza para cambiar, con puntos de posición. */
export function CardsCarousel({ slides, index, onIndexChange, onScrollingChange }: { slides: CarouselSlide[]; index: number; onIndexChange: (i: number) => void; /** true desde que el dedo toca el carrusel hasta que se asienta en una tarjeta. */ onScrollingChange?: (scrolling: boolean) => void }) {
  const { colors, space } = useTheme();
  const { width } = useWindowDimensions();
  const itemWidth = width - space[5] * 2;
  const interval = itemWidth + space[3];
  const ref = useRef<FlatList<CarouselSlide>>(null);
  const shown = useRef(index);
  // Si el índice cambia desde afuera (p. ej. tocar una tarjeta de la lista), el carrusel se mueve solo.
  useEffect(() => {
    if (shown.current !== index) { shown.current = index; ref.current?.scrollToIndex({ index, animated: true }); }
  }, [index]);
  const dots = useRef<{ set: (i: number) => void }>(null);
  const liveIdx = useRef(index);
  useEffect(() => { liveIdx.current = index; dots.current?.set(index); }, [index]);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(slides.length - 1, Math.round(e.nativeEvent.contentOffset.x / interval)));
    if (i !== liveIdx.current) { liveIdx.current = i; dots.current?.set(i); }
  };
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start(); }, [fade]);
  const momentum = useRef(false);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    momentum.current = false;
    onScrollingChange?.(false);
    const i = Math.max(0, Math.min(slides.length - 1, Math.round(e.nativeEvent.contentOffset.x / interval)));
    shown.current = i;
    if (i !== index) onIndexChange(i);
  };
  return (
    <Animated.View style={{ marginHorizontal: -space[5], gap: space[3], opacity: fade }}>
      <FlatList
        ref={ref}
        testID="cards-carousel"
        horizontal
        initialScrollIndex={Math.min(index, slides.length - 1)}
        getItemLayout={(_, i) => ({ length: interval, offset: interval * i, index: i })}
        data={slides}
        keyExtractor={(s) => s.key}
        showsHorizontalScrollIndicator={false}
        snapToInterval={interval}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={() => { if (settle.current) clearTimeout(settle.current); onScrollingChange?.(true); }}
        onScrollEndDrag={(e) => {
          // Si soltó sin inercia, no hay «momentum end»: se da por asentado enseguida.
          const ev = e.nativeEvent;
          settle.current = setTimeout(() => { if (!momentum.current) onEnd({ nativeEvent: ev } as NativeSyntheticEvent<NativeScrollEvent>); }, 90);
        }}
        onMomentumScrollBegin={() => { momentum.current = true; if (settle.current) clearTimeout(settle.current); }}
        onMomentumScrollEnd={onEnd}
        contentContainerStyle={{ paddingHorizontal: space[5], gap: space[3] }}
        renderItem={({ item }) => <CardVisual width={itemWidth} title={item.title} caption={item.caption} amount={item.amount} bank={item.bank} network={item.network} holder={item.holder} aggregate={item.aggregate} color={item.color} />}
      />
      <PositionDots ref={dots} count={slides.length} initial={index} />
    </Animated.View>
  );
}

/** Puntos de posición con estado propio: cambian mientras se desliza sin volver a dibujar el carrusel ni la hoja. */
const PositionDots = forwardRef<{ set: (i: number) => void }, { count: number; initial: number }>(function PositionDots({ count, initial }, ref) {
  const { colors, space } = useTheme();
  const [active, setActive] = useState(initial);
  useImperativeHandle(ref, () => ({ set: setActive }), []);
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: space[2] }}>
      {Array.from({ length: count }, (_, i) => <View key={i} style={{ width: i === active ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === active ? colors.primary : colors.border }} />)}
    </View>
  );
});
