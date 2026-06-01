<template>
  <form class="dialogue-workspace" @submit.prevent="$emit('submit')">
    <aside class="dialogue-rail">
      <div class="dialogue-rail-head">
        <div class="dialogue-rail-title">
          <span>会话</span>
          <small>{{ sessions.length }} 条</small>
        </div>
        <div class="dialogue-rail-actions">
          <button type="button" class="dialogue-new-btn" title="新建对话" @click="$emit('new-dialogue')">
            <PlusSquareIcon :size="16" />
            <span>新建</span>
          </button>
          <button
            type="button"
            class="dialogue-clear-btn"
            :disabled="!activeSession"
            aria-label="删除当前会话"
            title="删除当前会话"
            @click="$emit('delete-dialogue')"
          >
            <Trash2Icon :size="16" />
          </button>
        </div>
      </div>

      <div class="dialogue-rail-list custom-scrollbar">
        <button
          v-for="session in sessions"
          :key="session.chainId"
          type="button"
          class="dialogue-session-card"
          :class="{ active: session.chainId === chainId }"
          @click="$emit('select-session', session)"
        >
          <span v-if="session.coverUrl" class="dialogue-session-thumb">
            <img :src="session.coverUrl" alt="" />
          </span>
          <span v-else class="dialogue-session-thumb empty">
            <ImageIcon :size="15" />
          </span>
          <span class="dialogue-session-content">
            <span class="dialogue-session-title">{{ session.title }}</span>
            <span class="dialogue-session-meta">{{ session.roundCount }} 轮 · {{ formatTime(session.updatedAt) }}</span>
          </span>
        </button>
        <div v-if="!sessions.length" class="dialogue-rail-empty">
          还没有会话。
        </div>
      </div>
    </aside>

    <section class="dialogue-main">
      <div class="dialogue-main-head">
        <div class="dialogue-title-block">
          <div class="dialogue-main-title">{{ activeTitle }}</div>
          <div class="dialogue-main-meta">{{ roundLabel }} · {{ advancedSummary }}</div>
        </div>
        <div class="dialogue-main-actions">
          <span v-if="sourceLabel" class="dialogue-source-chip">
            <ImageIcon :size="14" />
            {{ sourceLabel }}
          </span>
          <button
            v-if="canResetPreview"
            type="button"
            class="btn btn-ghost btn-xs preview-reset-btn"
            :disabled="loading"
            @click="$emit('reset-preview')"
          >
            <RefreshCcwIcon :size="15" />
            <span>重置预览</span>
          </button>
        </div>
      </div>

      <div v-if="sourcePreviewUrl" class="dialogue-context-row">
        <div class="dialogue-context-source">
          <img :src="sourcePreviewUrl" alt="" />
          <span>{{ sourceLabel }}</span>
        </div>
      </div>

      <div
        ref="threadScroller"
        class="dialogue-thread custom-scrollbar"
        :class="{ empty: !threadItems.length && !pendingPrompt }"
      >
        <template v-if="threadItems.length">
          <div
            v-for="(item, index) in threadItems"
            :key="item.id || `${item.imageId}-${index}`"
            class="dialogue-turn"
          >
            <div class="dialogue-message user">
              <div class="dialogue-message-bubble">{{ item.prompt }}</div>
            </div>

            <div v-if="item.imageUrls.length" class="dialogue-result-card">
              <div class="dialogue-preview-box has-image" :style="{ aspectRatio: item.aspectRatioValue }">
                <DialogueImagePreview
                  :urls="item.imageUrls"
                  :aspect-ratio="item.aspectRatioValue"
                  :alt-base="`第 ${index + 1} 轮结果`"
                />
              </div>
              <div class="dialogue-result-footer">
                <span class="dialogue-result-label">第 {{ index + 1 }} 轮结果</span>
                <span class="dialogue-result-status">
                  {{ index === threadItems.length - 1 ? '已作为下一轮上下文' : '历史结果' }}
                </span>
              </div>
            </div>
          </div>
        </template>

        <div v-if="pendingPrompt" class="dialogue-turn">
          <div class="dialogue-message user">
            <div class="dialogue-message-bubble">{{ pendingPrompt }}</div>
          </div>
          <div v-if="loading" class="dialogue-result-card">
            <div class="dialogue-preview-box loading-box" :style="{ aspectRatio: previewAspectRatio }">
              <div class="loading-state">
                <div class="loader-core">
                  <SparklesIcon :size="32" class="pulse-icon" />
                </div>
                <span class="loading-text">{{ loadingText }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!threadItems.length && !pendingPrompt && (displayPreviewUrls[0] || loading)" class="dialogue-result-card">
          <div
            class="dialogue-preview-box"
            :class="{ 'has-image': displayPreviewUrls[0], 'loading-box': loading && !displayPreviewUrls[0] }"
            :style="{ aspectRatio: previewAspectRatio }"
          >
            <DialogueImagePreview
              v-if="displayPreviewUrls[0]"
              :urls="displayPreviewUrls"
              :aspect-ratio="previewAspectRatio"
              alt-base="对话结果"
            />
            <div v-else-if="loading" class="loading-state">
              <div class="loader-core">
                <SparklesIcon :size="32" class="pulse-icon" />
              </div>
              <span class="loading-text">{{ loadingText }}</span>
            </div>
          </div>
          <div v-if="displayPreviewUrls[0]" class="dialogue-result-footer">
            <span class="dialogue-result-label">{{ hasSource ? '起始图片' : '预览' }}</span>
            <span class="dialogue-result-status">{{ hasSource ? '作为本轮参考' : '等待生成' }}</span>
          </div>
        </div>

        <div v-else-if="!threadItems.length && !pendingPrompt" class="dialogue-empty-space"></div>
      </div>

      <div class="dialogue-composer">
        <textarea
          v-model="prompt"
          class="dialogue-composer-input custom-scrollbar"
          required
          maxlength="4000"
          :placeholder="promptPlaceholder"
          @keydown.meta.enter.prevent="$emit('shortcut')"
          @keydown.ctrl.enter.prevent="$emit('shortcut')"
        ></textarea>
        <div class="dialogue-composer-footer">
          <div class="dialogue-composer-tools">
            <div class="dialogue-tool-group material">
              <button type="button" class="dialogue-upload-btn" @click="$emit('open-picker')">
                <ImageIcon :size="16" />
                <span>{{ inputFileCount ? '参考图' : '上传' }}</span>
              </button>
              <button
                type="button"
                class="dialogue-upload-btn"
                :disabled="!prompt"
                @click="$emit('check-prompt')"
              >
                <SearchCheckIcon :size="16" />
                <span>{{ promptChecking ? '检查中' : '检查' }}</span>
              </button>
              <button
                type="button"
                class="dialogue-upload-btn"
                :disabled="!prompt"
                @click="$emit('enhance')"
              >
                <SparklesIcon :size="16" />
                <span>优化提示词</span>
              </button>
            </div>

            <div class="dialogue-tool-group settings">
              <SelectMenu v-model="form.aspectRatio" class="dialogue-compact-select" size="xs" :options="ratioOptions" placeholder="比例" />
              <SelectMenu v-model="form.qualityTier" class="dialogue-compact-select" size="xs" :options="qualityTierOptions" placeholder="质量" />
              <SelectMenu v-model="form.count" class="dialogue-compact-select" size="xs" :options="countOptions" placeholder="张数" />
              <SelectMenu v-model="form.outputFormat" class="dialogue-compact-select" size="xs" :options="outputFormatOptions" placeholder="格式" />
              <SelectMenu v-model="form.background" class="dialogue-compact-select" size="xs" :options="backgroundOptions" placeholder="背景" />
              <SelectMenu v-model="form.moderation" class="dialogue-compact-select" size="xs" :options="moderationOptions" placeholder="审核" />
              <label v-if="supportsCompression" class="dialogue-compression-control">
                <span>{{ form.outputCompression }}%</span>
                <input v-model.number="form.outputCompression" type="range" min="0" max="100" step="5" aria-label="输出压缩率" />
              </label>
            </div>
          </div>
          <div v-if="promptQuality" class="dialogue-quality-card" :class="{ ok: promptQuality.ok }">
            <div class="dialogue-quality-top">
              <span>{{ promptQuality.ok ? '提示词状态不错' : '提示词可以再补强' }}</span>
              <button
                v-if="promptQuality.improvedPrompt"
                type="button"
                @click="$emit('apply-prompt-suggestion', promptQuality.improvedPrompt)"
              >
                应用建议
              </button>
            </div>
            <div class="dialogue-quality-sub">
              评分 {{ promptQuality.score }} · {{ promptQuality.issues?.[0]?.message || promptQuality.billingPolicy || '免费检查，不阻塞生成' }}
            </div>
          </div>
          <div class="dialogue-composer-status">
            <span>{{ prompt.length }} / 4000</span>
            <button type="submit" class="btn btn-primary dialogue-send-btn" :disabled="submitDisabled">
              <SparklesIcon v-if="!loading" :size="17" />
              <LoaderIcon v-else class="animate-spin" :size="17" />
              <span>{{ submitButtonText }}</span>
            </button>
          </div>
        </div>
        <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
      </div>
    </section>
  </form>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ImageIcon, LoaderIcon, PlusSquareIcon, RefreshCcwIcon, SearchCheckIcon, SparklesIcon, Trash2Icon } from 'lucide-vue-next'
