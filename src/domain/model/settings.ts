export interface CameraSettings {
  latitude: number;
  longitude: number;
  distance: number;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export type ColorSchemeId = 'standard' | 'custom';

export interface FaceColorMap {
  U: string;
  D: string;
  F: string;
  B: string;
  R: string;
  L: string;
}

export interface AppSettings {
  theme: ThemeMode;
  colorScheme: ColorSchemeId;
  /** 表面颜色映射。只影响贴纸颜色，不影响转动方向与状态模型。 */
  faceColors: FaceColorMap;
  playbackSpeed: number;
  defaultPuzzleId: string;
  showHintFacelets: boolean;
  /** 是否在播放时锁定镜头视角（禁止拖动旋转） */
  lockCamera: boolean;
  preferredCamera?: Partial<CameraSettings>;
}

export const STANDARD_COLORS: FaceColorMap = {
  U: '#ffffff',
  D: '#ffd500',
  F: '#009b48',
  B: '#0046ad',
  R: '#b71234',
  L: '#ff5800',
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  colorScheme: 'standard',
  faceColors: { ...STANDARD_COLORS },
  playbackSpeed: 1,
  defaultPuzzleId: '3x3x3',
  showHintFacelets: false,
  lockCamera: false,
};

export const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.5, 2] as const;
