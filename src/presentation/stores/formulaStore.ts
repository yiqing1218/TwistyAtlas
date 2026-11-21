import { defineStore } from 'pinia';
import type { FormulaCategory, FormulaDraft, FormulaFilter, FormulaRecord } from '@/domain/model/formula';
import {
  DEFAULT_FILTER,
  createCategory,
  createFormula,
  deleteCategory,
  deleteFormula,
  duplicateFormula,
  getFormula,
  listCategories,
  listFormulas,
  listTags,
  renameCategory,
  restoreFormula,
  setFavorite,
  updateFormula,
} from '@/infrastructure/persistence/formulaRepository';

export const useFormulaStore = defineStore('formula', {
  state: () => ({
    formulas: [] as FormulaRecord[],
    categories: [] as FormulaCategory[],
    tags: [] as string[],
    filter: { ...DEFAULT_FILTER } as FormulaFilter,
    selectedId: null as string | null,
    loading: false,
    error: null as string | null,
    initialized: false,
    /** 最近删除的记录，用于"撤销" */
    lastDeleted: null as FormulaRecord | null,
  }),
  getters: {
    selected(state): FormulaRecord | undefined {
      return state.formulas.find((f) => f.id === state.selectedId);
    },
    categoryName(state) {
      const map = new Map(state.categories.map((c) => [c.id, c.name]));
      return (id: string) => map.get(id) ?? '';
    },
    favoriteCount(state): number {
      return state.formulas.filter((f) => f.favorite).length;
    },
  },
  actions: {
    async refresh() {
      this.loading = true;
      this.error = null;
      try {
        const [formulas, categories, tags] = await Promise.all([
          listFormulas(this.filter),
          listCategories(this.filter.puzzleId ?? undefined),
          listTags(this.filter.puzzleId ?? undefined),
        ]);
        this.formulas = formulas;
        this.categories = categories;
        this.tags = tags;
        if (this.selectedId && !formulas.some((f) => f.id === this.selectedId)) {
          // 当前选中项被过滤掉或已删除时，保留选中但不清空详情
          const still = await getFormula(this.selectedId);
          if (!still) this.selectedId = null;
        }
        if (!this.selectedId && formulas.length > 0) {
          this.selectedId = formulas[0].id;
        }
      } catch (err) {
        this.error = `读取公式库失败：${(err as Error).message}`;
      } finally {
        this.loading = false;
      }
    },
    async setFilter(patch: Partial<FormulaFilter>) {
      const puzzleChanged =
        patch.puzzleId !== undefined && patch.puzzleId !== this.filter.puzzleId;
      this.filter = { ...this.filter, ...patch };
      if (puzzleChanged) {
        this.filter.categoryId = null;
        this.selectedId = null;
      }
      await this.refresh();
    },
    async select(id: string | null) {
      this.selectedId = id;
    },
    async create(draft: FormulaDraft): Promise<FormulaRecord> {
      const record = await createFormula(draft);
      await this.refresh();
      this.selectedId = record.id;
      return record;
    },
    async update(id: string, draft: FormulaDraft): Promise<FormulaRecord> {
      const record = await updateFormula(id, draft);
      await this.refresh();
      return record;
    },
    async duplicate(id: string): Promise<FormulaRecord> {
      const record = await duplicateFormula(id);
      await this.refresh();
      this.selectedId = record.id;
      return record;
    },
    async remove(id: string) {
      const record = await getFormula(id);
      if (!record) return;
      await deleteFormula(id);
      this.lastDeleted = record;
      if (this.selectedId === id) this.selectedId = null;
      await this.refresh();
    },
    async undoDelete() {
      if (!this.lastDeleted) return;
      await restoreFormula(this.lastDeleted);
      this.selectedId = this.lastDeleted.id;
      this.lastDeleted = null;
      await this.refresh();
    },
    async toggleFavorite(id: string) {
      const record = this.formulas.find((f) => f.id === id) ?? (await getFormula(id));
      if (!record) return;
      await setFavorite(id, !record.favorite);
      await this.refresh();
    },
    async addCategory(name: string, puzzleId: string) {
      await createCategory(puzzleId, name);
      this.categories = await listCategories(this.filter.puzzleId ?? puzzleId);
    },
    async renameCategoryAction(id: string, name: string) {
      await renameCategory(id, name);
      this.categories = await listCategories(this.filter.puzzleId ?? undefined);
    },
    async removeCategory(id: string) {
      await deleteCategory(id);
      if (this.filter.categoryId === id) this.filter.categoryId = null;
      await this.refresh();
    },
  },
});