import { SelectMenu } from '../common'
import DialogueImagePreview from './DialogueImagePreview.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  sessions: { type: Array, default: () => [] },
  activeSession: { type: Object, default: null },
  chainId: { type: String, default: '' },
  activeTitle: { type: String, default: '新建对话' },
  roundLabel: { type: String, default: '' },
  advancedSummary: { type: String, default: '' },
  sourceLabel: { type: String, default: '' },
  sourcePreviewUrl: { type: String, default: '' },
  threadItems: { type: Array, default: () => [] },
  pendingPrompt: { type: String, default: '' },
  displayPreviewUrls: { type: Array, default: () => [] },
  previewAspectRatio: { type: String, default: '1 / 1' },
  hasSource: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  loadingText: { type: String, default: '' },
  promptPlaceholder: { type: String, default: '' },
  inputFileCount: { type: Number, default: 0 },
  form: { type: Object, required: true },
  ratioOptions: { type: Array, default: () => [] },
  qualityTierOptions: { type: Array, default: () => [] },
  countOptions: { type: Array, default: () => [] },
  outputFormatOptions: { type: Array, default: () => [] },
  backgroundOptions: { type: Array, default: () => [] },
  moderationOptions: { type: Array, default: () => [] },
  supportsCompression: { type: Boolean, default: false },
  promptQuality: { type: Object, default: null },
  promptChecking: { type: Boolean, default: false },
  submitDisabled: { type: Boolean, default: false },
  submitButtonText: { type: String, default: '' },
  canResetPreview: { type: Boolean, default: false },
  errorMsg: { type: String, default: '' },
  formatTime: { type: Function, required: true }
})
const emit = defineEmits([
  'update:modelValue',
  'submit',
  'new-dialogue',
  'delete-dialogue',
  'select-session',
  'reset-preview',
  'open-picker',
  'enhance',
  'check-prompt',
  'apply-prompt-suggestion',
  'shortcut'
])

