import { TouchableOpacity, useWindowDimensions } from "react-native";
import styled from "styled-components/native";
import { ThemeType } from "../../styles/theme";

interface BubbleContainerProps {
  smallBubble?: boolean;
  bubbleWidth: number;
  theme: ThemeType;
}

const BubbleContainer = styled.View<BubbleContainerProps>`
  background-color: ${({ theme }) => theme.colors.cardBackground};
  padding: ${({ theme, smallBubble }) =>
    smallBubble ? "0px" : theme.spacing.small};
  border-radius: 16px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  margin: 4px;
  height: ${({ smallBubble }) => (smallBubble ? "40px" : "48px")};
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-around;
  width: ${({ bubbleWidth }) => bubbleWidth}px;
`;

const BubbleNumber = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.primary};
  min-width: 22px;
  text-align: center;
`;

const BubbleText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.white};
`;

const Line = styled.View`
  background-color: ${({ theme }) => theme.colors.border};
  height: 50%;
  width: 1px;
`;

interface BubbleProps {
  word: string;
  number: number;
  smallBubble?: boolean;
  hideDetails?: boolean;
  onPress?: () => void;
}

const CONTAINER_PADDING = 40; // total horizontal padding of parent containers
const CARD_PADDING = 40; // total horizontal padding inside SeedCard
const BUBBLE_MARGIN = 8; // 4px margin on each side

const Bubble = ({
  word,
  number,
  smallBubble = false,
  hideDetails = false,
  onPress,
}: BubbleProps) => {
  const { width: screenWidth } = useWindowDimensions();
  const num = number.toString();

  // Calculate available width inside the seed card
  const availableWidth = screenWidth - CONTAINER_PADDING - CARD_PADDING;

  // Determine columns: 2 on small screens, 3 on larger
  const columns = smallBubble ? 3 : screenWidth < 380 ? 2 : 3;
  const bubbleWidth = Math.floor(availableWidth / columns) - BUBBLE_MARGIN;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <BubbleContainer smallBubble={smallBubble} bubbleWidth={bubbleWidth}>
        {!hideDetails ? <BubbleNumber>{num}</BubbleNumber> : null}
        {!hideDetails ? <Line /> : null}
        <BubbleText>{word}</BubbleText>
      </BubbleContainer>
    </TouchableOpacity>
  );
};

export default Bubble;
