<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { useFormulaStore } from '@/presentation/stores/formulaStore';
import { usePlayerStore } from '@/presentation/stores/playerStore';
import { useSettingsStore } from '@/presentation/stores/settingsStore';
import { EMPTY_DRAFT, SETUP_MODE_HINT, SETUP_MODE_LABEL, type FormulaDraft, type FormulaRecord, type SetupMode } from '@/domain/model/formula';
import { parseFormulaLocal } from '@/infrastructure/cubing/algService';
import { getPuzzleDescriptor, isPuzzlePlayable } from '@/infrastructure/cubing/puzzleRegistry';
import { recordToDraft } from '@/infrastructure/persistence/formulaRepository';
import PuzzlePicker from '@/presentation/components/PuzzlePicker.vue';

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
    errorMessage.value = parsed.error ?? '公式无法解析';
    return;
  }
  errorMessage.value = null;
  previewNote.value = null;
  await player.loadFormula({
    puzzleId: form.puzzleId,
    title: form.title || '（未命名预览）',
    alg: form.alg,
    setupMode: form.setupMode,
    setupAlg: form.setupAlg,
  });
  previewNote.value = player.loadError
    ? `预览失败：${player.loadError}`
    : `已装载预览：${parsed.tokens.length} 个动作（尚未保存）`;
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
  const name = window.prompt('新分类名称');
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
      <div class="dialog dialog--wide" role="dialog" aria-modal="true" :aria-label="isEdit ? '编辑公式' : '新建公式'">
        <header class="dialog__header">
          <h2 class="dialog__title">{{ isEdit ? '编辑公式' : '新建公式' }}</h2>
          <button type="button" class="btn btn--ghost btn--icon" aria-label="关闭" @click="close">✕</button>
        </header>

        <div class="dialog__body">
          <div class="grid-2">
            <div class="field">
              <label class="field__label" for="formula-title">公式名称 *</label>
              <input id="formula-title" ref="titleInput" v-model="form.title" class="input" placeholder="例如：右手四步" data-testid="input-title" />
            </div>
            <div class="field">
              <label class="field__label" for="formula-puzzle">魔方类型 *</label>
              <PuzzlePicker v-model="form.puzzleId" compact />
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="formula-alg">公式 *</label>
            <textarea
              id="formula-alg"
              v-model="form.alg"
              class="textarea textarea--mono"
              rows="2"
              spellcheck="false"
              placeholder="例如：R U R' U'"
              data-testid="input-alg"
            ></textarea>
            <p v-if="form.alg.trim()" class="field__hint">
              <template v-if="algInfo.ok">
                解析成功：{{ algInfo.tokens.length }} 个动作 · 规范化后
                <code class="mono">{{ algInfo.canonical }}</code>
              </template>
              <template v-else>
                <span class="field__error">{{ algInfo.error }}</span>
              </template>
            </p>
            <p v-else class="field__hint">支持 R L U D F B、' 逆时针、2 半转、M E S、x y z、Rw 宽层与括号重复。</p>
            <p v-if="puzzleDescriptor" class="field__hint">记号说明：{{ puzzleDescriptor.notationHelp }}</p>
            <p v-if="!playable" class="alert alert--warning">
              该魔方类型当前没有通过三维播放验收，公式可以保存为文本，但播放按钮会给出提示。
            </p>
          </div>

          <fieldset class="fieldset">
            <legend class="field__label">初始状态 *</legend>
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
                  <strong>{{ SETUP_MODE_LABEL[mode] }}</strong>
                  <small class="muted">{{ SETUP_MODE_HINT[mode] }}</small>
                </span>
              </label>
            </div>
            <div v-if="form.setupMode === 'explicit'" class="field">
              <label class="field__label" for="formula-setup">setup 公式 *</label>
              <textarea
                id="formula-setup"
                v-model="form.setupAlg"
                class="textarea textarea--mono"
                rows="2"
                spellcheck="false"
                placeholder="例如：R U2 D' B D'"
                data-testid="input-setup"
              ></textarea>
              <p v-if="setupInfo" class="field__hint">
                <template v-if="setupInfo.ok">{{ setupInfo.tokens.length }} 个动作</template>
                <template v-else><span class="field__error">{{ setupInfo.error }}</span></template>
              </p>
            </div>
          </fieldset>

          <div class="grid-2">
            <div class="field">
              <label class="field__label" for="formula-category">分类</label>
              <div class="row">
                <select id="formula-category" v-model="form.categoryId" class="select">
                  <option value="">未分类</option>
                  <option v-for="category in store.categories" :key="category.id" :value="category.id">
                    {{ category.name }}
                  </option>
                </select>
                <button type="button" class="btn btn--sm" @click="addCategory">新建</button>
              </div>
            </div>
            <div class="field">
              <label class="field__label" for="formula-tags">标签</label>
              <input id="formula-tags" v-model="tagsText" class="input" placeholder="用逗号分隔，例如：基础, 手法" data-testid="input-tags" />
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="formula-desc">说明</label>
            <textarea id="formula-desc" v-model="form.description" class="textarea" rows="3" placeholder="这条公式的用途、注意事项…" data-testid="input-description"></textarea>
          </div>

          <div class="grid-2">
            <div class="field">
              <label class="field__label" for="formula-source-name">来源名称</label>
              <input id="formula-source-name" v-model="form.sourceName" class="input" placeholder="可选" />
            </div>
            <div class="field">
              <label class="field__label" for="formula-source-url">来源链接</label>
              <input id="formula-source-url" v-model="form.sourceUrl" class="input" placeholder="https://…（可选）" />
            </div>
          </div>

          <div class="row row--between">
            <label class="field" style="max-width: 160px">
              <span class="field__label">难度</span>
              <select v-model="form.difficulty" class="select">
                <option :value="undefined">未设置</option>
                <option v-for="n in 5" :key="n" :value="n">{{ '★'.repeat(n) }}</option>
              </select>
            </label>
            <label class="checkbox-row">
              <input v-model="form.favorite" type="checkbox" />
              加入收藏
            </label>
          </div>

          <p v-if="errorMessage" class="alert alert--error" data-testid="editor-error">{{ errorMessage }}</p>
          <p v-if="previewNote" class="alert">{{ previewNote }}</p>
        </div>

        <footer class="dialog__footer">
          <button type="button" class="btn" :disabled="!algInfo.ok" @click="preview">预览</button>
          <span class="spacer"></span>
          <button type="button" class="btn" @click="close">取消</button>
          <button type="button" class="btn btn--primary" :disabled="saving" data-testid="btn-save-formula" @click="submit">
            {{ saving ? '保存中…' : '保存' }}
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
