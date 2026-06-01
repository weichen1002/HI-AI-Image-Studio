<template>
  <div class="tool-panel">
    <div class="source-card tool-source-card">
      <div class="section-head">
        <div>
          <div class="section-title">来源图</div>
          <div class="section-desc">{{ sourceHint }}</div>
        </div>
        <div class="tool-source-actions">
          <button type="button" class="btn btn-ghost btn-xs" @click="$emit('open-source-picker')">
            {{ hasSource ? '更换图片' : '选择图片' }}
          </button>
          <button
            v-if="canClearSource"
            type="button"
            class="btn btn-ghost btn-xs"
            @click="$emit('clear-source')"
          >
            清除
          </button>
        </div>
      </div>
      <div class="source-summary" :class="{ empty: !hasSource }">
        <span class="source-chip">{{ sourceTag }}</span>
        <span class="source-text">{{ sourceSummary }}</span>
      </div>
    </div>

    <div class="tool-card">
      <div class="section-head">
        <div>
          <div class="section-title">选择工具</div>
          <div class="section-desc">选择工具后进入编辑器。</div>
        </div>
      </div>
      <div class="tool-grid">
        <button
          v-for="item in toolOptions"
          :key="item.value"
          type="button"
          class="tool-btn"
          :class="{ active: selectedTool === item.value, disabled: item.disabled }"
          :disabled="item.disabled"
          @click="selectedTool = item.value"
        >
          <span class="tool-mark" aria-hidden="true">{{ toolMark(item) }}</span>
          <span class="tool-copy">
            <span class="tool-row">
              <span class="tool-name">{{ item.label }}</span>
              <span class="tool-status">{{ toolStatusText(item) }}</span>
            </span>
            <span class="tool-desc">{{ item.description }}</span>
          </span>
        </button>
      </div>
      <div class="tool-current-note">
        {{ currentToolMeta.detail }}
      </div>
    </div>

    <div class="tool-prompt-card">
      <div class="prompt-label-row">
        <label class="label">补充要求</label>
        <span class="field-caption">{{ promptHint }}</span>
      </div>
      <div class="textarea-wrapper">
        <textarea
          v-model="toolPrompt"
          class="textarea custom-scrollbar"
          maxlength="4000"
          :placeholder="promptPlaceholder"
        ></textarea>
      </div>
      <div class="prompt-toolbar">
        <span class="prompt-count">{{ toolPrompt.length }} / 4000</span>
        <div class="prompt-actions">
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            :disabled="!toolPrompt"
            @click="$emit('clear-prompt')"
          >
            <Trash2Icon :size="16" />
            <span>清空</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Trash2Icon } from 'lucide-vue-next'

const props = defineProps({
  selectedTool: {
    type: String,
    required: true
  },
  toolPrompt: {
    type: String,
    default: ''
  },
  toolOptions: {
    type: Array,
    default: () => []
  },
  currentToolMeta: {
    type: Object,
    default: () => ({})
  },
  promptHint: {
    type: String,
    default: ''
  },
  promptPlaceholder: {
    type: String,
    default: ''
  },
  hasSource: {
    type: Boolean,
    default: false
  },
  canClearSource: {
    type: Boolean,
    default: false
  },
  sourceHint: {
    type: String,
    default: ''
  },
  sourceTag: {
    type: String,
    default: ''
  },
  sourceSummary: {
    type: String,
    default: ''
  }
})

const emit = defineEmits([
  'update:selectedTool',
  'update:toolPrompt',
  'open-source-picker',
  'clear-source',
  'clear-prompt'
])

const selectedTool = computed({
  get: () => props.selectedTool,
  set: (value) => emit('update:selectedTool', value)
})

const toolPrompt = computed({
  get: () => props.toolPrompt,
  set: (value) => emit('update:toolPrompt', value)
})

function toolStatusText(item) {
  if (item.disabled) return '即将上线'
  if (props.selectedTool === item.value) return '当前选择'
  return '可用'
}

function toolMark(item) {
  const marks = {
    inpaint: '重',
    outpaint: '扩',
    upscale: '清',
    cutout: '抠'
  }
  return marks[item?.value] || String(item?.label || '工').slice(0, 1)
}
</script>

<style scoped>
.tool-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.source-card,
.tool-card,
.tool-prompt-card {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.58);
  padding: 14px;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.section-title {
  font-size: 14px;
  font-weight: 900;
  color: var(--text);
}

.section-desc,
.field-caption {
  margin-top: 5px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted);
}

.tool-source-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.source-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.75);
  padding: 12px 14px;
  min-width: 0;
}

.source-summary.empty {
  border-style: dashed;
}

.source-chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  color: var(--primary);
  font-size: 12px;
  font-weight: 800;
}

.source-text {
  min-width: 0;
  color: var(--text);
  font-size: 13px;
  line-height: 1.5;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.tool-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.tool-btn {
  position: relative;
  min-height: 68px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 13px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 252, 0.74));
  padding: 10px 11px 10px 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.tool-btn::before {
  position: absolute;
  inset: 10px auto 10px 0;
  width: 3px;
  border-radius: 0 999px 999px 0;
  background: transparent;
  content: "";
  transition: background-color 0.18s ease;
}

.tool-btn:hover:not(:disabled) {
  border-color: rgba(37, 99, 235, 0.22);
  background: #ffffff;
  transform: translateY(-1px);
}

.tool-btn.active {
  border-color: rgba(37, 99, 235, 0.32);
  background:
    linear-gradient(180deg, rgba(37, 99, 235, 0.085), rgba(255, 255, 255, 0.90));
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.08);
}

.tool-btn.active::before {
  background: var(--primary);
}

.tool-btn.disabled {
  opacity: 0.56;
}

.tool-mark {
  flex: none;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: 11px;
  background: rgba(37, 99, 235, 0.055);
  color: var(--primary);
  font-size: 13px;
  font-weight: 950;
}

.tool-copy {
  min-width: 0;
  display: grid;
  flex: 1;
  gap: 4px;
}

.tool-row {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tool-name {
  font-size: 14px;
  font-weight: 900;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-desc {
  font-size: 12px;
  line-height: 1.4;
  color: var(--muted);
  font-weight: 600;
}

.tool-status {
  flex: none;
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.04);
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
}

.tool-btn.active .tool-status {
  background: rgba(37, 99, 235, 0.1);
  color: var(--primary);
}

.tool-current-note {
  margin-top: 10px;
  padding: 10px 11px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.035);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
  font-weight: 700;
}

.prompt-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.prompt-label-row .label {
  margin-bottom: 0;
}

.label {
  display: inline-flex;
  margin-bottom: 10px;
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
  line-height: 1.25;
}

.textarea-wrapper {
  position: relative;
}

.tool-prompt-card .textarea {
  min-height: 112px;
}

.prompt-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
}

.prompt-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .tool-grid {
    grid-template-columns: 1fr;
  }

  .section-head,
  .prompt-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }

  .field-caption {
    text-align: left;
  }

  .tool-prompt-card .textarea {
    min-height: 126px;
  }

  .prompt-actions {
    justify-content: flex-start;
    width: 100%;
  }

  .prompt-actions .btn:not(.btn-icon) {
    flex: 1 1 132px;
  }

  .source-summary {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
  }

  .source-chip {
    min-width: 0;
  }

  .source-card,
  .tool-card,
  .tool-prompt-card {
    border-radius: 14px;
    padding: 12px;
  }

  .tool-btn {
    min-height: 66px;
  }
}
</style>