const prompt = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const threadScroller = ref(null)

const scrollThreadToBottom = async () => {
  await nextTick()
  const scroller = threadScroller.value
  if (!scroller) return
  scroller.scrollTop = scroller.scrollHeight
}

watch(
  () => [
    props.chainId,
    props.threadItems.length,
    props.pendingPrompt,
    props.displayPreviewUrls.length,
    props.loading
  ],
  scrollThreadToBottom,
  { immediate: true, flush: 'post' }
)

</script>

<style scoped>
.dialogue-workspace {
  min-height: calc(100vh - 140px);
  display: grid;
  grid-template-columns: minmax(210px, 252px) minmax(0, 1fr);
  gap: 16px;
  --dialogue-ink: #111827;
  --dialogue-muted: #64748b;
  --dialogue-hairline: rgba(15, 23, 42, 0.08);
  --dialogue-panel: rgba(255, 255, 255, 0.78);
  --dialogue-lilac: var(--primary);
  isolation: isolate;
}

.dialogue-rail,
.dialogue-main {
  min-height: 0;
  border: 1px solid rgba(226, 232, 240, 0.86);
  border-radius: 18px;
  background: var(--dialogue-panel);
  box-shadow:
    0 12px 32px rgba(15, 23, 42, 0.035),
    inset 0 1px 0 rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(18px);
}

