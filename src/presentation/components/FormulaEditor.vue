<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { useFormulaStore } from '@/presentation/stores/formulaStore';
import { usePlayerStore } from '@/presentation/stores/playerStore';
import { useSettingsStore } from '@/presentation/stores/settingsStore';
import { EMPTY_DRAFT, type FormulaDraft, type FormulaRecord, type SetupMode } from '@/domain/model/formula';
import { parseFormulaLocal } from '@/infrastructure/cubing/algService';
import { getPuzzleDescriptor, isPuzzlePlayable } from '@/infrastructure/cubing/puzzleRegistry';
import { recordToDraft } from '@/infrastructure/persistence/formulaRepository';
import PuzzlePicker from '@/presentation/components/PuzzlePicker.vue';
import { useI18n } from '@/presentation/i18n';
import { puzzleNotation, setupModeLabel, setupModeHint } from '@/presentation/i18n/labels';

const { t } = useI18n();
const props = defineProps<{
  open: boolean;
  record?: FormulaRecord | null;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'saved', record: FormulaRecord): void;
}>();

const store = useFormulaStore();
const player = usePlayerStore();
const settings = useSettingsStore();

const form = reactive<FormulaDraft>({ ...EMPTY_DRAFT });
const tagsText = ref('');
const errorMessage = ref<string | null>(null);
const saving = ref(false);
const previewNote = ref<string | null>(null);
const titleInput = ref<HTMLInputElement | null>(null);

const isEdit = computed(() => Boolean(props.record));
const setupModes: SetupMode[] = ['solved', 'inverse', 'explicit'];

const algInfo = computed(() => parseFormulaLocal(form.alg));
const setupInfo = computed(() =>
  form.setupMode === 'explicit' && form.setupAlg.trim() ? parseFormulaLocal(form.setupAlg) : null,
);

const puzzleDescriptor = computed(() => getPuzzleDescriptor(form.puzzleId));
const playable = computed(() => isPuzzlePlayable(form.puzzleId));
const customSetupAvailable = computed(() => puzzleDescriptor.value?.supportsCustomSetup ?? true);

function reset() {
  const base = props.record ? recordToDraft(props.record) : { ...EMPTY_DRAFT, puzzleId: settings.settings.defaultPuzzleId };
  Object.assign(form, base);
  tagsText.value = base.tags.join(', ');
  errorMessage.value = null;
  previewNote.value = null;
  saving.value = false;
  if (!base.categoryId && store.categories.length > 0) {
    form.categoryId = store.categories[0].id;
  }
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    reset();
    await nextTick();
    titleInput.value?.focus();
  },
);

watch(
  () => form.puzzleId,
  () => {
    // 切换魔方类型后，原来选择的分类可能不属于新类型
    const belongs = store.categories.some((c) => c.id === form.categoryId && c.puzzleId === form.puzzleId);
    if (!belongs) form.categoryId = '';
    if (!customSetupAvailable.value && form.setupMode === 'explicit') form.setupMode = 'solved';
  },
);

watch(
  () => form.setupMode,
  (mode) => {
    if (mode !== 'explicit') form.setupAlg = '';
  },
);

function close() {
  if (saving.value) return;
  emit('close');
}

