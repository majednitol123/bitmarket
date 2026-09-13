import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
  Animated,
  ActivityIndicator,
} from "react-native";
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
  G,
  Rect,
} from "react-native-svg";
import { useTheme } from "styled-components/native";
import type { ThemeType } from "../../styles/theme";

export type Timeframe = "1D" | "1W" | "1M" | "1Y" | "ALL";
export type ChartStyleMode = "line" | "candles";

export interface CandlePoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TimeframeData {
  points: CandlePoint[];
  pnl: string;
  pnlPercent: string;
  isPositive: boolean;
  high: string;
  low: string;
  volume24h: string;
}

export const TIMEFRAME_DATA: Record<Timeframe, TimeframeData> = {
  "1D": {
    pnl: "+$482.10",
    pnlPercent: "+3.36%",
    isPositive: true,
    high: "$14,892.40",
    low: "$14,310.00",
    volume24h: "$1.82M",
    points: [
      { time: "00:00", open: 14380, high: 14410, low: 14340, close: 14360.5, volume: 45 },
      { time: "01:00", open: 14360, high: 14375, low: 14310, close: 14330.0, volume: 30 },
      { time: "02:00", open: 14330, high: 14350, low: 14310, close: 14320.0, volume: 22 },
      { time: "03:00", open: 14320, high: 14370, low: 14315, close: 14355.8, volume: 18 },
      { time: "04:00", open: 14355, high: 14405, low: 14340, close: 14390.2, volume: 35 },
      { time: "05:00", open: 14390, high: 14435, low: 14380, close: 14420.0, volume: 40 },
      { time: "06:00", open: 14420, high: 14465, low: 14410, close: 14450.0, volume: 60 },
      { time: "07:00", open: 14450, high: 14460, low: 14420, close: 14435.5, volume: 55 },
      { time: "08:00", open: 14435, high: 14445, low: 14395, close: 14410.8, volume: 75 },
      { time: "09:00", open: 14410, high: 14510, low: 14400, close: 14490.0, volume: 88 },
      { time: "10:00", open: 14490, high: 14600, low: 14480, close: 14580.4, volume: 95 },
      { time: "11:00", open: 14580, high: 14625, low: 14560, close: 14610.0, volume: 80 },
      { time: "12:00", open: 14610, high: 14660, low: 14590, close: 14640.0, volume: 110 },
      { time: "13:00", open: 14640, high: 14650, low: 14585, close: 14605.0, volume: 70 },
      { time: "14:00", open: 14605, high: 14620, low: 14570, close: 14590.2, volume: 65 },
      { time: "15:00", open: 14590, high: 14665, low: 14580, close: 14650.0, volume: 85 },
      { time: "16:00", open: 14650, high: 14725, low: 14640, close: 14710.6, volume: 92 },
      { time: "17:00", open: 14710, high: 14760, low: 14695, close: 14745.0, volume: 105 },
      { time: "18:00", open: 14745, high: 14795, low: 14730, close: 14780.0, volume: 115 },
      { time: "19:00", open: 14780, high: 14810, low: 14760, close: 14795.0, volume: 80 },
      { time: "20:00", open: 14795, high: 14825, low: 14780, close: 14810.3, volume: 90 },
      { time: "21:00", open: 14810, high: 14845, low: 14800, close: 14830.0, volume: 95 },
      { time: "Now", open: 14830, high: 14892, low: 14820, close: 14842.6, volume: 120 },
    ],
  },
  "1W": {
    pnl: "+$1,240.50",
    pnlPercent: "+9.12%",
    isPositive: true,
    high: "$14,920.00",
    low: "$13,580.00",
    volume24h: "$12.4M",
    points: [
      { time: "Mon 00:00", open: 13580, high: 13650, low: 13540, close: 13602.1, volume: 40 },
      { time: "Mon 12:00", open: 13602, high: 13740, low: 13590, close: 13710.0, volume: 55 },
      { time: "Tue 00:00", open: 13710, high: 13890, low: 13680, close: 13850.0, volume: 70 },
      { time: "Tue 12:00", open: 13850, high: 13870, low: 13750, close: 13790.0, volume: 60 },
      { time: "Wed 00:00", open: 13790, high: 13810, low: 13690, close: 13720.4, volume: 45 },
      { time: "Wed 12:00", open: 13720, high: 13940, low: 13700, close: 13910.0, volume: 80 },
      { time: "Thu 00:00", open: 13910, high: 14150, low: 13890, close: 14100.8, volume: 95 },
      { time: "Thu 12:00", open: 14100, high: 14250, low: 14060, close: 14220.0, volume: 85 },
      { time: "Fri 00:00", open: 14220, high: 14390, low: 14190, close: 14350.2, volume: 100 },
      { time: "Fri 12:00", open: 14350, high: 14510, low: 14320, close: 14480.0, volume: 110 },
      { time: "Sat 00:00", open: 14480, high: 14650, low: 14450, close: 14620.0, volume: 65 },
      { time: "Sat 12:00", open: 14620, high: 14740, low: 14590, close: 14710.0, volume: 75 },
      { time: "Sun 00:00", open: 14710, high: 14820, low: 14680, close: 14790.0, volume: 85 },
      { time: "Now", open: 14790, high: 14920, low: 14760, close: 14842.6, volume: 105 },
    ],
  },
  "1M": {
    pnl: "+$3,180.00",
    pnlPercent: "+27.24%",
    isPositive: true,
    high: "$14,950.00",
    low: "$11,540.00",
    volume24h: "$48.2M",
    points: [
      { time: "Day 1", open: 11540, high: 11720, low: 11480, close: 11662.6, volume: 30 },
      { time: "Day 5", open: 11662, high: 12150, low: 11600, close: 12100.0, volume: 50 },
      { time: "Day 10", open: 12100, high: 12520, low: 12050, close: 12450.0, volume: 75 },
      { time: "Day 15", open: 12450, high: 12490, low: 12120, close: 12180.5, volume: 60 },
      { time: "Day 20", open: 12180, high: 13150, low: 12100, close: 13100.0, volume: 90 },
      { time: "Day 25", open: 13100, high: 13890, low: 13050, close: 13820.0, volume: 110 },
      { time: "Day 28", open: 13820, high: 14520, low: 13780, close: 14450.0, volume: 100 },
      { time: "Now", open: 14450, high: 14950, low: 14400, close: 14842.6, volume: 125 },
    ],
  },
  "1Y": {
    pnl: "+$6,450.80",
    pnlPercent: "+76.80%",
    isPositive: true,
    high: "$15,200.00",
    low: "$8,250.00",
    volume24h: "$380M",
    points: [
      { time: "Jan", open: 8250, high: 8520, low: 8180, close: 8391.8, volume: 40 },
      { time: "Feb", open: 8391, high: 8900, low: 8320, close: 8850.0, volume: 55 },
      { time: "Mar", open: 8850, high: 9350, low: 8800, close: 9240.0, volume: 65 },
      { time: "Apr", open: 9240, high: 10100, low: 9180, close: 9980.0, volume: 70 },
      { time: "May", open: 9980, high: 10650, low: 9900, close: 10580.4, volume: 85 },
      { time: "Jun", open: 10580, high: 11050, low: 10500, close: 10920.0, volume: 80 },
      { time: "Jul", open: 10920, high: 11350, low: 10850, close: 11200.0, volume: 95 },
      { time: "Aug", open: 11200, high: 12100, low: 11150, close: 11950.0, volume: 105 },
      { time: "Sep", open: 11950, high: 12980, low: 11900, close: 12850.5, volume: 115 },
      { time: "Oct", open: 12850, high: 13500, low: 12780, close: 13400.0, volume: 100 },
      { time: "Nov", open: 13400, high: 14100, low: 13350, close: 13920.0, volume: 120 },
      { time: "Now", open: 13920, high: 15200, low: 13880, close: 14842.6, volume: 130 },
    ],
  },
  ALL: {
    pnl: "+$9,820.00",
    pnlPercent: "+195.40%",
    isPositive: true,
    high: "$16,400.00",
    low: "$4,800.00",
    volume24h: "$1.4B",
    points: [
      { time: "2022", open: 4800, high: 5200, low: 4650, close: 5022.6, volume: 30 },
      { time: "Q2 22", open: 5022, high: 5950, low: 4950, close: 5800.0, volume: 45 },
      { time: "Q4 22", open: 5800, high: 6980, low: 5700, close: 6800.0, volume: 60 },
      { time: "Q2 23", open: 6800, high: 8250, low: 6720, close: 8100.0, volume: 75 },
      { time: "Q4 23", open: 8100, high: 10100, low: 8050, close: 9950.4, volume: 90 },
      { time: "Q2 24", open: 9950, high: 11980, low: 9850, close: 11800.0, volume: 110 },
      { time: "Q4 24", open: 11800, high: 13800, low: 11700, close: 13600.5, volume: 125 },
      { time: "Now", open: 13600, high: 16400, low: 13500, close: 14842.6, volume: 140 },
    ],
  },
};

