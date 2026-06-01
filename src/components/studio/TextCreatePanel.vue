<template>
  <div class="text-create-panel">
    <div v-if="showPresets">
      <label class="label">快捷预设</label>
      <QuickPresetsBar
        :presets="quickPresets"
        :active-key="activePresetKey"
        @select="$emit('select-preset', $event)"
      />
    </div>

    <div>
      <div class="prompt-label-row">
        <label class="label">提示词</label>
        <Popover v-model:open="promptHelpOpen" placement="bottom-start" :offset="10">
          <template #trigger>
            <button type="button" class="prompt-help" aria-label="提示词写法说明" title="提示词写法说明">
              <InfoIcon :size="16" />
            </button>
          </template>
          <div class="prompt-help-panel">
            <div class="prompt-help-title">提示词要点</div>
            <ul class="prompt-help-list">
              <li>主体：对象、场景、动作</li>
              <li>风格：写实、插画、3D 或摄影</li>
              <li>构图：位置、留白、前后景</li>
              <li>光线：自然光、棚拍、逆光</li>
              <li>限制：不要文字、水印、Logo</li>
            </ul>
            <div class="prompt-help-example">
              示例：单个香水瓶居中，纯白背景，柔光棚拍，自然阴影，高清细节，不要文字和水印
            </div>
          </div>
        </Popover>
      </div>
      <div class="textarea-wrapper">
        <textarea
          v-model="form.prompt"
          class="textarea custom-scrollbar"
          required
          maxlength="4000"
          placeholder="例如：咖啡新品海报，温暖自然光，产品居中，背景干净，预留标题区域。"
        ></textarea>
      </div>
      <div class="prompt-toolbar">
        <span class="prompt-count">{{ form.prompt.length }} / 4000</span>
        <div class="prompt-actions">
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            :disabled="loading || !form.prompt || promptChecking"
            @click="$emit('check-prompt')"
          >
            <SearchCheckIcon :size="16" />
            <span>{{ promptChecking ? '检查中' : '检查' }}</span>
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            :disabled="loading || !form.prompt"
            @click="$emit('enhance')"
          >
            <Wand2Icon :size="16" />
            <span>润色预览</span>
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            :disabled="!form.prompt"
            @click="$emit('clear-prompt')"
          >
            <Trash2Icon :size="16" />
            <span>清空</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="promptQuality" class="prompt-quality-card" :class="{ ok: promptQuality.ok }">
      <div class="prompt-quality-head">
        <div>
          <div class="prompt-quality-title">{{ promptQuality.ok ? '提示词状态不错' : '提示词可以再补强' }}</div>
          <div class="prompt-quality-sub">
            评分 {{ promptQuality.score }} · {{ promptQuality.billingPolicy || '免费检查，不阻塞生成' }}
          </div>
        </div>
        <button
          v-if="promptQuality.improvedPrompt"
          type="button"
          class="prompt-quality-apply"
          @click="$emit('apply-prompt-suggestion', promptQuality.improvedPrompt)"
        >
          应用建议
        </button>
      </div>
      <div v-if="promptQuality.issues?.length" class="prompt-quality-issues">
        <div v-for="issue in promptQuality.issues" :key="`${issue.type}-${issue.message}`" class="prompt-quality-issue">
          {{ issue.message }}
        </div>
      </div>
      <div v-if="promptQuality.suggestions?.length" class="prompt-quality-suggestions">
        {{ promptQuality.suggestions.slice(0, 2).join(' / ') }}
      </div>
    </div>

    <div>
      <label class="label">图片比例</label>
      <div class="ratio-grid">
        <button
          v-for="ratio in ratios"
          :key="ratio"
          type="button"
          class="ratio-btn"
          :class="{ active: form.aspectRatio === ratio }"
          @click="form.aspectRatio = ratio"
        >
          <div class="ratio-icon" :class="'ratio-' + ratio.replace(':', '-')"></div>
          <span>{{ ratio }}</span>
        </button>
      </div>
    </div>

    <div class="advanced-card">
      <button
        type="button"
        class="advanced-toggle"
        :class="{ open: advancedOpen }"
        @click="advancedOpen = !advancedOpen"
      >
        <div>
          <div class="advanced-title">更多设置</div>
          <div class="advanced-summary">{{ advancedSummary }}</div>
        </div>
        <span class="advanced-arrow">{{ advancedOpen ? '收起' : '展开' }}</span>
      </button>

      <div v-if="advancedOpen" class="settings-grid">
        <div>
          <label class="label">生成质量</label>
          <SelectMenu v-model="form.qualityTier" size="sm" :options="qualityTierOptions" placeholder="选择生成质量" />
        </div>

        <div>
          <label class="label">一次生成</label>
          <SelectMenu v-model="form.count" size="sm" :options="countOptions" placeholder="选择生成张数" />
        </div>

        <div>
          <label class="label">输出格式</label>
          <SelectMenu v-model="form.outputFormat" size="sm" :options="outputFormatOptions" placeholder="选择输出格式" />
          <div class="field-hint">PNG 画质稳，JPEG/WEBP 体积小。</div>
        </div>

        <div>
          <div class="range-label-row">
            <label class="label">压缩率</label>
            <span class="range-value">{{ supportsCompression ? `${form.outputCompression}%` : 'PNG 无损' }}</span>
          </div>
          <input
            v-model.number="form.outputCompression"
            class="field-range"
            type="range"
            min="0"
            max="100"
            step="5"
            :disabled="!supportsCompression"
          />
          <div class="field-hint">
            {{ supportsCompression ? '仅 JPEG / WEBP 生效，数值越低体积越小。' : 'PNG 无损，不需要压缩率。' }}
          </div>
        </div>

        <div>
          <label class="label">背景策略</label>
          <SelectMenu v-model="form.background" size="sm" :options="backgroundOptions" placeholder="选择背景策略" />
          <div class="field-hint">透明背景支持 PNG / WEBP。</div>
        </div>

        <div>
          <label class="label">审核等级</label>
          <SelectMenu v-model="form.moderation" size="sm" :options="moderationOptions" placeholder="选择审核等级" />
          <div class="field-hint">默认推荐自动；测试可用低限制。</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { InfoIcon, SearchCheckIcon, Trash2Icon, Wand2Icon } from 'lucide-vue-next'
