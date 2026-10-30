import { View, type ViewProps, type ViewStyle } from "react-native";
import { useTheme, type SpaceKey } from "../../design-system";

export interface StackProps extends ViewProps {
  /** Separación entre hijos (token de espaciado). */
  gap?: SpaceKey;
  align?: ViewStyle["alignItems"];
  justify?: ViewStyle["justifyContent"];
  wrap?: boolean;
}

function Stack({ direction, gap, align, justify, wrap, style, ...rest }: StackProps & { direction: "row" | "column" }) {
  const { space } = useTheme();
  return (
    <View
      {...rest}
      style={[
        { flexDirection: direction, gap: gap ? space[gap] : undefined, alignItems: align, justifyContent: justify, flexWrap: wrap ? "wrap" : undefined },
        style,
      ]}
    />
  );
}

/** Columna con `gap` del DS. */
export function VStack(props: StackProps) {
  return <Stack direction="column" {...props} />;
}

/** Fila con `gap` del DS (centrada verticalmente por defecto). */
export function HStack({ align = "center", ...props }: StackProps) {
  return <Stack direction="row" align={align} {...props} />;
}

/** Espacio vacío: `size` fijo (token) o, sin `size`, ocupa el resto (flex 1). */
export function Spacer({ size }: { size?: SpaceKey }) {
  const { space } = useTheme();
  return <View style={size ? { width: space[size], height: space[size] } : { flex: 1 }} />;
}