/**
 * Calculates Simple Moving Average (SMA)
 */
function calculateSMA(data: number[], windowSize: number): (number | null)[] {
  return data.map((_, idx) => {
    if (idx < windowSize - 1) return null;
    const slice = data.slice(idx - windowSize + 1, idx + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / windowSize;
  });
}

/**
 * Creates smooth Catmull-Rom cubic bezier path
 */
function buildSmoothPath(
  points: { x: number; y: number }[],
  bottomY: number
): { pathString: string; areaString: string; lastPoint: { x: number; y: number } } {
  if (points.length === 0) {
    return { pathString: "", areaString: "", lastPoint: { x: 0, y: 0 } };
  }
  if (points.length === 1) {
    const pt = points[0];
    return {
      pathString: `M ${pt.x} ${pt.y}`,
      areaString: `M ${pt.x} ${pt.y} L ${pt.x} ${bottomY} Z`,
      lastPoint: pt,
    };
  }

  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  const last = points[points.length - 1];
  const first = points[0];
  const area = `${d} L ${last.x.toFixed(1)},${bottomY} L ${first.x.toFixed(1)},${bottomY} Z`;

  return { pathString: d, areaString: area, lastPoint: last };
}

interface PortfolioChartProps {
  timeframe: Timeframe;
  data?: TimeframeData | null;
  isLoading?: boolean;
  onScrubChange?: (point: { time: string; value: number } | null) => void;
}

export const PortfolioChart: React.FC<PortfolioChartProps> = ({
  timeframe,
  data,
  isLoading,
  onScrubChange,
}) => {
  const theme = useTheme() as ThemeType;
  const [chartWidth, setChartWidth] = useState(330);
  const [chartMode, setChartMode] = useState<ChartStyleMode>("line");
  const [showMA7, setShowMA7] = useState(true);
  const [showMA25, setShowMA25] = useState(false);
  const [showVol, setShowVol] = useState(true);

  const chartHeight = 175;
  const paddingX = 10;
  const paddingTop = 26;
  const paddingBottom = 26;

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Use ONLY real data — never fall back to hardcoded mock
  const hasRealData = !!(data && data.points && data.points.length > 0);
  const activeData: TimeframeData = hasRealData
    ? data!
    : {
        points: [],
        pnl: "$0.00",
        pnlPercent: "0.00%",
        isPositive: true,
        high: "$0.00",
        low: "$0.00",
        volume24h: "$0.00",
      };
  const points = activeData.points;

  // Shimmer animation for loading skeleton
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isLoading || !hasRealData) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(shimmerAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isLoading, hasRealData]);

  const { minVal, maxVal, maxVol, minPointIndex, maxPointIndex } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    let mVol = 0;
    let minIdx = 0;
    let maxIdx = 0;

    points.forEach((p, idx) => {
      const lowVal = chartMode === "candles" ? p.low : p.close;
      const highVal = chartMode === "candles" ? p.high : p.close;
      if (lowVal < min) {
        min = lowVal;
        minIdx = idx;
      }
      if (highVal > max) {
        max = highVal;
        maxIdx = idx;
      }
      if (p.volume > mVol) mVol = p.volume;
    });

    const range = max - min || 1;
    return {
      minVal: min - range * 0.08,
      maxVal: max + range * 0.08,
      maxVol: mVol || 100,
      minPointIndex: minIdx,
      maxPointIndex: maxIdx,
    };
  }, [points, chartMode]);

  const usableWidth = Math.max(10, chartWidth - paddingX * 2);
  const usableHeight = chartHeight - paddingTop - paddingBottom;
  const bottomY = chartHeight - paddingBottom;

  const svgCoords = useMemo(() => {
    const valRange = maxVal - minVal || 1;

    return points.map((p, idx) => {
      const x = paddingX + (idx / (points.length - 1)) * usableWidth;
      const yClose = paddingTop + usableHeight - ((p.close - minVal) / valRange) * usableHeight;
      const yOpen = paddingTop + usableHeight - ((p.open - minVal) / valRange) * usableHeight;
      const yHigh = paddingTop + usableHeight - ((p.high - minVal) / valRange) * usableHeight;
      const yLow = paddingTop + usableHeight - ((p.low - minVal) / valRange) * usableHeight;

      return {
        x,
        y: yClose,
        yOpen,
        yHigh,
        yLow,
        isBullish: p.close >= p.open,
        data: p,
      };
    });
  }, [points, usableWidth, usableHeight, minVal, maxVal, paddingX, paddingTop]);

  const closePrices = useMemo(() => points.map((p) => p.close), [points]);
  const ma7Values = useMemo(() => calculateSMA(closePrices, 4), [closePrices]);
  const ma25Values = useMemo(() => calculateSMA(closePrices, 7), [closePrices]);

  const ma7Coords = useMemo(() => {
    const valRange = maxVal - minVal || 1;
    return svgCoords
      .map((c, i) => {
        const val = ma7Values[i];
        if (val === null) return null;
        const y = paddingTop + usableHeight - ((val - minVal) / valRange) * usableHeight;
        return { x: c.x, y };
      })
      .filter((c): c is { x: number; y: number } => c !== null);
  }, [svgCoords, ma7Values, minVal, maxVal, paddingTop, usableHeight]);

  const ma25Coords = useMemo(() => {
    const valRange = maxVal - minVal || 1;
    return svgCoords
      .map((c, i) => {
        const val = ma25Values[i];
        if (val === null) return null;
        const y = paddingTop + usableHeight - ((val - minVal) / valRange) * usableHeight;
        return { x: c.x, y };
      })
      .filter((c): c is { x: number; y: number } => c !== null);
  }, [svgCoords, ma25Values, minVal, maxVal, paddingTop, usableHeight]);

  const ma7Path = useMemo(() => buildSmoothPath(ma7Coords, bottomY).pathString, [ma7Coords, bottomY]);
  const ma25Path = useMemo(() => buildSmoothPath(ma25Coords, bottomY).pathString, [ma25Coords, bottomY]);

  const lineCoords = useMemo(
    () => svgCoords.map((c) => ({ x: c.x, y: c.y })),
    [svgCoords]
  );

  const { pathString, areaString, lastPoint } = useMemo(
    () => buildSmoothPath(lineCoords, bottomY),
    [lineCoords, bottomY]
  );

  const activeCoord = activeIndex !== null && svgCoords[activeIndex] ? svgCoords[activeIndex] : null;

  const handleTouch = useCallback(
    (touchX: number) => {
      const relativeX = Math.max(0, Math.min(usableWidth, touchX - paddingX));
      const ratio = relativeX / usableWidth;
      const index = Math.round(ratio * (points.length - 1));
      const clampedIndex = Math.max(0, Math.min(points.length - 1, index));

      setActiveIndex(clampedIndex);
      onScrubChange?.({
        time: points[clampedIndex].time,
        value: points[clampedIndex].close,
      });
    },
    [usableWidth, paddingX, points, onScrubChange]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => handleTouch(evt.nativeEvent.locationX),
        onPanResponderMove: (evt) => handleTouch(evt.nativeEvent.locationX),
        onPanResponderRelease: () => {
          setActiveIndex(null);
          onScrubChange?.(null);
        },
        onPanResponderTerminate: () => {
          setActiveIndex(null);
          onScrubChange?.(null);
        },
      }),
    [handleTouch, onScrubChange]
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 50 && w !== chartWidth) {
      setChartWidth(w);
    }
  };

  const isPositive = activeData.isPositive;
  const glowColor = isPositive ? "#8B5CF6" : "#EF4444";

  const tooltipX = activeCoord
    ? Math.max(50, Math.min(chartWidth - 50, activeCoord.x))
    : 0;

  const maxCoord = svgCoords[maxPointIndex];
  const minCoord = svgCoords[minPointIndex];

  // ═══ Loading / Empty State ═══
  if (isLoading || !hasRealData) {
    const shimmerOpacity = shimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.7],
    });
    return (
      <View style={styles.outerWrapper}>
        {/* Control bar placeholder */}
        <View style={styles.chartControlBar}>
          <View style={styles.modeToggleGroup}>
            <View style={[styles.modeToggleBtn, styles.modeToggleBtnActive]}>
              <Text style={[styles.modeToggleText, styles.modeToggleTextActive]}>Line</Text>
            </View>
            <View style={styles.modeToggleBtn}>
              <Text style={styles.modeToggleText}>Candles</Text>
            </View>
          </View>
        </View>

        <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
          {isLoading ? (
            <>
              {/* Animated shimmer bars simulating chart shape */}
              <View style={styles.skeletonChartArea}>
                {[0.6, 0.4, 0.7, 0.5, 0.8, 0.45, 0.65, 0.55, 0.75, 0.5, 0.6, 0.7].map((h, i) => (
                  <Animated.View
                    key={`skel-${i}`}
                    style={[
                      styles.skeletonBar,
                      {
                        height: `${h * 100}%`,
                        opacity: shimmerOpacity,
                      },
                    ]}
                  />
                ))}
              </View>
              <ActivityIndicator
                size="small"
                color="#A855F7"
                style={{ position: "absolute" }}
              />
            </>
          ) : (
            <View style={styles.emptyChartContainer}>
              <Text style={styles.emptyChartIcon}>📊</Text>
              <Text style={styles.emptyChartText}>No chart data available</Text>
              <Text style={styles.emptyChartSubtext}>
                Connect a wallet with holdings to see portfolio charts
              </Text>
            </View>
          )}
        </View>

        {/* Stats strip placeholder */}
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>High</Text>
            <Text style={styles.statValue}>--</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Low</Text>
            <Text style={styles.statValue}>--</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Volume</Text>
            <Text style={styles.statValue}>--</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.outerWrapper}>
      {/* ═══ Header Bar: Mode & Technical Indicator Chips ═══ */}
      <View style={styles.chartControlBar}>
        {/* Style switch */}
        <View style={styles.modeToggleGroup}>
          <TouchableOpacity
            style={[
              styles.modeToggleBtn,
              chartMode === "line" && styles.modeToggleBtnActive,
            ]}
            onPress={() => setChartMode("line")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.modeToggleText,
                chartMode === "line" && styles.modeToggleTextActive,
              ]}
            >
              📈 Line
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeToggleBtn,
              chartMode === "candles" && styles.modeToggleBtnActive,
            ]}
            onPress={() => setChartMode("candles")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.modeToggleText,
                chartMode === "candles" && styles.modeToggleTextActive,
              ]}
            >
              🕯️ Candles
            </Text>
          </TouchableOpacity>
        </View>

        {/* Indicator chips */}
        <View style={styles.indicatorsRow}>
          <TouchableOpacity
            style={[styles.indicatorChip, showMA7 && styles.indicatorChipActiveMA7]}
            onPress={() => setShowMA7(!showMA7)}
            activeOpacity={0.7}
          >
            <Text style={[styles.indicatorChipText, showMA7 && { color: "#F59E0B" }]}>
              MA(7)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.indicatorChip, showMA25 && styles.indicatorChipActiveMA25]}
            onPress={() => setShowMA25(!showMA25)}
            activeOpacity={0.7}
          >
            <Text style={[styles.indicatorChipText, showMA25 && { color: "#06B6D4" }]}>
              MA(25)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.indicatorChip, showVol && styles.indicatorChipActiveVol]}
            onPress={() => setShowVol(!showVol)}
            activeOpacity={0.7}
          >
            <Text style={[styles.indicatorChipText, showVol && { color: "#A855F7" }]}>
              VOL
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══ Main Interactive Chart Container ═══ */}
      <View style={styles.container} onLayout={onLayout} {...panResponder.panHandlers}>
        {/* Subtle Horizontal Reference Grid */}
        <View style={styles.gridContainer}>
          <View style={styles.gridLine} />
          <View style={styles.gridLine} />
          <View style={styles.gridLine} />
        </View>

        {/* ═══ Floating Scrubber Tooltip ═══ */}
        {activeCoord && (
          <View
            style={[
              styles.floatingTooltip,
              {
                left: tooltipX - 52,
                top: Math.max(0, activeCoord.y - 42),
              },
            ]}
          >
            <Text style={styles.tooltipPrice}>
              ${activeCoord.data.close.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </Text>
            <Text style={styles.tooltipTime}>
              {chartMode === "candles"
                ? `O:${activeCoord.data.open} C:${activeCoord.data.close}`
                : activeCoord.data.time}
            </Text>
          </View>
        )}

        <Svg width={chartWidth} height={chartHeight} style={StyleSheet.absoluteFill}>
          <Defs>
            {/* Smooth Area Gradient */}
            <LinearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={glowColor} stopOpacity={0.45} />
              <Stop offset="50%" stopColor={glowColor} stopOpacity={0.16} />
              <Stop offset="90%" stopColor={glowColor} stopOpacity={0.02} />
              <Stop offset="100%" stopColor={glowColor} stopOpacity={0.0} />
            </LinearGradient>

            {/* Neon Stroke Gradient */}
            <LinearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#E9D5FF" />
              <Stop offset="50%" stopColor="#A855F7" />
              <Stop offset="100%" stopColor="#7C3AED" />
            </LinearGradient>

            {/* Volume Bar Gradient */}
            <LinearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#A855F7" stopOpacity={0.35} />
              <Stop offset="100%" stopColor="#7C3AED" stopOpacity={0.06} />
            </LinearGradient>
          </Defs>

          {/* ═══ Volume Histogram Bars ═══ */}
          {showVol && (
            <G>
              {svgCoords.map((coord, i) => {
                const barHeight = Math.max(3, (coord.data.volume / maxVol) * 22);
                const barWidth = Math.max(3, (usableWidth / svgCoords.length) * 0.42);
                const barColor =
                  chartMode === "candles"
                    ? coord.isBullish
                      ? "rgba(16, 185, 129, 0.4)"
                      : "rgba(244, 63, 94, 0.4)"
                    : "url(#volumeGradient)";

                return (
                  <Rect
                    key={`vol-${i}`}
                    x={coord.x - barWidth / 2}
                    y={bottomY - barHeight}
                    width={barWidth}
                    height={barHeight}
                    rx={1.5}
                    fill={barColor}
                  />
                );
              })}
            </G>
          )}

          {/* ═══ Mode 1: Line Chart Rendering ═══ */}
          {chartMode === "line" && (
            <G>
              {/* Shaded Area Fill */}
              <Path d={areaString} fill="url(#chartAreaGradient)" />

              {/* Luminous Glow Stroke */}
              <Path
                d={pathString}
                fill="none"
                stroke="#A855F7"
                strokeWidth={5.5}
                strokeOpacity={0.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Crisp Foreground Stroke */}
              <Path
                d={pathString}
                fill="none"
                stroke="url(#strokeGradient)"
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Live Pulsing Dot */}
              {!activeCoord && lastPoint && (
                <G>
                  <Circle
                    cx={lastPoint.x}
                    cy={lastPoint.y}
                    r={8}
                    fill="rgba(168, 85, 247, 0.35)"
                  />
                  <Circle
                    cx={lastPoint.x}
                    cy={lastPoint.y}
                    r={4.5}
                    fill="#FFFFFF"
                    stroke="#A855F7"
                    strokeWidth={2}
                  />
                </G>
              )}
            </G>
          )}

          {/* ═══ Mode 2: Professional Candlestick Rendering ═══ */}
          {chartMode === "candles" && (
            <G>
              {svgCoords.map((c, idx) => {
                const candleWidth = Math.max(4, (usableWidth / svgCoords.length) * 0.6);
                const color = c.isBullish ? "#10B981" : "#F43F5E";
                const topBody = Math.min(c.yOpen, c.y);
                const bodyHeight = Math.max(2.5, Math.abs(c.y - c.yOpen));

                return (
                  <G key={`candle-${idx}`}>
                    {/* Upper & Lower Wick */}
                    <Line
                      x1={c.x}
                      y1={c.yHigh}
                      x2={c.x}
                      y2={c.yLow}
                      stroke={color}
                      strokeWidth={1.5}
                    />

                    {/* Candle Body */}
                    <Rect
                      x={c.x - candleWidth / 2}
                      y={topBody}
                      width={candleWidth}
                      height={bodyHeight}
                      rx={1.5}
                      fill={color}
                      stroke={color}
                      strokeWidth={0.5}
                    />
                  </G>
                );
              })}
            </G>
          )}

          {/* ═══ Moving Average 7 (Gold) ═══ */}
          {showMA7 && ma7Path ? (
            <Path
              d={ma7Path}
              fill="none"
              stroke="#F59E0B"
              strokeWidth={1.8}
              strokeOpacity={0.85}
              strokeLinecap="round"
            />
          ) : null}

          {/* ═══ Moving Average 25 (Cyan) ═══ */}
          {showMA25 && ma25Path ? (
            <Path
              d={ma25Path}
              fill="none"
              stroke="#06B6D4"
              strokeWidth={1.8}
              strokeOpacity={0.85}
              strokeLinecap="round"
            />
          ) : null}

          {/* ═══ High & Low Peak Pinned Markers (When not scrubbing) ═══ */}
          {!activeCoord && maxCoord && (
            <G>
              <Circle cx={maxCoord.x} cy={maxCoord.yHigh || maxCoord.y} r={3} fill="#10B981" />
            </G>
          )}
          {!activeCoord && minCoord && (
            <G>
              <Circle cx={minCoord.x} cy={minCoord.yLow || minCoord.y} r={3} fill="#F43F5E" />
            </G>
          )}

          {/* ═══ Interactive Crosshair & Cursor Pin ═══ */}
          {activeCoord && (
            <G>
              {/* Vertical Guide Line */}
              <Line
                x1={activeCoord.x}
                y1={paddingTop - 8}
                x2={activeCoord.x}
                y2={bottomY}
                stroke="rgba(255, 255, 255, 0.45)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />

              {/* Horizontal Price Crosshair Guide */}
              <Line
                x1={paddingX}
                y1={activeCoord.y}
                x2={chartWidth - paddingX}
                y2={activeCoord.y}
                stroke="rgba(168, 85, 247, 0.4)"
                strokeWidth={1}
                strokeDasharray="2 2"
              />

              {/* Scrubber Pin Outer Halo */}
              <Circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r={9}
                fill="rgba(168, 85, 247, 0.45)"
              />

              {/* Scrubber Pin Inner Dot */}
              <Circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r={5}
                fill="#FFFFFF"
                stroke="#A855F7"
                strokeWidth={2.5}
              />
            </G>
          )}
        </Svg>

        {/* ═══ X-Axis Time Markers ═══ */}
        <View style={styles.xAxisRow}>
          <Text style={styles.xAxisText}>{points[0]?.time}</Text>
          <Text style={styles.xAxisText}>
            {points[Math.floor(points.length / 2)]?.time}
          </Text>
          <Text style={styles.xAxisText}>{points[points.length - 1]?.time}</Text>
        </View>
      </View>

      {/* ═══ Real-time Market Stats Strip (24h High, Low, Vol) ═══ */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>24h High</Text>
          <Text style={styles.statValueGreen}>{activeData.high}</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <Text style={styles.statLabel}>24h Low</Text>
          <Text style={styles.statValueRed}>{activeData.low}</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Volume</Text>
          <Text style={styles.statValue}>{activeData.volume24h}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    width: "100%",
    gap: 8,
  },
  skeletonChartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-evenly",
    width: "100%",
    height: "70%",
    paddingHorizontal: 20,
    gap: 6,
  },
  skeletonBar: {
    flex: 1,
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderRadius: 3,
    minWidth: 6,
  },
  emptyChartContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 20,
  },
  emptyChartIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  emptyChartText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyChartSubtext: {
    color: "#64748B",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
  chartControlBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
    marginBottom: -2,
  },
  modeToggleGroup: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  modeToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modeToggleBtnActive: {
    backgroundColor: "rgba(124, 58, 237, 0.5)",
  },
  modeToggleText: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "600",
  },
  modeToggleTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  indicatorsRow: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  indicatorChip: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  indicatorChipActiveMA7: {
    borderColor: "rgba(245, 158, 11, 0.4)",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  indicatorChipActiveMA25: {
    borderColor: "rgba(6, 182, 212, 0.4)",
    backgroundColor: "rgba(6, 182, 212, 0.12)",
  },
  indicatorChipActiveVol: {
    borderColor: "rgba(168, 85, 247, 0.4)",
    backgroundColor: "rgba(168, 85, 247, 0.12)",
  },
  indicatorChipText: {
    color: "#64748B",
    fontSize: 9,
    fontWeight: "700",
  },
  container: {
    height: 175,
    width: "100%",
    justifyContent: "flex-end",
    position: "relative",
  },
  gridContainer: {
    position: "absolute",
    top: 15,
    left: 0,
    right: 0,
    bottom: 25,
    justifyContent: "space-between",
    opacity: 0.12,
  },
  gridLine: {
    height: 1,
    backgroundColor: "#FFFFFF",
    width: "100%",
  },
  floatingTooltip: {
    position: "absolute",
    width: 104,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderColor: "#A855F7",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 6,
    alignItems: "center",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  tooltipPrice: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontWeight: "700",
  },
  tooltipTime: {
    color: "#94A3B8",
    fontSize: 8,
    fontWeight: "500",
  },
  xAxisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    marginBottom: 2,
  },
  xAxisText: {
    color: "#94A3B8",
    fontSize: 9.5,
    fontWeight: "600",
  },
  statsStrip: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    justifyContent: "space-around",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    color: "#64748B",
    fontSize: 9.5,
    fontWeight: "500",
    marginBottom: 1,
  },
  statValue: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "700",
  },
  statValueGreen: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "700",
  },
  statValueRed: {
    color: "#F43F5E",
    fontSize: 11,
    fontWeight: "700",
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
});