import { Popover, SelectMenu } from '../common'
import QuickPresetsBar from './QuickPresetsBar.vue'

const props = defineProps({
  form: {
    type: Object,
    required: true
  },
  showPresets: {
    type: Boolean,
    default: true
  },
  quickPresets: {
    type: Array,
    default: () => []
  },
  activePresetKey: {
    type: String,
    default: ''
  },
  ratios: {
    type: Array,
    default: () => []
  },
  qualityTierOptions: {
    type: Array,
    default: () => []
  },
  countOptions: {
    type: Array,
    default: () => []
  },
  outputFormatOptions: {
    type: Array,
    default: () => []
  },
  backgroundOptions: {
    type: Array,
    default: () => []
  },
  moderationOptions: {
    type: Array,
    default: () => []
  },
  supportsCompression: {
    type: Boolean,
    default: false
  },
  advancedSummary: {
    type: String,
    default: ''
  },
  loading: {
    type: Boolean,
    default: false
  },
  promptQuality: {
    type: Object,
    default: null
  },
  promptChecking: {
    type: Boolean,
    default: false
  },
  resetKey: {
    type: [String, Number],
    default: ''
  }
})
defineEmits(['select-preset', 'enhance', 'check-prompt', 'apply-prompt-suggestion', 'clear-prompt'])

const promptHelpOpen = ref(false)
const advancedOpen = ref(false)

watch(
  () => props.resetKey,
  () => {
    promptHelpOpen.value = false
  },
)
</script>

<style scoped>
.text-create-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.text-create-panel > div {
  min-width: 0;
}

.label {
  display: inline-flex;
  margin-bottom: 10px;
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
  line-height: 1.25;
}

