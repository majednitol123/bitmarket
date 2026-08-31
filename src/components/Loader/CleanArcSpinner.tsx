import React, { useEffect } from "react";
import { ViewProps } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import styled from "styled-components/native";

interface SpinnerProps extends ViewProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  duration?: number;
}

const Container = styled.View<{ size: number }>`
  width: ${(props) => props.size}px;
  height: ${(props) => props.size}px;
`;

const CleanArcSpinner: React.FC<SpinnerProps> = ({
  size = 40,
  color = "#007AFF",
  strokeWidth = 4,
  duration = 1000,
  ...props
}) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(360, {
        duration: duration,
        easing: Easing.linear,
      }),
      -1,
      false
    );
    return () => {
      cancelAnimation(rotation);
    };
  }, [rotation, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const arc = circumference * 0.75;

  return (
    <Container size={size} {...props}>
      <Animated.View style={[animatedStyle, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Path
            d={`
              M ${size / 2}, ${strokeWidth / 2}
              A ${radius}, ${radius} 0 1 1 ${size / 2 - 0.1}, ${strokeWidth / 2}
            `}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${circumference}`}
          />
        </Svg>
      </Animated.View>
    </Container>
  );
};

export default CleanArcSpinner;
