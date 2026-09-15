import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  PanResponder,
  LayoutChangeEvent,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useTheme } from "styled-components/native";
import { useSafeAreaInsets, EdgeInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Circle,
  Line,
  G,
  Rect,
} from "react-native-svg";
import * as Clipboard from "expo-clipboard";
import Toast from "react-native-toast-message";

import type { ThemeType } from "../../styles/theme";
import { SafeAreaContainer } from "../../components/Styles/Layout.styles";
import Header from "../../components/Header/Header";
import { BlockchainIcon } from "../../components/BlockchainIcon/BlockchainIcon";
import { marketApi, MarketToken, ChartPoint } from "../../api/marketApi";
import { formatCompactNumber, formatPrice, formatPercent } from "../../utils/formatters";
import { SwapIcon, CopyIcon, BellIcon } from "../../components/Icons/AppIcons";
import { PriceAlertModal } from "../../components/PriceAlertModal";

const TIMEFRAMES = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;
type Timeframe = typeof TIMEFRAMES[number];

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

export default function TokenDetailScreen() {
  const theme = useTheme() as ThemeType;
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const params = useLocalSearchParams<{
    coinId: string;
    symbol?: string;
    name?: string;
    icon?: string;
    price?: string;
    change24h?: string;
  }>();

  const coinId = params.coinId || "bitcoin";
  const initialSymbol = params.symbol || "TOKEN";
  const initialName = params.name || "Token";

  const [timeframe, setTimeframe] = useState<Timeframe>("1W");
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
  const [tokenDetail, setTokenDetail] = useState<MarketToken | null>(null);
  const [loadingChart, setLoadingChart] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [chartWidth, setChartWidth] = useState<number>(340);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);

  const chartHeight = 200;
  const paddingX = 12;
  const paddingTop = 20;
  const paddingBottom = 24;

  const loadTokenData = useCallback(async () => {
    try {
      const detail = await marketApi.getTokenById(coinId);
      if (detail) {
        setTokenDetail(detail);
      }
    } catch (e) {
      console.warn("Error fetching token detail:", e);
    }
  }, [coinId]);

  const loadChartData = useCallback(async (period: Timeframe) => {
    setLoadingChart(true);
    try {
      const data = await marketApi.getTokenChart(coinId, period);
      if (data && Array.isArray(data.points)) {
        setChartPoints(data.points);
      }
    } catch (e) {
      console.warn("Error fetching chart data:", e);
    } finally {
      setLoadingChart(false);
    }
  }, [coinId]);

  useEffect(() => {
    loadTokenData();
    loadChartData(timeframe);
  }, [coinId, timeframe, loadTokenData, loadChartData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadTokenData(), loadChartData(timeframe)]);
    setRefreshing(false);
  }, [loadTokenData, loadChartData, timeframe]);

  // Derive Min/Max and coordinates
  const { minVal, maxVal, maxVol } = useMemo(() => {
    if (chartPoints.length === 0) {
      return { minVal: 0, maxVal: 1, maxVol: 1 };
    }
    let min = Infinity;
    let max = -Infinity;
    let mVol = 0;

    chartPoints.forEach((p) => {
      if (p.priceUsd < min) min = p.priceUsd;
      if (p.priceUsd > max) max = p.priceUsd;
      if (p.volume && p.volume > mVol) mVol = p.volume;
    });

    const range = max - min || 1;
    return {
      minVal: Math.max(0, min - range * 0.05),
      maxVal: max + range * 0.05,
      maxVol: mVol || 1,
    };
  }, [chartPoints]);

  const usableWidth = Math.max(10, chartWidth - paddingX * 2);
  const usableHeight = chartHeight - paddingTop - paddingBottom;
  const bottomY = chartHeight - paddingBottom;

  const svgCoords = useMemo(() => {
    if (chartPoints.length === 0) return [];
    const valRange = maxVal - minVal || 1;

    return chartPoints.map((p, idx) => {
      const x = paddingX + (idx / Math.max(1, chartPoints.length - 1)) * usableWidth;
      const y = paddingTop + usableHeight - ((p.priceUsd - minVal) / valRange) * usableHeight;
      return { x, y, data: p };
    });
  }, [chartPoints, usableWidth, usableHeight, minVal, maxVal, paddingX, paddingTop]);

  const { pathString, areaString, lastPoint } = useMemo(
    () => buildSmoothPath(svgCoords.map((c) => ({ x: c.x, y: c.y })), bottomY),
    [svgCoords, bottomY]
  );

  const activeCoord = activeIndex !== null && svgCoords[activeIndex] ? svgCoords[activeIndex] : null;

  const isPositive = useMemo(() => {
    if (chartPoints.length >= 2) {
      return chartPoints[chartPoints.length - 1].priceUsd >= chartPoints[0].priceUsd;
    }
    return (tokenDetail?.change24hPercent ?? 0) >= 0;
  }, [chartPoints, tokenDetail]);

  const glowColor = isPositive ? "#10B981" : "#EF4444";

  const handleTouch = useCallback(
    (touchX: number) => {
      if (chartPoints.length === 0) return;
      const relativeX = Math.max(0, Math.min(usableWidth, touchX - paddingX));
      const ratio = relativeX / usableWidth;
      const index = Math.round(ratio * (chartPoints.length - 1));
      const clampedIndex = Math.max(0, Math.min(chartPoints.length - 1, index));
      setActiveIndex(clampedIndex);
    },
    [usableWidth, paddingX, chartPoints]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => handleTouch(evt.nativeEvent.locationX),
        onPanResponderMove: (evt) => handleTouch(evt.nativeEvent.locationX),
        onPanResponderRelease: () => setActiveIndex(null),
        onPanResponderTerminate: () => setActiveIndex(null),
      }),
    [handleTouch]
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 50 && w !== chartWidth) {
      setChartWidth(w);
    }
  };

  const copyContractAddress = async (addr?: string) => {
    if (!addr) return;
    await Clipboard.setStringAsync(addr);
    Toast.show({
      type: "success",
      text1: "Copied",
      text2: "Contract address copied to clipboard",
    });
  };

  const handleTrade = () => {
    router.replace("/(app)");
  };

  const currentPriceDisplay = activeCoord
    ? formatPrice(activeCoord.data.priceUsd)
    : tokenDetail
    ? formatPrice(tokenDetail.priceUsd)
    : params.price || "$0.00";

  const activeTimeDisplay = activeCoord
    ? new Date(activeCoord.data.timestamp).toLocaleString()
    : null;

  return (
    <SafeAreaContainer edges={["bottom", "left", "right"]}>
      <Header
        title={tokenDetail?.symbol || initialSymbol}
        showBack={true}
        onBack={() => router.back()}
        rightAction="connect"
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            tintColor={theme.colors.primary}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {/* ═══ Token Overview Header Card ═══ */}
        <View style={styles.tokenHeaderCard}>
          <View style={styles.tokenIdentityRow}>
            <BlockchainIcon
              symbol={tokenDetail?.symbol || initialSymbol}
              size={44}
              logoUrl={tokenDetail?.logoUrl || params.icon}
            />
            <View style={styles.tokenIdentityText}>
              <Text style={styles.tokenSymbol}>{tokenDetail?.symbol || initialSymbol}</Text>
              <Text style={styles.tokenName} numberOfLines={1}>
                {tokenDetail?.name || initialName}
              </Text>
            </View>
            {tokenDetail?.rank ? (
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>#{tokenDetail.rank}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.headerAlertBtn}
              activeOpacity={0.75}
              onPress={() => setIsAlertModalOpen(true)}
            >
              <BellIcon size={14} color="#38BDF8" />
              <Text style={styles.headerAlertBtnText}>Alert</Text>
            </TouchableOpacity>
          </View>

          {/* Price & Change */}
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceBig}>{currentPriceDisplay}</Text>
              {activeTimeDisplay ? (
                <Text style={styles.scrubTimeText}>{activeTimeDisplay}</Text>
              ) : null}
            </View>

            <View
              style={[
                styles.changeBadge,
                {
                  backgroundColor: isPositive
                    ? "rgba(16, 185, 129, 0.15)"
                    : "rgba(239, 68, 68, 0.15)",
                },
              ]}
            >
              <Text
                style={[
                  styles.changeText,
                  { color: isPositive ? "#10B981" : "#EF4444" },
                ]}
              >
                {formatPercent(tokenDetail?.change24hPercent ?? Number(params.change24h || 0))}
              </Text>
            </View>
          </View>
        </View>

        {/* ═══ Timeframe Selector ═══ */}
        <View style={styles.timeframeContainer}>
          {TIMEFRAMES.map((tf) => {
            const isActive = timeframe === tf;
            return (
              <TouchableOpacity
                key={tf}
                onPress={() => setTimeframe(tf)}
                style={[
                  styles.timeframePill,
                  isActive && { backgroundColor: theme.colors.primary },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.timeframeText,
                    isActive && { color: "#FFFFFF", fontWeight: "700" },
                  ]}
                >
                  {tf}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ═══ Chart Canvas ═══ */}
        <View style={styles.chartCard} onLayout={onLayout} {...panResponder.panHandlers}>
          {loadingChart ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading chart data...</Text>
            </View>
          ) : chartPoints.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No historical data available for this period.</Text>
            </View>
          ) : (
            <Svg width={chartWidth} height={chartHeight} style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgLinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={glowColor} stopOpacity={0.45} />
                  <Stop offset="60%" stopColor={glowColor} stopOpacity={0.12} />
                  <Stop offset="100%" stopColor={glowColor} stopOpacity={0.0} />
                </SvgLinearGradient>

                <SvgLinearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0%" stopColor={isPositive ? "#34D399" : "#F87171"} />
                  <Stop offset="100%" stopColor={isPositive ? "#10B981" : "#EF4444"} />
                </SvgLinearGradient>
              </Defs>

              {/* Shaded Area */}
              <Path d={areaString} fill="url(#chartGradient)" />

              {/* Glow Stroke */}
              <Path
                d={pathString}
                fill="none"
                stroke={glowColor}
                strokeWidth={4.5}
                strokeOpacity={0.3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Crisp Stroke */}
              <Path
                d={pathString}
                fill="none"
                stroke="url(#strokeGradient)"
                strokeWidth={2.4}
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
                    fill={isPositive ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)"}
                  />
                  <Circle
                    cx={lastPoint.x}
                    cy={lastPoint.y}
                    r={4}
                    fill="#FFFFFF"
                    stroke={glowColor}
                    strokeWidth={2}
                  />
                </G>
              )}

              {/* Crosshair when scrubbing */}
              {activeCoord && (
                <G>
                  <Line
                    x1={activeCoord.x}
                    y1={paddingTop}
                    x2={activeCoord.x}
                    y2={bottomY}
                    stroke="rgba(255, 255, 255, 0.4)"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                  <Circle
                    cx={activeCoord.x}
                    cy={activeCoord.y}
                    r={8}
                    fill="rgba(124, 58, 237, 0.45)"
                  />
                  <Circle
                    cx={activeCoord.x}
                    cy={activeCoord.y}
                    r={4.5}
                    fill="#FFFFFF"
                    stroke="#7C3AED"
                    strokeWidth={2}
                  />
                </G>
              )}
            </Svg>
          )}
        </View>

        {/* ═══ Key Statistics Card ═══ */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Key Statistics</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Market Cap</Text>
              <Text style={styles.statValue}>
                {formatCompactNumber(tokenDetail?.marketCapUsd)}
              </Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>24h Volume</Text>
              <Text style={styles.statValue}>
                {formatCompactNumber(tokenDetail?.volume24hUsd)}
              </Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>1h Change</Text>
              <Text
                style={[
                  styles.statValue,
                  {
                    color:
                      (tokenDetail?.change1hPercent ?? 0) >= 0
                        ? "#10B981"
                        : "#EF4444",
                  },
                ]}
              >
                {formatPercent(tokenDetail?.change1hPercent)}
              </Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>7d Change</Text>
              <Text
                style={[
                  styles.statValue,
                  {
                    color:
                      (tokenDetail?.change1wPercent ?? 0) >= 0
                        ? "#10B981"
                        : "#EF4444",
                  },
                ]}
              >
                {formatPercent(tokenDetail?.change1wPercent)}
              </Text>
            </View>
          </View>

          {/* Contract Address if available */}
          {tokenDetail?.contractAddress ? (
            <TouchableOpacity
              style={styles.contractRow}
              activeOpacity={0.7}
              onPress={() => copyContractAddress(tokenDetail.contractAddress)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>Contract Address</Text>
                <Text style={styles.contractText} numberOfLines={1}>
                  {tokenDetail.contractAddress}
                </Text>
              </View>
              <CopyIcon size={18} color={theme.colors.lightGrey} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ═══ Bottom Actions (Price Alert & Swap) ═══ */}
        <View style={styles.bottomActionBar}>
          <TouchableOpacity
            style={styles.bottomAlertButton}
            activeOpacity={0.8}
            onPress={() => setIsAlertModalOpen(true)}
          >
            <BellIcon size={18} color="#38BDF8" />
            <Text style={styles.bottomAlertButtonText}>Set Alert</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.swapButton}
            activeOpacity={0.85}
            onPress={handleTrade}
          >
            <LinearGradient
              colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.swapButtonGradient}
            >
              <SwapIcon size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.swapButtonText}>
                Swap {tokenDetail?.symbol || initialSymbol}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ═══ Price Alert Modal ═══ */}
      <PriceAlertModal
        visible={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        tokenId={coinId}
        tokenSymbol={tokenDetail?.symbol || initialSymbol}
        tokenName={tokenDetail?.name || initialName}
        chain={tokenDetail?.contractAddresses?.[0]?.blockchain || "ethereum"}
        tokenAddress={tokenDetail?.contractAddress || tokenDetail?.contractAddresses?.[0]?.contractAddress}
        currentPrice={
          tokenDetail?.priceUsd ||
          (params.price ? parseFloat(params.price.replace(/[^0-9.]/g, "")) : 0)
        }
        onAlertCreated={(alert) => {
          Toast.show({
            type: "success",
            text1: "Price Alert Active",
            text2: `Target ${alert.condition === "above" ? "≥" : "≤"} $${alert.targetPrice.toLocaleString()} set for ${alert.tokenSymbol}`,
          });
        }}
      />
    </SafeAreaContainer>
  );
}