.prompt-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.prompt-label-row .label,
.range-label-row .label {
  margin-bottom: 0;
}

.prompt-help {
  width: 30px;
  height: 30px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.75);
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.prompt-help:hover {
  color: var(--primary);
  border-color: rgba(37, 99, 235, 0.22);
}

.prompt-help-panel {
  width: min(320px, 78vw);
  padding: 14px;
}

.prompt-help-title {
  font-weight: 900;
  margin-bottom: 8px;
}

.prompt-help-list {
  margin: 0;
  padding-left: 18px;
  color: var(--text);
  font-size: 13px;
  line-height: 1.7;
}

.prompt-help-example,
.field-hint {
  margin-top: 9px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted);
}

.textarea-wrapper {
  position: relative;
}

.prompt-toolbar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 10px 14px;
  margin-top: 10px;
}

.prompt-count {
  min-width: 70px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
  line-height: 34px;
  white-space: nowrap;
}

.prompt-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
}

.prompt-actions :deep(.btn) {
  height: 34px;
  padding: 0 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 850;
}

.prompt-actions :deep(.btn-icon) {
  width: 34px;
  min-width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 12px;
}

.prompt-actions :deep(.btn-icon svg) {
  width: 16px;
  height: 16px;
}

.prompt-quality-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(245, 158, 11, 0.22);
  border-radius: 14px;
  background: rgba(255, 251, 235, 0.76);
}

.prompt-quality-card.ok {
  border-color: rgba(16, 185, 129, 0.22);
  background: rgba(236, 253, 245, 0.76);
}

.prompt-quality-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.prompt-quality-title {
  color: var(--text);
  font-size: 13px;
  font-weight: 950;
}

.prompt-quality-sub,
.prompt-quality-suggestions {
  margin-top: 3px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
  font-weight: 750;
}

.prompt-quality-apply {
  flex: none;
  min-height: 30px;
  padding: 0 10px;
  border: none;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.88);
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.prompt-quality-issues {
  display: grid;
  gap: 6px;
}

.prompt-quality-issue {
  color: var(--text);
  font-size: 12px;
  line-height: 1.5;
  font-weight: 800;
}

@media (max-width: 560px) {
  .prompt-toolbar {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
  }

  .prompt-count {
    line-height: 34px;
  }

  .prompt-actions {
    justify-content: flex-end;
  }

  .prompt-actions :deep(.btn:not(.btn-icon)) {
    flex: 0 1 auto;
    min-width: 0;
  }
}

.ratio-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.ratio-btn {
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  min-height: 58px;
  padding: 9px 8px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.ratio-btn:hover {
  border-color: rgba(37, 99, 235, 0.4);
  background: rgba(37, 99, 235, 0.02);
}

.ratio-btn.active {
  background: rgba(37, 99, 235, 0.05);
  border-color: var(--primary);
  color: var(--primary);
  box-shadow: 0 5px 14px rgba(37, 99, 235, 0.14);
}

.ratio-icon {
  border: 2px solid currentColor;
  border-radius: 3px;
  opacity: 0.6;
}

.ratio-btn.active .ratio-icon {
  opacity: 1;
}

.ratio-1-1 { width: 18px; height: 18px; }
.ratio-16-9 { width: 22px; height: 14px; }
.ratio-9-16 { width: 14px; height: 22px; }
.ratio-4-3 { width: 20px; height: 16px; }
.ratio-3-4 { width: 16px; height: 20px; }

.advanced-card {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.58);
  padding: 14px;
}

.advanced-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
}

.advanced-title {
  font-size: 14px;
  font-weight: 900;
  color: var(--text);
}

.advanced-summary {
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
  font-weight: 700;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.advanced-arrow {
  font-size: 12px;
  color: var(--primary);
  font-weight: 900;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 16px;
  padding-top: 16px;
}

.range-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.range-value {
  font-size: 12px;
  font-weight: 800;
  color: var(--primary);
}

.field-range {
  width: 100%;
  margin-top: 10px;
  accent-color: var(--primary);
}

.field-range:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 760px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
