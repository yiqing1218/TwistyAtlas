/**
 * 枚举 → 字典键 的集中映射。
 *
 * 分层考虑：domain / application / infrastructure 里只有枚举值（`ready-3d`、
 * `3x3-cfop`、`yellow`…），不许出现界面语言。翻译放在表现层这一处，
 * 组件调 `statusLabel()` 这类函数，而不是自己拼字符串键——拼出来的键
 * 过不了 `MessageKey` 的类型检查。
 */
import type { PuzzleStatus } from '@/domain/model/puzzle';
import type { BottomColor } from '@/domain/model/orientation';
import type { SetupMode } from '@/domain/model/formula';
import type { ExportFormat } from '@/application/timer/exportSolves';
import type { MessageKey } from './index';
import { t } from './index';

const PUZZLE_NAME_KEY: Record<string, MessageKey> = {
  '3x3x3': 'puzzle.3x3x3',
  '2x2x2': 'puzzle.2x2x2',
  '4x4x4': 'puzzle.4x4x4',
  '5x5x5': 'puzzle.5x5x5',
  '6x6x6': 'puzzle.6x6x6',
  '7x7x7': 'puzzle.7x7x7',
  pyraminx: 'puzzle.pyraminx',
  skewb: 'puzzle.skewb',
  megaminx: 'puzzle.megaminx',
  square1: 'puzzle.square1',
};

/** 魔方显示名；未知 id 原样返回（不要在界面上把它变成空字符串） */
export function puzzleName(id: string): string {
  const key = PUZZLE_NAME_KEY[id];
  return key ? t(key) : id;
}

const PUZZLE_NOTATION_KEY: Record<string, MessageKey> = {
  '3x3x3': 'puzzle.notation.3x3x3',
  '2x2x2': 'puzzle.notation.2x2x2',
  '4x4x4': 'puzzle.notation.4x4x4',
  '5x5x5': 'puzzle.notation.5x5x5',
  '6x6x6': 'puzzle.notation.6x6x6',
  '7x7x7': 'puzzle.notation.7x7x7',
  pyraminx: 'puzzle.notation.pyraminx',
  skewb: 'puzzle.notation.skewb',
  megaminx: 'puzzle.notation.megaminx',
  square1: 'puzzle.notation.square1',
};

export function puzzleNotation(id: string): string {
  const key = PUZZLE_NOTATION_KEY[id];
  return key ? t(key) : '';
}

const PUZZLE_NOTE_KEY: Record<string, MessageKey> = {
  '3x3x3': 'puzzle.note.3x3x3',
  '2x2x2': 'puzzle.note.2x2x2',
  '4x4x4': 'puzzle.note.4x4x4',
  '5x5x5': 'puzzle.note.5x5x5',
  '6x6x6': 'puzzle.note.6x6x6',
  '7x7x7': 'puzzle.note.7x7x7',
  pyraminx: 'puzzle.note.pyraminx',
  skewb: 'puzzle.note.skewb',
  megaminx: 'puzzle.note.megaminx',
  square1: 'puzzle.note.square1',
};

export function puzzleNote(id: string): string {
  const key = PUZZLE_NOTE_KEY[id];
  return key ? t(key) : '';
}

const STATUS_KEY: Record<PuzzleStatus, MessageKey> = {
  'ready-3d': 'settings.status.ready-3d',
  'ready-2d': 'settings.status.ready-2d',
  experimental: 'settings.status.experimental',
  unavailable: 'settings.status.unavailable',
};

export function statusLabel(status: PuzzleStatus): string {
  return t(STATUS_KEY[status]);
}

const SET_CATEGORY_KEY: Record<string, MessageKey> = {
  '3x3-cfop': 'sets.category.3x3-cfop',
  '3x3-advanced': 'sets.category.3x3-advanced',
  '2x2': 'sets.category.2x2',
  big: 'sets.category.big',
  exotic: 'sets.category.exotic',
};

export function setCategoryLabel(category: string): string {
  const key = SET_CATEGORY_KEY[category];
  return key ? t(key) : category;
}

const BOTTOM_COLOR_KEY: Record<BottomColor, MessageKey> = {
  yellow: 'bottom.yellow',
  white: 'bottom.white',
  blue: 'bottom.blue',
  green: 'bottom.green',
  red: 'bottom.red',
  orange: 'bottom.orange',
};

export function bottomColorLabel(color: BottomColor): string {
  return t(BOTTOM_COLOR_KEY[color]);
}

const EXPORT_FORMAT_KEY: Record<ExportFormat, MessageKey> = {
  csv: 'timer.exportFormat.csv',
  json: 'timer.exportFormat.json',
  text: 'timer.exportFormat.text',
};

export function exportFormatLabel(format: ExportFormat): string {
  return t(EXPORT_FORMAT_KEY[format]);
}

const SETUP_MODE_LABEL_KEY: Record<SetupMode, MessageKey> = {
  solved: 'editor.setupSolved',
  inverse: 'editor.setupInverse',
  explicit: 'editor.setupExplicit',
};

const SETUP_MODE_HINT_KEY: Record<SetupMode, MessageKey> = {
  solved: 'editor.setupSolvedHint',
  inverse: 'editor.setupInverseHint',
  explicit: 'editor.setupExplicitHint',
};

export function setupModeLabel(mode: SetupMode): string {
  return t(SETUP_MODE_LABEL_KEY[mode]);
}

export function setupModeHint(mode: SetupMode): string {
  return t(SETUP_MODE_HINT_KEY[mode]);
}

const SETUP_MODE_SHORT_KEY: Record<SetupMode, MessageKey> = {
  solved: 'list.setupSolved',
  inverse: 'list.setupInverse',
  explicit: 'list.setupCustom',
};

/** 列表徽标用的短标签（「复原态」而不是「从复原态开始」） */
export function setupModeShort(mode: SetupMode): string {
  return t(SETUP_MODE_SHORT_KEY[mode]);
}
