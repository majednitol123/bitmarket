import React, { useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from "react-native";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "styled-components/native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import type { ThemeType } from "../../styles/theme";

// ─── Exchange Icon ───
const ExchangeOutline: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M16 3L20 7L16 11" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M4 7H20" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    <Path d="M8 21L4 17L8 13" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M20 17H4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

const ExchangeFilled: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M16 3L20 7L16 11" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M4 7H20" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    <Path d="M8 21L4 17L8 13" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M20 17H4" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
  </Svg>
);

// ─── Market Icon ───
const MarketOutline: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 3V21H21" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M7 14L11 10L15 14L21 8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M17 8H21V12" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const MarketFilled: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 3V21H21" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M7 14L11 10L15 14L21 8" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M17 8H21V12" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M7 14L11 10L15 14L21 8V21H7V14Z" fill={color} opacity={0.12} />
  </Svg>
);

// ─── Portfolio Icon ───
const PortfolioOutline: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="2" y="6" width="20" height="14" rx="2" stroke={color} strokeWidth={1.8} />
    <Path d="M16 6V4C16 2.89543 15.1046 2 14 2H10C8.89543 2 8 2.89543 8 4V6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M12 11V15" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    <Path d="M2 12H22" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

const PortfolioFilled: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="2" y="6" width="20" height="14" rx="2" fill={color} opacity={0.15} stroke={color} strokeWidth={2.2} />
    <Path d="M16 6V4C16 2.89543 15.1046 2 14 2H10C8.89543 2 8 2.89543 8 4V6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M12 11V15" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    <Path d="M2 12H22" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
  </Svg>
);

// ─── Settings Icon (Classic Gear — matches original) ───
const SettingsOutline: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path
      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    />
  </Svg>
);

const SettingsFilled: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="3" fill={color} stroke={color} strokeWidth={2} />
    <Path
      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
      fill={color} opacity={0.15} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    />
  </Svg>
);

// ─── Tab Configuration ───
type TabKey = "index" | "markets" | "portfolio" | "settings";

const TAB_CONFIG: Record<
  TabKey,
  {
    label: string;
    OutlineIcon: React.FC<{ size: number; color: string }>;
    FilledIcon: React.FC<{ size: number; color: string }>;
  }
> = {
  index: { label: "Exchange", OutlineIcon: ExchangeOutline, FilledIcon: ExchangeFilled },
  markets: { label: "Market", OutlineIcon: MarketOutline, FilledIcon: MarketFilled },
  portfolio: { label: "Portfolio", OutlineIcon: PortfolioOutline, FilledIcon: PortfolioFilled },
  settings: { label: "Settings", OutlineIcon: SettingsOutline, FilledIcon: SettingsFilled },
};

// ─── Animated Tab Item ───
interface TabItemProps {
  routeName: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  isDark: boolean;
}

const TabItem: React.FC<TabItemProps> = ({
  routeName,
  isFocused,
  onPress,
  onLongPress,
  isDark,
}) => {
  const config = TAB_CONFIG[routeName as TabKey];
  if (!config) return null;

  const { label, OutlineIcon, FilledIcon } = config;

  const scale = useSharedValue(1);
  const activeOpacity = useSharedValue(isFocused ? 1 : 0);
  const inactiveOpacity = useSharedValue(isFocused ? 0 : 1);

  useEffect(() => {
    if (isFocused) {
      scale.value = withSpring(1.06, { damping: 20, stiffness: 240, mass: 0.4 });
      activeOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
      inactiveOpacity.value = withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) });
    } else {
      scale.value = withSpring(1, { damping: 20, stiffness: 240, mass: 0.4 });
      activeOpacity.value = withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) });
      inactiveOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
    }
  }, [isFocused]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const filledStyle = useAnimatedStyle(() => ({
    opacity: activeOpacity.value,
  }));

  const outlinedStyle = useAnimatedStyle(() => ({
    opacity: inactiveOpacity.value,
  }));

  const activeColor = isDark ? "#A78BFA" : "#7C3AED";
  const inactiveColor = isDark ? "rgba(148, 163, 184, 0.5)" : "rgba(100, 116, 139, 0.45)";
  const activeBg = isDark ? "rgba(139, 92, 246, 0.14)" : "rgba(139, 92, 246, 0.10)";

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          styles.iconCircle,
          containerStyle,
          { backgroundColor: isFocused ? activeBg : "transparent" },
        ]}
      >
        {/* Outlined (inactive) */}
        <Animated.View style={[styles.iconLayer, outlinedStyle]}>
          <OutlineIcon size={21} color={inactiveColor} />
        </Animated.View>
        {/* Filled (active) */}
        <Animated.View style={[styles.iconLayer, filledStyle]}>
          <FilledIcon size={21} color={activeColor} />
        </Animated.View>
      </Animated.View>
      <Text
        style={[
          styles.label,
          {
            color: isFocused
              ? (isDark ? "#A78BFA" : "#7C3AED")
              : (isDark ? "rgba(148, 163, 184, 0.55)" : "rgba(100, 116, 139, 0.55)"),
            fontWeight: isFocused ? "700" : "500",
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// ─── Floating Tab Bar ───
const FloatingTabBar: React.FC<any> = ({
  state,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const isDark = theme.colors.background === "#0B0E17";
  const bottomOffset = Math.max(insets.bottom, 16) + 12;

  return (
    <View
      style={[styles.outerContainer, { bottom: bottomOffset }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.pillContainer,
          {
            backgroundColor: isDark
              ? "rgba(15, 18, 32, 0.96)"
              : "rgba(255, 255, 255, 0.96)",
            borderColor: isDark
              ? "rgba(139, 92, 246, 0.10)"
              : "rgba(200, 200, 220, 0.25)",
            ...Platform.select({
              ios: {
                shadowColor: isDark ? "#000" : "rgba(80, 80, 110, 0.2)",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isDark ? 0.6 : 0.18,
                shadowRadius: 24,
              },
              android: {
                elevation: 18,
              },
            }),
          },
        ]}
      >
        {/* Tabs */}
        <View style={styles.tabRow}>
          {state.routes.map((route: any, index: number) => {
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({ type: "tabLongPress", target: route.key });
            };

            if (!TAB_CONFIG[route.name as TabKey]) return null;

            return (
              <TabItem
                key={route.key}
                routeName={route.name}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                isDark={isDark}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 100,
  },
  pillContainer: {
    width: "100%",
    borderRadius: 26,
    borderWidth: 1,
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.2,
    marginTop: 2,
  },
});

export default FloatingTabBar;