function createStyles(theme: ThemeType, insets: EdgeInsets) {
  return StyleSheet.create({
    scrollContent: {
      padding: 16,
      gap: 16,
    },
    tokenHeaderCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      gap: 14,
    },
    tokenIdentityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    tokenIdentityText: {
      flex: 1,
    },
    tokenSymbol: {
      color: theme.colors.white,
      fontSize: 20,
      fontWeight: "800",
    },
    tokenName: {
      color: theme.colors.lightGrey,
      fontSize: 13,
      fontWeight: "500",
      marginTop: 2,
    },
    rankBadge: {
      backgroundColor: "rgba(124, 58, 237, 0.2)",
      borderColor: "rgba(124, 58, 237, 0.4)",
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    rankBadgeText: {
      color: "#A855F7",
      fontSize: 12,
      fontWeight: "700",
    },
    priceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    priceBig: {
      color: theme.colors.white,
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    scrubTimeText: {
      color: theme.colors.lightGrey,
      fontSize: 11,
      marginTop: 2,
    },
    changeBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
    },
    changeText: {
      fontSize: 13,
      fontWeight: "700",
    },
    timeframeContainer: {
      flexDirection: "row",
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 4,
      justifyContent: "space-between",
    },
    timeframePill: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 7,
      borderRadius: 10,
    },
    timeframeText: {
      color: theme.colors.lightGrey,
      fontSize: 12,
      fontWeight: "600",
    },
    chartCard: {
      height: 200,
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
      position: "relative",
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    loadingText: {
      color: theme.colors.lightGrey,
      fontSize: 12,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    emptyText: {
      color: theme.colors.lightGrey,
      fontSize: 12,
      textAlign: "center",
    },
    statsSection: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      gap: 12,
    },
    sectionTitle: {
      color: theme.colors.white,
      fontSize: 16,
      fontWeight: "700",
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    statBox: {
      flex: 1,
      minWidth: "45%",
      backgroundColor: "rgba(255, 255, 255, 0.03)",
      borderRadius: 12,
      padding: 12,
      gap: 4,
    },
    statLabel: {
      color: theme.colors.grey,
      fontSize: 11,
      fontWeight: "500",
    },
    statValue: {
      color: theme.colors.white,
      fontSize: 15,
      fontWeight: "700",
    },
    contractRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: "rgba(255, 255, 255, 0.03)",
      borderRadius: 12,
      padding: 12,
      marginTop: 4,
    },
    contractText: {
      color: theme.colors.lightGrey,
      fontSize: 12,
      fontFamily: "monospace",
      marginTop: 2,
    },
    headerAlertBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(56, 189, 248, 0.1)",
      borderWidth: 1,
      borderColor: "rgba(56, 189, 248, 0.25)",
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginLeft: 8,
    },
    headerAlertBtnText: {
      color: "#38BDF8",
      fontSize: 12,
      fontWeight: "700",
    },
    bottomActionBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 8,
    },
    bottomAlertButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: "rgba(56, 189, 248, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(56, 189, 248, 0.3)",
      borderRadius: 16,
      paddingVertical: 16,
    },
    bottomAlertButtonText: {
      color: "#38BDF8",
      fontSize: 15,
      fontWeight: "700",
    },
    swapButton: {
      flex: 1.5,
      borderRadius: 16,
      overflow: "hidden",
    },
    swapButtonGradient: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
      gap: 8,
    },
    swapButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
  });
}
