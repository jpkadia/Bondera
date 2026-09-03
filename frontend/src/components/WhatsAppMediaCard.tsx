import { Image } from "expo-image";
import {
  Download,
  FileText,
  Film,
  Music,
  Play,
  Pause,
  ExternalLink,
  Trash2,
  Image as ImageIcon,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { styled } from "styled-components/native";

import { colors } from "@/theme";
import type { MessageMedia } from "@/types/api";
import {
  isMediaDownloadedSync,
  loadDownloadedMediaKeys,
  setMediaDownloaded,
  triggerDeviceDownload,
} from "@/services/mediaStorage";

interface WhatsAppMediaCardProps {
  media: MessageMedia;
  mine: boolean;
}

const Card = styled.View<{ $mine: boolean }>`
  width: 250px;
  max-width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background-color: ${({ $mine }) =>
    $mine ? "rgba(255, 255, 255, 0.12)" : colors.surfaceMuted};
  border-width: 1px;
  border-color: ${({ $mine }) =>
    $mine ? "rgba(255, 255, 255, 0.2)" : colors.border};
`;

const UndownloadedBox = styled.View`
  padding: 12px;
  gap: 10px;
  align-items: center;
  justify-content: center;
  min-height: 140px;
`;

const MediaIconBadge = styled.View<{ $mine: boolean }>`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  align-items: center;
  justify-content: center;
  background-color: ${({ $mine }) =>
    $mine ? "rgba(255, 255, 255, 0.22)" : colors.surface};
`;

const MediaMeta = styled.View`
  align-items: center;
  gap: 2px;
  width: 100%;
`;

const MediaTitle = styled.Text<{ $mine: boolean }>`
  color: ${({ $mine }) => ($mine ? colors.white : colors.ink)};
  font-size: 13px;
  font-weight: 800;
  text-align: center;
`;

const MediaSize = styled.Text<{ $mine: boolean }>`
  color: ${({ $mine }) =>
    $mine ? "rgba(255, 255, 255, 0.72)" : colors.inkMuted};
  font-size: 11px;
  font-weight: 600;
`;

const DownloadButton = styled(Pressable)<{ $mine: boolean }>`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 16px;
  border-radius: 20px;
  background-color: ${({ $mine }) =>
    $mine ? colors.white : colors.brand};
`;

const DownloadButtonText = styled.Text<{ $mine: boolean }>`
  color: ${({ $mine }) => ($mine ? colors.brandDark : colors.white)};
  font-size: 12px;
  font-weight: 900;
`;

const ImageContainer = styled.View`
  position: relative;
  width: 100%;
`;

const DisplayImage = styled(Image)`
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 7px;
`;

const ImageOverlayActions = styled.View`
  position: absolute;
  top: 6px;
  right: 6px;
  flex-direction: row;
  gap: 4px;
`;

const IconPill = styled(Pressable)`
  background-color: rgba(0, 0, 0, 0.55);
  padding: 5px;
  border-radius: 14px;
`;

const AudioCard = styled.View<{ $mine: boolean }>`
  padding: 10px 12px;
  gap: 8px;
`;

const AudioRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
`;

const PlayButton = styled(Pressable)<{ $mine: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: 18px;
  align-items: center;
  justify-content: center;
  background-color: ${({ $mine }) =>
    $mine ? colors.white : colors.brand};
`;

const AudioInfo = styled.View`
  flex: 1;
  min-width: 0;
  gap: 2px;
`;

const VideoCard = styled.View`
  position: relative;
  width: 100%;
`;

const VideoPlaceholder = styled.View<{ $mine: boolean }>`
  width: 100%;
  aspect-ratio: 16 / 9;
  align-items: center;
  justify-content: center;
  background-color: ${({ $mine }) =>
    $mine ? "rgba(0, 0, 0, 0.35)" : colors.black};
  border-radius: 7px;
`;

const DocCard = styled.View<{ $mine: boolean }>`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
`;

const DocInfo = styled.View`
  flex: 1;
  min-width: 0;
  gap: 2px;
`;

const BottomBar = styled.View<{ $mine: boolean }>`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-top-width: 1px;
  border-top-color: ${({ $mine }) =>
    $mine ? "rgba(255, 255, 255, 0.12)" : colors.border};
`;

const SmallActionText = styled.Text<{ $mine: boolean }>`
  color: ${({ $mine }) =>
    $mine ? "rgba(255, 255, 255, 0.72)" : colors.inkMuted};
  font-size: 10px;
  font-weight: 700;
`;

const FullscreenBackdrop = styled(SafeAreaView)`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.92);
  align-items: center;
  justify-content: center;
  padding: 16px;
`;

const FullscreenImage = styled(Image)`
  width: 100%;
  height: 80%;
`;

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function WhatsAppMediaCard({ media, mine }: WhatsAppMediaCardProps) {
  const mediaKey = media.id ?? media.url;
  const isSender = mine;
  const [downloaded, setDownloaded] = useState(
    isSender || isMediaDownloadedSync(mediaKey),
  );
  const [downloading, setDownloading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isSender) return;
    let mounted = true;
    void loadDownloadedMediaKeys().then((keys) => {
      if (mounted) {
        setDownloaded(keys.has(mediaKey));
      }
    });
    return () => {
      mounted = false;
    };
  }, [isSender, mediaKey]);


  const mime = (media.mimeType ?? "").toLowerCase();
  const isImage = media.resourceType === "image" || mime.startsWith("image/");
  const isAudio =
    mime.startsWith("audio/") ||
    (media.originalName && /\.(mp3|wav|ogg|m4a|aac)$/i.test(media.originalName));
  const isVideo =
    media.resourceType === "video" ||
    mime.startsWith("video/") ||
    (media.originalName && /\.(mp4|mov|webm|avi|mkv)$/i.test(media.originalName));

  const fileName =
    media.originalName ??
    (isImage
      ? "Image.jpg"
      : isAudio
        ? "Audio.mp3"
        : isVideo
          ? "Video.mp4"
          : "Document");

  const sizeText = useMemo(() => formatBytes(media.bytes), [media.bytes]);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await triggerDeviceDownload(media.url, fileName);
      await setMediaDownloaded(mediaKey, true);
      setDownloaded(true);
    } catch {
      // Fallback
    } finally {
      setDownloading(false);
    }
  };

  const handleRemoveCache = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
    await setMediaDownloaded(mediaKey, false);
    setDownloaded(false);
  };

  const toggleAudio = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (!audioRef.current) {
        audioRef.current = new Audio(media.url);
        audioRef.current.onended = () => setPlaying(false);
      }
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        void audioRef.current.play();
        setPlaying(true);
      }
    } else {
      void Linking.openURL(media.url);
    }
  };

  const openExternal = () => {
    void Linking.openURL(media.url);
  };

  const renderIcon = () => {
    if (isImage) return <ImageIcon size={22} color={mine ? colors.white : colors.brand} />;
    if (isAudio) return <Music size={22} color={mine ? colors.white : colors.brand} />;
    if (isVideo) return <Film size={22} color={mine ? colors.white : colors.brand} />;
    return <FileText size={22} color={mine ? colors.white : colors.brand} />;
  };

  if (!downloaded) {
    return (
      <Card $mine={mine}>
        <UndownloadedBox>
          <MediaIconBadge $mine={mine}>{renderIcon()}</MediaIconBadge>
          <MediaMeta>
            <MediaTitle $mine={mine} numberOfLines={1}>
              {fileName}
            </MediaTitle>
            {sizeText ? <MediaSize $mine={mine}>{sizeText}</MediaSize> : null}
          </MediaMeta>
          <DownloadButton
            $mine={mine}
            disabled={downloading}
            onPress={() => void handleDownload()}
          >
            {downloading ? (
              <ActivityIndicator
                size="small"
                color={mine ? colors.brandDark : colors.white}
              />
            ) : (
              <Download
                size={15}
                color={mine ? colors.brandDark : colors.white}
              />
            )}
            <DownloadButtonText $mine={mine}>
              {downloading ? "Downloading..." : "Download"}
            </DownloadButtonText>
          </DownloadButton>
        </UndownloadedBox>
      </Card>
    );
  }

  // DOWNLOADED STATE: Render based on media type
  return (
    <Card $mine={mine}>
      {isImage ? (
        <ImageContainer>
          <Pressable onPress={() => setFullscreenOpen(true)}>
            <DisplayImage source={{ uri: media.url }} contentFit="cover" />
          </Pressable>
          <ImageOverlayActions>
            <IconPill onPress={openExternal}>
              <ExternalLink size={13} color={colors.white} />
            </IconPill>
            {!isSender ? (
              <IconPill onPress={() => void handleRemoveCache()}>
                <Trash2 size={13} color={colors.white} />
              </IconPill>
            ) : null}
          </ImageOverlayActions>
        </ImageContainer>
      ) : isAudio ? (
        <AudioCard $mine={mine}>
          <AudioRow>
            <PlayButton $mine={mine} onPress={toggleAudio}>
              {playing ? (
                <Pause
                  size={18}
                  color={mine ? colors.brandDark : colors.white}
                />
              ) : (
                <Play
                  size={18}
                  color={mine ? colors.brandDark : colors.white}
                />
              )}
            </PlayButton>
            <AudioInfo>
              <MediaTitle $mine={mine} numberOfLines={1}>
                {fileName}
              </MediaTitle>
              <MediaSize $mine={mine}>
                {playing ? "Playing..." : sizeText || "Audio"}
              </MediaSize>
            </AudioInfo>
          </AudioRow>
          <BottomBar $mine={mine}>
            <Pressable onPress={openExternal}>
              <SmallActionText $mine={mine}>Open file</SmallActionText>
            </Pressable>
            {!isSender ? (
              <Pressable onPress={() => void handleRemoveCache()}>
                <SmallActionText $mine={mine}>Delete local</SmallActionText>
              </Pressable>
            ) : null}
          </BottomBar>
        </AudioCard>
      ) : isVideo ? (
        <VideoCard>
          <Pressable onPress={openExternal}>
            <VideoPlaceholder $mine={mine}>
              <PlayButton $mine={mine} onPress={openExternal}>
                <Play
                  size={20}
                  color={mine ? colors.brandDark : colors.white}
                />
              </PlayButton>
            </VideoPlaceholder>
          </Pressable>
          <BottomBar $mine={mine}>
            <MediaTitle $mine={mine} numberOfLines={1} style={{ flex: 1 }}>
              {fileName}
            </MediaTitle>
            {!isSender ? (
              <Pressable onPress={() => void handleRemoveCache()}>
                <SmallActionText $mine={mine}>Delete local</SmallActionText>
              </Pressable>
            ) : null}
          </BottomBar>
        </VideoCard>
      ) : (
        <DocCard $mine={mine}>
          <FileText size={28} color={mine ? colors.white : colors.brand} />
          <DocInfo>
            <MediaTitle $mine={mine} numberOfLines={1}>
              {fileName}
            </MediaTitle>
            <MediaSize $mine={mine}>{sizeText || "Document"}</MediaSize>
          </DocInfo>
          <Pressable onPress={openExternal}>
            <ExternalLink
              size={18}
              color={mine ? colors.white : colors.brand}
            />
          </Pressable>
        </DocCard>
      )}

      <Modal
        visible={fullscreenOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenOpen(false)}
      >
        <FullscreenBackdrop>
          <FullscreenImage
            source={{ uri: media.url }}
            contentFit="contain"
          />
          <Pressable
            style={{
              marginTop: 20,
              paddingHorizontal: 24,
              paddingVertical: 10,
              backgroundColor: colors.surface,
              borderRadius: 8,
            }}
            onPress={() => setFullscreenOpen(false)}
          >
            <MediaTitle $mine={false}>Close</MediaTitle>
          </Pressable>
        </FullscreenBackdrop>
      </Modal>
    </Card>
  );
}
