import {
  ImageManipulator,
  SaveFormat,
} from "expo-image-manipulator";
import { Image } from "expo-image";
import { Minus, Plus, RotateCcw, X } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  type GestureResponderEvent,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { styled } from "styled-components/native";

import {
  calculateCropRectangle,
  clampCropOffset,
  clampCropZoom,
  coverScale,
  type CropOffset,
} from "@/services/profile-crop";
import { colors } from "@/theme";
import { IconButton } from "./IconButton";

export interface ProfileCropSource {
  uri: string;
  width: number;
  height: number;
  fileName?: string | null;
}

export interface CroppedProfilePhoto {
  uri: string;
  fileName: string;
  mimeType: "image/jpeg";
}

interface ProfilePhotoCropModalProps {
  source: ProfileCropSource;
  onCancel(): void;
  onConfirm(photo: CroppedProfilePhoto): Promise<void> | void;
}

const Backdrop = styled(SafeAreaView)<{ $compact: boolean }>`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: ${({ $compact }) => ($compact ? "10px" : "18px")};
  background-color: rgba(0, 0, 0, 0.78);
`;

const Dialog = styled.View<{ $compact: boolean }>`
  width: 100%;
  max-width: 420px;
  align-items: center;
  gap: ${({ $compact }) => ($compact ? "8px" : "14px")};
  padding: ${({ $compact }) => ($compact ? "12px" : "18px")};
  border-radius: 14px;
  background-color: ${colors.surface};
`;

const Header = styled.View`
  width: 100%;
  flex-direction: row;
  align-items: center;
  gap: 10px;
`;

const HeaderCopy = styled.View`
  flex: 1;
  min-width: 0;
`;

const Title = styled.Text`
  color: ${colors.ink};
  font-size: 18px;
  font-weight: 900;
`;

const Help = styled.Text`
  color: ${colors.inkMuted};
  font-size: 12px;
  line-height: 17px;
`;

const ErrorText = styled.Text`
  width: 100%;
  color: ${colors.coral};
  font-size: 12px;
  line-height: 17px;
  text-align: center;
`;

const CropViewport = styled.View<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  position: relative;
  overflow: hidden;
  border-width: 3px;
  border-color: ${colors.brand};
  border-radius: ${({ $size }) => $size / 2}px;
  background-color: ${colors.black};
`;

const GuideVertical = styled.View`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background-color: rgba(255, 255, 255, 0.34);
`;

const GuideHorizontal = styled.View`
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background-color: rgba(255, 255, 255, 0.34);
`;

const ZoomRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

const ZoomValue = styled.Text`
  min-width: 54px;
  color: ${colors.ink};
  font-size: 13px;
  font-weight: 800;
  text-align: center;
`;

const Footer = styled.View`
  width: 100%;
  flex-direction: row;
  gap: 9px;
`;

const Button = styled(Pressable)<{ $primary?: boolean }>`
  flex: 1;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  border-width: 1px;
  border-color: ${({ $primary }) => ($primary ? colors.brand : colors.border)};
  border-radius: 8px;
  background-color: ${({ $primary }) =>
    $primary ? colors.brand : colors.surface};
`;

const ButtonText = styled.Text<{ $primary?: boolean }>`
  color: ${({ $primary }) => ($primary ? colors.white : colors.ink)};
  font-size: 14px;
  font-weight: 900;
