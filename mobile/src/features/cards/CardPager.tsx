import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactElement } from "react";
import { FlatList, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useTheme } from "../../design-system";

/** Puntos de posición con estado propio: se mueven con el dedo sin volver a dibujar la pantalla entera. */
const Dots = forwardRef<{ set: (i: number) => void }, { count: number; initial: number }>(function Dots({ count, initial }, ref) {
  const { colors, space } = useTheme();
  const [active, setActive] = useState(initial);
  useImperativeHandle(ref, () => ({ set: setActive }), []);
  if (count < 2) return null;
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: space[2], marginTop: space[3] }}>
      {Array.from({ length: count }, (_, i) => <View key={i} style={{ width: i === active ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === active ? colors.primary : colors.border }} />)}
    </View>
  );
});

/**
 * Carrusel horizontal paginado. `peek` deja asomar un borde de la siguiente; `index` se mueve solo si cambia desde afuera.
 * Con `dots`, dibuja los puntos de posición y los actualiza mientras se desliza (no al terminar).
 */
export function CardPager<T>({ data, index, onIndexChange, renderItem, peek = 0, keyOf, dots = false }: { data: T[]; index: number; onIndexChange: (i: number) => void; renderItem: (item: T, i: number, width: number) => ReactElement; peek?: number; keyOf: (item: T) => string; dots?: boolean }) {
  const { space } = useTheme();
  const { width } = useWindowDimensions();
  const itemWidth = width - space[5] * 2 - peek;
  const interval = itemWidth + space[3];
  const ref = useRef<FlatList<T>>(null);
  const dotsRef = useRef<{ set: (i: number) => void }>(null);
  const shown = useRef(index);
  const live = useRef(index);
  useEffect(() => {
    if (shown.current !== index && data.length) { shown.current = index; live.current = index; dotsRef.current?.set(index); ref.current?.scrollToIndex({ index: Math.min(index, data.length - 1), animated: true }); }
  }, [index, data.length]);
  const indexAt = useCallback((x: number) => Math.max(0, Math.min(data.length - 1, Math.round(x / interval))), [data.length, interval]);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = indexAt(e.nativeEvent.contentOffset.x);
    if (i !== live.current) { live.current = i; dotsRef.current?.set(i); }
  };
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = indexAt(e.nativeEvent.contentOffset.x);
    shown.current = i; live.current = i; dotsRef.current?.set(i);
    if (i !== index) onIndexChange(i);
  };
  return (
    <View>
      <View style={{ marginHorizontal: -space[5] }}>
        <FlatList
          ref={ref}
          horizontal
          data={data}
          keyExtractor={keyOf}
          initialScrollIndex={Math.min(index, Math.max(0, data.length - 1))}
          getItemLayout={(_, i) => ({ length: interval, offset: interval * i, index: i })}
          showsHorizontalScrollIndicator={false}
          snapToInterval={interval}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScroll}
          onMomentumScrollEnd={onEnd}
          contentContainerStyle={{ paddingHorizontal: space[5], gap: space[3] }}
          renderItem={({ item, index: i }) => renderItem(item, i, itemWidth)}
        />
      </View>
      {dots ? <Dots ref={dotsRef} count={data.length} initial={index} /> : null}
    </View>
  );
}