.dialogue-rail {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialogue-rail-head,
.dialogue-main-head,
.dialogue-composer-footer,
.dialogue-composer-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dialogue-composer-footer {
  align-items: flex-end;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.dialogue-composer-status {
  flex: none;
  align-self: flex-end;
  justify-content: flex-end;
  min-width: max-content;
}

.dialogue-composer-status > span {
  color: var(--dialogue-muted);
  font-size: 12px;
  font-weight: 760;
  white-space: nowrap;
}

.dialogue-rail-head {
  padding: 14px 14px 10px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.74);
}

.dialogue-rail-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dialogue-rail-title span,
.dialogue-main-title {
  color: var(--dialogue-ink);
  font-size: 15px;
  font-weight: 950;
  letter-spacing: 0;
}

.dialogue-rail-title small,
.dialogue-main-meta {
  color: var(--dialogue-muted);
  font-size: 11px;
  font-weight: 750;
}

.dialogue-rail-actions {
  display: flex;
  gap: 6px;
}

.dialogue-new-btn,
.dialogue-clear-btn,
.dialogue-upload-btn {
  border: 1px solid rgba(203, 213, 225, 0.82);
  background: rgba(255, 255, 255, 0.76);
  color: var(--dialogue-ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease, color 0.18s ease;
}

.dialogue-new-btn:hover,
.dialogue-clear-btn:hover,
.dialogue-upload-btn:hover:not(:disabled) {
  border-color: rgba(37, 99, 235, 0.20);
  background: #fff;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.045);
}

.dialogue-new-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
}

.dialogue-clear-btn {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  color: rgba(100, 116, 139, 0.94);
}

.dialogue-clear-btn:disabled,
.dialogue-upload-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.dialogue-rail-list {
  min-height: 0;
  overflow: auto;
  padding: 8px;
}

.dialogue-session-card {
  width: 100%;
  min-height: 54px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  padding: 8px;
  cursor: pointer;
  text-align: left;
  position: relative;
  transition: transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
}

.dialogue-session-card:hover,
.dialogue-session-card.active {
  border-color: rgba(226, 232, 240, 0.90);
  background: rgba(248, 250, 252, 0.68);
}

.dialogue-session-card.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 3px;
  border-radius: 999px;
  background: var(--dialogue-lilac);
}

.dialogue-session-thumb {
  width: 34px;
  height: 34px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(241, 245, 249, 0.95);
  color: var(--dialogue-muted);
  box-shadow: inset 0 0 0 1px rgba(226, 232, 240, 0.92);
}

.dialogue-session-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dialogue-session-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dialogue-session-title {
  color: var(--dialogue-ink);
  font-size: 12px;
  font-weight: 820;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dialogue-session-meta,
.dialogue-rail-empty {
  color: var(--dialogue-muted);
  font-size: 11px;
  font-weight: 720;
}

.dialogue-rail-empty {
  padding: 18px 8px;
  text-align: center;
}

.dialogue-main {
  position: relative;
  min-width: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  grid-template-areas: "head" "context" "thread" "composer";
  gap: 12px;
  padding: 14px;
  overflow: hidden;
}

.dialogue-main::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.28), transparent 40%);
  z-index: 0;
}

.dialogue-main-head {
  grid-area: head;
  position: relative;
  z-index: 1;
  min-height: 34px;
  padding: 0 2px 8px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.66);
}

.dialogue-title-block {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dialogue-main-actions,
.dialogue-context-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.dialogue-source-chip,
.dialogue-context-source {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(226, 232, 240, 0.86);
  background: rgba(255, 255, 255, 0.72);
  color: var(--dialogue-muted);
  font-size: 12px;
  font-weight: 850;
}

.dialogue-source-chip {
  height: 28px;
  padding: 0 8px;
  border-radius: 999px;
}

.dialogue-context-row {
  grid-area: context;
  position: relative;
  z-index: 1;
  min-width: 0;
  overflow-x: auto;
}

.dialogue-context-source {
  height: 30px;
  padding: 0 10px 0 6px;
  border-radius: 999px;
}

.dialogue-context-source img {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  object-fit: cover;
}

.dialogue-thread {
  grid-area: thread;
  position: relative;
  z-index: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 0;
}

.dialogue-thread.empty {
  justify-content: center;
  align-items: center;
}

.dialogue-turn {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dialogue-message {
  max-width: min(560px, 88%);
  display: flex;
}

.dialogue-message.user {
  align-self: flex-end;
}

.dialogue-message-bubble {
  padding: 10px 13px;
  border-radius: 16px 16px 8px 16px;
  border: 1px solid rgba(226, 232, 240, 0.86);
  background: rgba(255, 255, 255, 0.82);
  color: var(--dialogue-ink);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.55;
  overflow-wrap: anywhere;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.035);
}

.dialogue-result-card {
  width: 100%;
  max-width: min(420px, 66%);
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.dialogue-thread.empty .dialogue-result-card {
  max-width: min(460px, 62%);
  align-self: center;
}

.dialogue-preview-box {
  width: 100%;
  min-height: 180px;
  max-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.82);
  background: rgba(255, 255, 255, 0.50);
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.78),
    0 8px 22px rgba(15, 23, 42, 0.03);
}

