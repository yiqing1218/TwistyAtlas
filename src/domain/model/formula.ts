export type SetupMode = 'solved' | 'inverse' | 'explicit';

export const SETUP_MODE_LABEL: Record<SetupMode, string> = {
  solved: '从复原态开始',
  inverse: '以逆公式作为初始态',
  explicit: '自定义初始状态（setup）',
};

export const SETUP_MODE_HINT: Record<SetupMode, string> = {
  solved: '魔方处于复原态，直接播放该公式，展示它对魔方的作用。',
  inverse: '先应用该公式的逆变换生成初始态，再播放公式本身；用于演示"如何解回"。',
  explicit: '先用自定义 setup 公式打乱，再播放公式；用于精确复刻 OLL / PLL / F2L 案例。',
};

export interface FormulaRecord {
  id: string;
  schemaVersion: number;
  puzzleId: string;
  title: string;
  alg: string;
  setupMode: SetupMode;
  setupAlg: string;
  categoryId: string;
  tags: string[];
  description: string;
  sourceName?: string;
  sourceUrl?: string;
  favorite: boolean;
  difficulty?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormulaCategory {
  id: string;
  puzzleId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
}

export const CURRENT_SCHEMA_VERSION = 1;

export interface FormulaDraft {
  puzzleId: string;
  title: string;
  alg: string;
  setupMode: SetupMode;
  setupAlg: string;
  categoryId: string;
  tags: string[];
  description: string;
  sourceName: string;
  sourceUrl: string;
  favorite: boolean;
  difficulty?: number;
}

export const EMPTY_DRAFT: FormulaDraft = {
  puzzleId: '3x3x3',
  title: '',
  alg: '',
  setupMode: 'solved',
  setupAlg: '',
  categoryId: '',
  tags: [],
  description: '',
  sourceName: '',
  sourceUrl: '',
  favorite: false,
  difficulty: undefined,
};

export interface FormulaFilter {
  puzzleId: string | null;
  categoryId: string | null;
  favoriteOnly: boolean;
  tag: string | null;
  search: string;
  sortBy: 'updatedAt' | 'title' | 'category';
}

export interface BackupBundle {
  format: 'twisty-atlas-backup';
  formatVersion: number;
  exportedAt: string;
  appVersion?: string;
  formulas: FormulaRecord[];
  categories: FormulaCategory[];
  settings?: Record<string, unknown>;
}

export interface ImportPreviewItem {
  kind: 'new' | 'duplicate' | 'invalid';
  reason?: string;
  record: FormulaRecord;
  duplicateOfId?: string;
}

export interface ImportPreview {
  total: number;
  items: ImportPreviewItem[];
  categories: FormulaCategory[];
  settings?: Record<string, unknown>;
  format: 'json' | 'csv';
}
