import React, { useEffect } from "react";
import { ViewProps } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import styled from "styled-components/native";

interface LoaderProps extends ViewProps {
  size?: number;
  color?: string;
  dotCount?: number;
  duration?: number;
}

const Container = styled.View<{ size: number }>`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: ${(props) => props.size}px;
`;

const AnimatedDot: React.FC<{
  index: number;
  duration: number;
  dotCount: number;
  color: string;
  size: number;
}> = ({ index, duration, dotCount, color, size }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    const delay = index * (duration / dotCount);

    scale.value = withDelay(
      delay,
      withRepeat(
        withTiming(1.5, {
          duration: duration,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      )
    );

    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, {
          duration: duration,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      )
    );

    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [index, duration, dotCount]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
      ]}
    />
  );
};

const PulseDotLoader: React.FC<LoaderProps> = ({
  size = 50,
  color = "#007AFF",
  dotCount = 3,
  duration = 500,
  ...props
}) => {
  const dotSize = size / (dotCount * 2);
  const dots = Array.from({ length: dotCount });

  return (
    <Container size={size} {...props}>
      {dots.map((_, index) => (
        <AnimatedDot
          key={index}
          index={index}
          duration={duration}
          dotCount={dotCount}
          color={color}
          size={dotSize}
        />
      ))}
    </Container>
  );
};

export default PulseDotLoader;
