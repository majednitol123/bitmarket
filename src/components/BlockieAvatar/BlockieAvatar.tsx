import React, { useMemo } from "react";
import Svg, { Rect, Defs, ClipPath, Circle as SvgCircle } from "react-native-svg";
import { View } from "react-native";

interface BlockieAvatarProps {
  address: string;
  size?: number;
  borderWidth?: number;
  borderColor?: string;
}

/**
 * Deterministic blockies-style avatar generator for Ethereum addresses.
 * Creates a unique, colorful 8×8 pixel art icon inside a circular mask,
 * similar to MetaMask's identicon avatars.
 *
 * Uses a simple seed-based PRNG derived from the address to generate:
 * - A primary color
 * - A secondary/background color
 * - A spot (accent) color
 * - An 8×8 symmetric pattern
 */

// ─── Seed-based PRNG (xorshift32) ────────────────────────────────────────────
function createSeedFromAddress(address: string): number[] {
  const seed = new Array(4).fill(0);
  const addr = address.toLowerCase();
  for (let i = 0; i < addr.length; i++) {
    seed[i % 4] = (seed[i % 4] << 5) - seed[i % 4] + addr.charCodeAt(i);
    seed[i % 4] = seed[i % 4] | 0; // Convert to 32-bit integer
  }
  return seed;
}

function nextRand(seed: number[]): number {
  const t = seed[0] ^ (seed[0] << 11);
  seed[0] = seed[1];
  seed[1] = seed[2];
  seed[2] = seed[3];
  seed[3] = seed[3] ^ (seed[3] >> 19) ^ t ^ (t >> 8);
  return (seed[3] >>> 0) / ((1 << 31) >>> 0);
}

// ─── Color generation ────────────────────────────────────────────────────────
function createColor(seed: number[]): string {
  const h = Math.floor(nextRand(seed) * 360);
  const s = nextRand(seed) * 60 + 40; // 40–100%
  const l = (nextRand(seed) + nextRand(seed) + nextRand(seed) + nextRand(seed)) * 25; // 0–100, biased toward center
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// ─── Pattern generation (8×8 with vertical symmetry) ─────────────────────────
function createImageData(seed: number[]): number[] {
  const gridSize = 8;
  const halfWidth = Math.ceil(gridSize / 2);
  const data: number[] = [];

  for (let y = 0; y < gridSize; y++) {
    let row: number[] = [];
    for (let x = 0; x < halfWidth; x++) {
      // 0 = bg, 1 = primary, 2 = spot
      const val = Math.floor(nextRand(seed) * 2.3);
      row.push(val);
    }
    // Mirror for symmetry
    const mirror = [...row].reverse();
    if (gridSize % 2 === 0) {
      row = [...row, ...mirror];
    } else {
      row = [...row, ...mirror.slice(1)];
    }
    data.push(...row);
  }

  return data;
}

// ─── Component ───────────────────────────────────────────────────────────────
const BlockieAvatar: React.FC<BlockieAvatarProps> = ({
  address,
  size = 40,
  borderWidth = 2,
  borderColor = "rgba(255,255,255,0.15)",
}) => {
  const { bgColor, primaryColor, spotColor, imageData } = useMemo(() => {
    const seed = createSeedFromAddress(address || "0x0000000000000000000000000000000000000000");
    const bg = createColor(seed);
    const primary = createColor(seed);
    const spot = createColor(seed);
    const data = createImageData(seed);
    return { bgColor: bg, primaryColor: primary, spotColor: spot, imageData: data };
  }, [address]);

  const gridSize = 8;
  const cellSize = size / gridSize;
  const clipId = `clip-${address?.slice(2, 10) || "default"}`;

  const getColor = (value: number) => {
    switch (value) {
      case 1:
        return primaryColor;
      case 2:
        return spotColor;
      default:
        return bgColor;
    }
  };

  return (
    <View
      style={{
        width: size + borderWidth * 2,
        height: size + borderWidth * 2,
        borderRadius: (size + borderWidth * 2) / 2,
        borderWidth,
        borderColor,
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <ClipPath id={clipId}>
            <SvgCircle cx={size / 2} cy={size / 2} r={size / 2} />
          </ClipPath>
        </Defs>
        {/* Background fill */}
        <Rect
          x={0}
          y={0}
          width={size}
          height={size}
          fill={bgColor}
          clipPath={`url(#${clipId})`}
        />
        {/* Grid pattern */}
        {imageData.map((value, index) => {
          if (value === 0) return null; // Skip background cells
          const x = (index % gridSize) * cellSize;
          const y = Math.floor(index / gridSize) * cellSize;
          return (
            <Rect
              key={index}
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              fill={getColor(value)}
              clipPath={`url(#${clipId})`}
            />
          );
        })}
      </Svg>
    </View>
  );
};

export default React.memo(BlockieAvatar);