`;

export function ProfilePhotoCropModal({
  source,
  onCancel,
  onConfirm,
}: ProfilePhotoCropModalProps) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const compactHeight = windowHeight < 520;
  const viewportSize = Math.max(
    100,
    Math.min(300, windowWidth - 76, windowHeight - (compactHeight ? 190 : 220)),
  );
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const offsetRef = useRef(offset);
  const dragStartOffset = useRef(offset);
  const dragStartPoint = useRef({ x: 0, y: 0 });

  const updateOffset = useCallback(
    (next: CropOffset, atZoom = zoom) => {
      const clamped = clampCropOffset(source, viewportSize, atZoom, next);
      offsetRef.current = clamped;
      setOffset(clamped);
    },
    [source, viewportSize, zoom],
  );

  const startDragging = (event: GestureResponderEvent) => {
    dragStartOffset.current = offsetRef.current;
    dragStartPoint.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    };
  };

  const moveCrop = (event: GestureResponderEvent) => {
    updateOffset({
      x:
        dragStartOffset.current.x +
        event.nativeEvent.pageX -
        dragStartPoint.current.x,
      y:
        dragStartOffset.current.y +
        event.nativeEvent.pageY -
        dragStartPoint.current.y,
    });
  };

  const changeZoom = (delta: number) => {
    const nextZoom = clampCropZoom(Number((zoom + delta).toFixed(2)));
    setZoom(nextZoom);
    updateOffset(offsetRef.current, nextZoom);
  };

  const reset = () => {
    setZoom(1);
    updateOffset({ x: 0, y: 0 }, 1);
  };

  const confirm = async () => {
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      const crop = calculateCropRectangle(
        source,
        viewportSize,
        zoom,
        offsetRef.current,
      );
      const context = ImageManipulator.manipulate(source.uri);
      context.crop(crop).resize({ width: 512, height: 512 });
      const rendered = await context.renderAsync();
      const result = await rendered.saveAsync({
        compress: 0.9,
        format: SaveFormat.JPEG,
      });
      await onConfirm({
        uri: result.uri,
        fileName: `${source.fileName?.replace(/\.[^.]+$/, "") || "profile"}-cropped.jpg`,
        mimeType: "image/jpeg",
      });
    } catch {
      setError("The photo could not be cropped or uploaded. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const scale = coverScale(source, viewportSize) * zoom;
  const displayedWidth = source.width * scale;
  const displayedHeight = source.height * scale;

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={() => !saving && onCancel()}
    >
      <Backdrop $compact={compactHeight}>
        <Dialog $compact={compactHeight}>
          <Header>
            <HeaderCopy>
              <Title>Crop profile photo</Title>
              <Help>Drag to reposition. Use zoom controls for a precise circular crop.</Help>
            </HeaderCopy>
            <IconButton
              icon={X}
              label="Cancel profile photo crop"
              onPress={() => !saving && onCancel()}
            />
          </Header>

          <CropViewport
            $size={viewportSize}
            onStartShouldSetResponder={() => !saving}
            onMoveShouldSetResponder={() => !saving}
            onResponderGrant={startDragging}
            onResponderMove={moveCrop}
          >
            <Image
              source={{ uri: source.uri }}
              contentFit="fill"
              style={{
                position: "absolute",
                width: displayedWidth,
                height: displayedHeight,
                left: (viewportSize - displayedWidth) / 2 + offset.x,
                top: (viewportSize - displayedHeight) / 2 + offset.y,
              }}
            />
            <GuideVertical pointerEvents="none" />
            <GuideHorizontal pointerEvents="none" />
          </CropViewport>

          <ZoomRow>
            <IconButton
              icon={Minus}
              label="Zoom out"
              disabled={saving || zoom <= 1}
              onPress={() => changeZoom(-0.15)}
            />
            <ZoomValue>{Math.round(zoom * 100)}%</ZoomValue>
            <IconButton
              icon={Plus}
              label="Zoom in"
              disabled={saving || zoom >= 4}
              onPress={() => changeZoom(0.15)}
            />
            <IconButton
              icon={RotateCcw}
              label="Reset crop"
              disabled={saving}
              onPress={reset}
            />
          </ZoomRow>

          {error ? <ErrorText accessibilityRole="alert">{error}</ErrorText> : null}

          <Footer>
            <Button disabled={saving} onPress={onCancel}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button $primary disabled={saving} onPress={() => void confirm()}>
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <ButtonText $primary>Use photo</ButtonText>
              )}
            </Button>
          </Footer>
        </Dialog>
      </Backdrop>
    </Modal>
  );
}