function parseTags(text: string): string[] {
  return text
    .split(/[,，、\s]+/)
    .map((t) => t.replace(/^#/, '').trim())
    .filter(Boolean);
}

async function preview() {
  const parsed = parseFormulaLocal(form.alg);
  if (!parsed.ok) {
    errorMessage.value = parsed.error ?? t('editor.parseFailed');
    return;
  }
  errorMessage.value = null;
  previewNote.value = null;
  await player.loadFormula({
    puzzleId: form.puzzleId,
    title: form.title || t('editor.untitledPreview'),
    alg: form.alg,
    setupMode: form.setupMode,
    setupAlg: form.setupAlg,
  });
  previewNote.value = player.loadError
    ? t('editor.previewFailed', { message: player.loadError })
    : t('editor.previewLoaded', { n: parsed.tokens.length });
}

async function submit() {
  if (saving.value) return;
  saving.value = true;
  errorMessage.value = null;
  const draft: FormulaDraft = {
    ...form,
    tags: parseTags(tagsText.value),
    setupAlg: form.setupMode === 'explicit' ? form.setupAlg : '',
  };
  try {
    const saved = props.record ? await store.update(props.record.id, draft) : await store.create(draft);
    emit('saved', saved);
    emit('close');
  } catch (err) {
    errorMessage.value = (err as Error).message;
  } finally {
    saving.value = false;
  }
}

async function addCategory() {
  const name = window.prompt(t('editor.newCategoryPrompt'));
  if (!name?.trim()) return;
  try {
    await store.addCategory(name.trim(), form.puzzleId);
    const created = store.categories.find((c) => c.name === name.trim() && c.puzzleId === form.puzzleId);
    if (created) form.categoryId = created.id;
  } catch (err) {
    errorMessage.value = (err as Error).message;
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" @click.self="close" @keydown.esc="close">
      <div class="dialog dialog--wide" role="dialog" aria-modal="true" :aria-label="isEdit ? t('editor.titleEdit') : t('editor.titleNew')">
        <header class="dialog__header">
          <h2 class="dialog__title">{{ isEdit ? t('editor.titleEdit') : t('editor.titleNew') }}</h2>
          <button type="button" class="btn btn--ghost btn--icon" :aria-label="t('common.close')" @click="close">✕</button>
        </header>

        <div class="dialog__body">
          <div class="grid-2">
            <div class="field">
              <label class="field__label" for="formula-title">{{ t('editor.name') }}</label>
              <input id="formula-title" ref="titleInput" v-model="form.title" class="input" :placeholder="t('editor.namePlaceholder')" data-testid="input-title" />
            </div>
            <div class="field">
              <label class="field__label" for="formula-puzzle">{{ t('editor.puzzle') }}</label>
              <PuzzlePicker v-model="form.puzzleId" compact />
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="formula-alg">{{ t('editor.alg') }}</label>
            <textarea
              id="formula-alg"
              v-model="form.alg"
              class="textarea textarea--mono"
              rows="2"
              spellcheck="false"
              :placeholder="t('editor.algPlaceholder')"
              data-testid="input-alg"
            ></textarea>
            <p v-if="form.alg.trim()" class="field__hint">
              <template v-if="algInfo.ok">
                {{ t('editor.parsed', { n: algInfo.tokens.length }) }}
                <code class="mono">{{ algInfo.canonical }}</code>
              </template>
              <template v-else>
                <span class="field__error">{{ algInfo.error }}</span>
              </template>
            </p>
            <p v-else class="field__hint">{{ t('editor.algHint') }}</p>
            <p v-if="puzzleDescriptor" class="field__hint">{{ t('editor.notation', { help: puzzleNotation(form.puzzleId) }) }}</p>
            <p v-if="!playable" class="alert alert--warning">{{ t('editor.unsupported') }}</p>
          </div>

          <fieldset class="fieldset">
            <legend class="field__label">{{ t('editor.setupMode') }}</legend>
            <div class="setup-modes">
              <label
                v-for="mode in setupModes"
                :key="mode"
                class="setup-mode"
                :class="{ 'setup-mode--disabled': mode === 'explicit' && !customSetupAvailable }"
              >
                <input
                  v-model="form.setupMode"
                  type="radio"
                  name="setup-mode"
                  :value="mode"
                  :disabled="mode === 'explicit' && !customSetupAvailable"
                />
                <span>
                  <strong>{{ setupModeLabel(mode) }}</strong>
                  <small class="muted">{{ setupModeHint(mode) }}</small>
                </span>
              </label>
            </div>
            <div v-if="form.setupMode === 'explicit'" class="field">
              <label class="field__label" for="formula-setup">{{ t('editor.setupAlg') }}</label>
              <textarea
                id="formula-setup"
                v-model="form.setupAlg"
                class="textarea textarea--mono"
                rows="2"
                spellcheck="false"
                :placeholder="t('editor.setupPlaceholder')"
                data-testid="input-setup"
              ></textarea>
              <p v-if="setupInfo" class="field__hint">
                <template v-if="setupInfo.ok">{{ t('common.moves', { n: setupInfo.tokens.length }) }}</template>
                <template v-else><span class="field__error">{{ setupInfo.error }}</span></template>
              </p>
            </div>
          </fieldset>

          <div class="grid-2">
            <div class="field">
              <label class="field__label" for="formula-category">{{ t('editor.category') }}</label>
              <div class="row">
                <select id="formula-category" v-model="form.categoryId" class="select">
                  <option value="">{{ t('editor.uncategorized') }}</option>
                  <option v-for="category in store.categories" :key="category.id" :value="category.id">
                    {{ category.name }}
                  </option>
                </select>
                <button type="button" class="btn btn--sm" @click="addCategory">{{ t('common.new') }}</button>
              </div>
            </div>
            <div class="field">
              <label class="field__label" for="formula-tags">{{ t('editor.tags') }}</label>
              <input id="formula-tags" v-model="tagsText" class="input" :placeholder="t('editor.tagsPlaceholder')" data-testid="input-tags" />
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="formula-desc">{{ t('editor.description') }}</label>
            <textarea id="formula-desc" v-model="form.description" class="textarea" rows="3" :placeholder="t('editor.descriptionPlaceholder')" data-testid="input-description"></textarea>
          </div>

          <div class="grid-2">
            <div class="field">
              <label class="field__label" for="formula-source-name">{{ t('editor.sourceName') }}</label>
              <input id="formula-source-name" v-model="form.sourceName" class="input" :placeholder="t('common.optional')" />
            </div>
            <div class="field">
              <label class="field__label" for="formula-source-url">{{ t('editor.sourceUrl') }}</label>
              <input id="formula-source-url" v-model="form.sourceUrl" class="input" placeholder="https://…" />
            </div>
          </div>

          <div class="row row--between">
            <label class="field" style="max-width: 160px">
              <span class="field__label">{{ t('editor.level') }}</span>
              <select v-model="form.difficulty" class="select">
                <option :value="undefined">{{ t('editor.levelUnset') }}</option>
                <option v-for="n in 5" :key="n" :value="n">{{ '★'.repeat(n) }}</option>
              </select>
            </label>
            <label class="checkbox-row">
              <input v-model="form.favorite" type="checkbox" />
              {{ t('editor.addFavorite') }}
            </label>
          </div>

          <p v-if="errorMessage" class="alert alert--error" data-testid="editor-error">{{ errorMessage }}</p>
          <p v-if="previewNote" class="alert">{{ previewNote }}</p>
        </div>

        <footer class="dialog__footer">
          <button type="button" class="btn" :disabled="!algInfo.ok" @click="preview">{{ t('common.preview') }}</button>
          <span class="spacer"></span>
          <button type="button" class="btn" @click="close">{{ t('common.cancel') }}</button>
          <button type="button" class="btn btn--primary" :disabled="saving" data-testid="btn-save-formula" @click="submit">
            {{ saving ? t('common.saving') : t('common.save') }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.fieldset {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-3);
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.setup-modes {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setup-mode {
  display: flex;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.setup-mode:has(input:checked) {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.setup-mode--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.setup-mode strong {
  display: block;
  font-size: 13px;
}

.setup-mode small {
  display: block;
  font-size: 12px;
  line-height: 1.4;
}

.row--between {
  justify-content: space-between;
  align-items: flex-end;
}

@media (max-width: 640px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
}
</style>
