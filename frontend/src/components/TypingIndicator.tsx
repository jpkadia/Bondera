import { Animated, Easing } from "react-native";
import { useEffect, useState } from "react";
import { styled } from "styled-components/native";

import type { PublicUser } from "@/types/api";
import { colors } from "@/theme";
import { displayName } from "@/utils/format";
import { Avatar } from "./Avatar";

const Row = styled.View`
  min-height: 42px;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 5px 14px 7px;
  background-color: ${colors.canvas};
`;

const Bubble = styled.View`
  min-width: 54px;
  height: 32px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 12px;
  border-width: 1px;
  border-color: ${colors.border};
  border-radius: 16px;
  background-color: ${colors.surface};
`;

const Dot = styled(Animated.View)`
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background-color: ${colors.accentDark};
`;

export function TypingIndicator({ user }: { user: PublicUser }) {
  const [dots] = useState(() => [
    new Animated.Value(0.35),
    new Animated.Value(0.35),
    new Animated.Value(0.35),
  ]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel(
        dots.map((dot, index) =>
          Animated.sequence([
            Animated.delay(index * 130),
            Animated.timing(dot, {
              toValue: 1,
              duration: 220,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 0.35,
              duration: 260,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.delay((dots.length - index - 1) * 130),
          ]),
        ),
      ),
    );
    animation.start();
    return () => animation.stop();
  }, [dots]);

  return (
    <Row
      accessibilityLabel={`${displayName(user)} is typing`}
      accessibilityLiveRegion="polite"
    >
      <Avatar user={user} size={26} />
      <Bubble>
        {dots.map((dot, index) => (
          <Dot
            key={index}
            style={{
              opacity: dot,
              transform: [
                {
                  translateY: dot.interpolate({
                    inputRange: [0.35, 1],
                    outputRange: [1, -2],
                  }),
                },
              ],
            }}
          />
        ))}
      </Bubble>
    </Row>
  );
}