.dialogue-preview-box.has-image {
  padding: 6px;
  background: rgba(248, 250, 252, 0.72);
}

.dialogue-preview-box :deep(.dialogue-image-preview) {
  width: 100%;
  height: 100%;
  min-height: inherit;
  max-height: inherit;
}

.dialogue-preview-box :deep(.dialogue-image-preview.grid) {
  grid-auto-rows: minmax(0, 1fr);
}

.dialogue-preview-box :deep(.dialogue-preview-image),
.dialogue-preview-box :deep(img) {
  object-fit: contain;
}

.loading-state,
.dialogue-empty-space {
  min-height: 180px;
}

.loading-state {
  min-height: 190px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: var(--dialogue-muted);
  text-align: center;
}

.dialogue-result-footer {
  min-height: 28px;
  margin-top: 9px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: rgba(100, 116, 139, 0.90);
  font-size: 11px;
  font-weight: 800;
}

.dialogue-composer {
  grid-area: composer;
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid rgba(203, 213, 225, 0.80);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow:
    0 8px 24px rgba(15, 23, 42, 0.045),
    0 0 0 3px rgba(37, 99, 235, 0.018);
}

.dialogue-composer-input {
  width: 100%;
  min-height: 58px;
  max-height: 104px;
  resize: vertical;
  border: none;
  outline: none;
  background: transparent;
  color: var(--dialogue-ink);
  font-size: 14px;
  font-weight: 650;
  line-height: 1.55;
}

.dialogue-composer-input::placeholder {
  color: rgba(100, 116, 139, 0.72);
}

.dialogue-composer-tools {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(226, 232, 240, 0.82);
}

.dialogue-tool-group {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.dialogue-tool-group.material {
  flex-wrap: nowrap;
}

.dialogue-tool-group.settings {
  align-content: flex-start;
  justify-content: flex-end;
}

.dialogue-upload-btn {
  height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 850;
  white-space: nowrap;
}

.dialogue-compact-select {
  width: auto;
  min-width: 82px;
  flex: 0 0 auto;
}

.dialogue-compact-select :deep(.input) {
  height: 32px;
  border-color: rgba(203, 213, 225, 0.82);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.78);
}

.dialogue-compression-control {
  height: 32px;
  min-width: 116px;
  padding: 0 10px;
  border: 1px solid rgba(203, 213, 225, 0.82);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: var(--dialogue-muted);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 850;
}

.dialogue-compression-control input {
  width: 68px;
  accent-color: var(--primary);
}

.dialogue-quality-card {
  display: grid;
  gap: 5px;
  padding: 8px 10px;
  border: 1px solid rgba(245, 158, 11, 0.22);
  border-radius: 14px;
  background: rgba(255, 251, 235, 0.72);
}

.dialogue-quality-card.ok {
  border-color: rgba(16, 185, 129, 0.22);
  background: rgba(236, 253, 245, 0.72);
}

.dialogue-quality-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--dialogue-ink);
  font-size: 12px;
  font-weight: 950;
}

.dialogue-quality-top button {
  flex: none;
  border: none;
  border-radius: 999px;
  min-height: 26px;
  padding: 0 10px;
  background: rgba(15, 23, 42, 0.88);
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.dialogue-quality-sub {
  color: var(--dialogue-muted);
  font-size: 12px;
  line-height: 1.45;
  font-weight: 750;
}

.dialogue-send-btn {
  min-width: 112px;
  width: auto;
  height: 40px;
  gap: 7px;
  padding: 0 16px;
  border-radius: 999px;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.18);
}

.dialogue-send-btn span {
  font-size: 13px;
  font-weight: 900;
}

@media (max-width: 980px) {
  .dialogue-workspace {
    grid-template-columns: 1fr;
  }

  .dialogue-rail {
    min-height: 0;
    max-height: 280px;
  }

  .dialogue-rail-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px;
  }
}

@media (max-width: 1280px) {
  .dialogue-composer-footer {
    align-items: stretch;
    display: flex;
    flex-direction: column;
  }

  .dialogue-composer-status {
    width: 100%;
    align-self: stretch;
    flex-direction: row;
  }

  .dialogue-tool-group.settings {
    justify-content: flex-start;
  }
}

@media (max-width: 760px) {
  .dialogue-composer-footer,
  .dialogue-composer-status {
    align-items: stretch;
    flex-direction: column;
  }

  .dialogue-composer-tools {
    grid-template-columns: 1fr;
  }

  .dialogue-tool-group.settings {
    justify-content: flex-start;
  }
}
</style>
