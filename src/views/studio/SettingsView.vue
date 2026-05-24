<template>
  <div class="settings-page">
    <section class="settings-hero">
      <div class="hero-main">
        <div class="hero-avatar">{{ userInitial }}</div>
        <div class="hero-copy">
          <div class="hero-eyebrow">Preferences</div>
          <h2>偏好设置</h2>
          <p>保存你的默认创作参数，新建作品时会自动带入。</p>
        </div>
      </div>
      <div class="hero-meta">
        <div class="meta-chip">
          <UserIcon :size="16" />
          <span>{{ authStore.user?.username || '未登录' }}</span>
        </div>
        <div class="meta-chip">
          <WalletIcon :size="16" />
          <span>余额 {{ authStore.user?.creditBalance ?? 0 }}</span>
        </div>
        <div class="meta-chip strong">
          {{ (authStore.user?.plan || 'free').toUpperCase() }}
        </div>
      </div>
    </section>

    <div class="settings-layout">
      <main class="settings-surface">
        <section class="settings-section">
          <div class="section-head">
            <div class="section-icon">
              <ImageIcon :size="18" />
            </div>
            <div>
              <div class="section-title">画布与生成</div>
              <div class="section-desc">控制默认比例、清晰度和一次生成张数。</div>
            </div>
          </div>

          <div class="field-block">
            <div class="field-title-row">
              <label class="label">默认图片比例</label>
              <span class="field-caption">{{ selectedRatioLabel }}</span>
            </div>
            <div class="ratio-options" role="group" aria-label="默认图片比例">
              <button
                v-for="ratio in ratioOptions"
                :key="ratio.value"
                type="button"
                class="ratio-option"
                :class="{ active: form.aspectRatio === ratio.value }"
                @click="form.aspectRatio = ratio.value"
              >
                <span class="ratio-frame" :class="`ratio-${ratio.value.replace(':', '-')}`"></span>
                <span>{{ ratio.label }}</span>
              </button>
            </div>
          </div>

          <div class="settings-grid compact">
            <div class="field-card">
              <div class="field-card-head">
                <SparklesIcon :size="17" />
                <label class="label">默认生成质量</label>
              </div>
              <SelectMenu v-model="form.qualityTier" :options="qualityTierOptions" placeholder="选择生成质量" />
            </div>

            <div class="field-card">
              <div class="field-card-head">
                <LayersIcon :size="17" />
                <label class="label">默认生成张数</label>
              </div>
              <SelectMenu v-model="form.count" :options="countOptions" placeholder="选择张数" />
            </div>
          </div>
        </section>

        <section class="settings-section">
          <div class="section-head">
            <div class="section-icon">
              <DownloadIcon :size="18" />
            </div>
            <div>
              <div class="section-title">导出与安全</div>
              <div class="section-desc">控制默认图片格式、压缩和审核策略。</div>
            </div>
          </div>

          <div class="settings-grid">
            <div class="field-card">
              <div class="field-card-head">
                <FileImageIcon :size="17" />
                <label class="label">默认输出格式</label>
              </div>
              <SelectMenu v-model="form.outputFormat" :options="outputFormatOptions" placeholder="选择格式" />
            </div>

            <div class="field-card">
              <div class="field-card-head">
                <ShieldCheckIcon :size="17" />
                <label class="label">默认审核等级</label>
              </div>
              <SelectMenu v-model="form.moderation" :options="moderationOptions" placeholder="选择审核等级" />
            </div>

            <div class="field-card">
              <div class="field-card-head">
                <ImageIcon :size="17" />
                <label class="label">默认背景策略</label>
              </div>
              <SelectMenu v-model="form.background" :options="backgroundOptions" placeholder="选择背景" />
            </div>

            <div class="field-card compression-card">
              <div class="range-label-row">
                <div class="field-card-head">
                  <SlidersHorizontalIcon :size="17" />
                  <label class="label">默认压缩率</label>
                </div>
                <span class="range-value">{{ compressionLabel }}</span>
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
              <div class="field-hint">{{ supportsCompression ? '数值越高，画质越好，文件越大。' : 'PNG 使用无损导出，不需要压缩率。' }}</div>
            </div>
          </div>
        </section>

        <section class="settings-section">
          <div class="section-head">
            <div class="section-icon">
              <SparklesIcon :size="18" />
            </div>
            <div>
              <div class="section-title">默认风格</div>
              <div class="section-desc">保存常用画面风格、品牌调性或禁用要求，创作时自动追加到提示词。</div>
            </div>
          </div>

          <div class="field-card style-card">
            <div class="field-card-head">
              <SparklesIcon :size="17" />
              <label class="label">风格要求</label>
            </div>
            <textarea
              v-model="form.stylePrompt"
              class="style-textarea"
              maxlength="500"
              placeholder="例如：干净高级的电商摄影，主体清晰，柔和自然光，不要文字、水印、Logo。"
            ></textarea>
            <div class="field-hint">{{ form.stylePrompt.length }} / 500。留空则不追加。</div>
          </div>
        </section>

        <section class="settings-section">
          <div class="section-head">
            <div class="section-icon">
              <LayersIcon :size="18" />
            </div>
            <div>
              <div class="section-title">项目风格板</div>
              <div class="section-desc">把常用项目的比例、标签和风格要求保存成可复用资产。</div>
            </div>
          </div>

          <div class="project-board-editor">
            <div class="settings-grid">
              <div class="field-card">
                <div class="field-card-head">
                  <LayersIcon :size="17" />
                  <label class="label">项目名称</label>
                </div>
                <input v-model="projectForm.name" class="plain-input" maxlength="40" placeholder="例如：夏季新品海报" />
              </div>
              <div class="field-card">
                <div class="field-card-head">
                  <ImageIcon :size="17" />
                  <label class="label">默认比例</label>
                </div>
                <SelectMenu v-model="projectForm.aspectRatio" :options="ratioOptions" placeholder="选择默认比例" />
              </div>
            </div>
            <div class="field-card">
              <div class="field-card-head">
                <FileImageIcon :size="17" />
                <label class="label">项目说明</label>
              </div>
              <input v-model="projectForm.description" class="plain-input" maxlength="120" placeholder="例如：统一用于小红书、电商详情和首图。" />
            </div>
            <div class="field-card">
              <div class="field-card-head">
                <ShieldCheckIcon :size="17" />
                <label class="label">默认标签</label>
              </div>
              <input v-model="projectForm.tags" class="plain-input" placeholder="多个标签用逗号分隔" />
            </div>
            <div class="field-card style-card">
              <div class="field-card-head">
                <SparklesIcon :size="17" />
                <label class="label">项目风格要求</label>
              </div>
              <textarea
                v-model="projectForm.stylePrompt"
                class="style-textarea"
                maxlength="500"
                placeholder="例如：品牌色以白色和浅绿色为主，真实摄影质感，背景简洁，主体突出。"
              ></textarea>
            </div>
            <div class="project-actions">
              <Button variant="ghost" @click="resetProjectForm">清空</Button>
              <Button @click="saveProjectBoard">{{ editingProjectId ? '更新风格板' : '保存风格板' }}</Button>
            </div>
          </div>

          <div v-if="projectBoards.length" class="project-board-list">
            <button
              v-for="board in projectBoards"
              :key="board.id"
              type="button"
              class="project-board-item"
              @click="editProjectBoard(board)"
            >
              <span class="project-board-main">
                <strong>{{ board.name }}</strong>
                <span>{{ board.description || board.stylePrompt || '未填写说明' }}</span>
              </span>
              <span class="project-board-meta">{{ board.aspectRatio }} · {{ board.tags.length }} 标签</span>
              <span class="project-board-delete" @click.stop="deleteProjectBoard(board.id)">删除</span>
            </button>
          </div>
          <div v-else class="field-hint">还没有项目风格板。保存后可以在创作页一键带入。</div>
        </section>

        <div class="settings-actions">
          <Button variant="ghost" @click="resetSettings">
            <template #icon>
              <RotateCcwIcon :size="17" />
            </template>
            恢复默认
          </Button>
          <Button @click="saveSettings">
            <template #icon>
              <SaveIcon :size="17" />
            </template>
            保存设置
          </Button>
        </div>
      </main>

      <aside class="settings-preview">
        <div class="preview-head">
          <div>
            <div class="preview-title">当前默认配置</div>
            <div class="preview-sub">新建创作会按此初始化。</div>
          </div>
          <div class="preview-dot"></div>
        </div>

        <div class="preview-canvas" :class="`preview-${form.aspectRatio.replace(':', '-')}`">
          <div class="preview-shine"></div>
          <span>{{ form.aspectRatio }}</span>
        </div>

        <div class="preview-list">
          <div class="preview-row">
            <span>质量</span>
            <strong>{{ selectedQualityLabel }}</strong>
          </div>
          <div class="preview-row">
            <span>张数</span>
            <strong>{{ selectedCountLabel }}</strong>
          </div>
          <div class="preview-row">
            <span>格式</span>
            <strong>{{ selectedFormatLabel }}</strong>
          </div>
          <div class="preview-row">
            <span>背景</span>
            <strong>{{ selectedBackgroundLabel }}</strong>
          </div>
          <div class="preview-row">
            <span>审核</span>
            <strong>{{ selectedModerationLabel }}</strong>
          </div>
          <div class="preview-row">
            <span>风格</span>
            <strong>{{ form.stylePrompt ? '已启用' : '未设置' }}</strong>
          </div>
        </div>

        <div class="preview-note">
          <SparklesIcon :size="15" />
          <span>这些设置只影响新的创作任务，不会修改历史作品。</span>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import {
  DownloadIcon,
  FileImageIcon,
  ImageIcon,
  LayersIcon,
  RotateCcwIcon,
  SaveIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  UserIcon,
  WalletIcon
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { DEFAULT_CREATE_SETTINGS, usePreferencesStore } from '../../stores/preferences'
import { Button, SelectMenu, toastSuccess } from '../../components/common'

const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()

const ratioOptions = [
  { label: '1:1 正方形', value: '1:1' },
  { label: '16:9 横向', value: '16:9' },
  { label: '9:16 竖向', value: '9:16' },
  { label: '4:3 横向', value: '4:3' },
  { label: '3:4 竖向', value: '3:4' }
]
const qualityTierOptions = [
  { label: '1K 标准', value: '1k' },
  { label: '2K 高清', value: '2k' },
  { label: '4K 超清', value: '4k' }
]
const countOptions = [
  { label: '1 张', value: 1 },
  { label: '2 张', value: 2 },
  { label: '4 张', value: 4 }
]
const outputFormatOptions = [
  { label: 'PNG', value: 'png' },
  { label: 'JPEG', value: 'jpeg' },
  { label: 'WEBP', value: 'webp' }
]
const backgroundOptions = [
  { label: '自动', value: 'auto' },
  { label: '透明背景', value: 'transparent' },
  { label: '纯色背景', value: 'opaque' }
]
const moderationOptions = [
  { label: '自动', value: 'auto' },
  { label: '低限制', value: 'low' }
]

const form = reactive({ ...preferencesStore.createSettings })
const editingProjectId = ref('')
const projectForm = reactive({
  name: '',
  description: '',
  aspectRatio: DEFAULT_CREATE_SETTINGS.aspectRatio,
  tags: '',
  stylePrompt: ''
})
const supportsCompression = computed(() => form.outputFormat === 'jpeg' || form.outputFormat === 'webp')
const projectBoards = computed(() => preferencesStore.projectBoards)
const userInitial = computed(() => {
  const name = String(authStore.user?.username || '').trim()
  return name ? name.charAt(0).toUpperCase() : 'U'
})
const selectedRatioLabel = computed(() => labelFor(ratioOptions, form.aspectRatio))
const selectedQualityLabel = computed(() => labelFor(qualityTierOptions, form.qualityTier))
const selectedCountLabel = computed(() => labelFor(countOptions, form.count))
const selectedFormatLabel = computed(() => labelFor(outputFormatOptions, form.outputFormat))
const selectedBackgroundLabel = computed(() => labelFor(backgroundOptions, form.background))
const selectedModerationLabel = computed(() => labelFor(moderationOptions, form.moderation))
const compressionLabel = computed(() => (supportsCompression.value ? `${form.outputCompression}%` : 'PNG 无损'))

watch(
  () => form.background,
  (value) => {
    if (value === 'transparent' && form.outputFormat === 'jpeg') {
      form.outputFormat = 'png'
    }
  }
)

watch(
  () => form.outputFormat,
  (value) => {
    if (value === 'jpeg' && form.background === 'transparent') {
      form.background = 'auto'
    }
  }
)

function saveSettings() {
  preferencesStore.updateCreateSettings(form)
  toastSuccess('默认创作设置已保存')
}

function resetSettings() {
  Object.assign(form, DEFAULT_CREATE_SETTINGS)
  preferencesStore.resetCreateSettings()
  toastSuccess('已恢复默认设置')
}

function labelFor(options, value) {
  return options.find((item) => item.value === value)?.label || String(value || '')
}

function parseTags(value) {
  return String(value || '')
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function resetProjectForm() {
  editingProjectId.value = ''
  Object.assign(projectForm, {
    name: '',
    description: '',
    aspectRatio: form.aspectRatio || DEFAULT_CREATE_SETTINGS.aspectRatio,
    tags: '',
    stylePrompt: ''
  })
}

function saveProjectBoard() {
  const board = preferencesStore.upsertProjectBoard({
    id: editingProjectId.value,
    name: projectForm.name,
    description: projectForm.description,
    aspectRatio: projectForm.aspectRatio,
    tags: parseTags(projectForm.tags),
    stylePrompt: projectForm.stylePrompt
  })
  if (!board) return
  editingProjectId.value = board.id
  toastSuccess('项目风格板已保存')
}

function editProjectBoard(board) {
  editingProjectId.value = board.id
  Object.assign(projectForm, {
    name: board.name,
    description: board.description || '',
    aspectRatio: board.aspectRatio || DEFAULT_CREATE_SETTINGS.aspectRatio,
    tags: (board.tags || []).join('，'),
    stylePrompt: board.stylePrompt || ''
  })
}

function deleteProjectBoard(id) {
  preferencesStore.removeProjectBoard(id)
  if (editingProjectId.value === id) resetProjectForm()
  toastSuccess('项目风格板已删除')
}
</script>

<style scoped>
.settings-page {
  display: grid;
  gap: 18px;
  width: 100%;
  max-width: 1180px;
}

.settings-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 22px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: calc(var(--radius-lg) + 6px);
  background:
    radial-gradient(920px 320px at 8% -20%, rgba(99, 102, 241, 0.18), transparent 58%),
    radial-gradient(820px 320px at 94% 0%, rgba(236, 72, 153, 0.12), transparent 58%),
    rgba(255, 255, 255, 0.72);
  box-shadow: 0 18px 60px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(20px);
}

.hero-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.hero-avatar {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  flex: none;
  border-radius: 18px;
  background: var(--gradient-primary);
  color: #fff;
  font-size: 16px;
  font-weight: 950;
  box-shadow: 0 16px 36px rgba(99, 102, 241, 0.26);
}

.hero-copy {
  min-width: 0;
}

.hero-eyebrow {
  margin-bottom: 4px;
  color: var(--primary);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hero-copy h2 {
  color: var(--text);
  font-size: 23px;
  font-weight: 950;
  line-height: 1.15;
}

.hero-copy p {
  margin-top: 7px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
  font-weight: 700;
}

.hero-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-chip {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 11px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: rgba(15, 23, 42, 0.72);
  font-size: 12px;
  font-weight: 900;
}

.meta-chip.strong {
  color: var(--primary);
  border-color: rgba(99, 102, 241, 0.2);
  background: rgba(99, 102, 241, 0.08);
}

.settings-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 18px;
  align-items: start;
}

.settings-surface,
.settings-preview {
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: calc(var(--radius-lg) + 4px);
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 14px 44px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(18px);
}

.settings-surface {
  overflow: hidden;
}

.settings-section {
  padding: 22px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}

.settings-section:first-child {
  border-top: none;
}

.section-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.section-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  flex: none;
  border-radius: 14px;
  border: 1px solid rgba(99, 102, 241, 0.14);
  background: rgba(99, 102, 241, 0.08);
  color: var(--primary);
}

.section-title {
  font-size: 16px;
  font-weight: 900;
  color: var(--text);
}

.section-desc {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--muted);
  font-weight: 700;
}

.field-block {
  display: grid;
  gap: 10px;
}

.field-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.field-caption {
  color: var(--primary);
  font-size: 12px;
  font-weight: 900;
}

.ratio-options {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.ratio-option {
  min-width: 0;
  min-height: 86px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.76);
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s, color 0.18s, box-shadow 0.18s, transform 0.18s;
}

.ratio-option:hover {
  border-color: rgba(99, 102, 241, 0.24);
  background: rgba(255, 255, 255, 0.94);
  transform: translateY(-1px);
}

.ratio-option.active {
  color: var(--primary);
  border-color: rgba(99, 102, 241, 0.38);
  background: rgba(99, 102, 241, 0.07);
  box-shadow: 0 12px 28px rgba(99, 102, 241, 0.12);
}

.ratio-frame {
  display: block;
  border: 2px solid currentColor;
  border-radius: 5px;
  opacity: 0.72;
}

.ratio-option.active .ratio-frame {
  opacity: 1;
}

.ratio-1-1 {
  width: 25px;
  height: 25px;
}

.ratio-16-9 {
  width: 34px;
  height: 20px;
}

.ratio-9-16 {
  width: 20px;
  height: 34px;
}

.ratio-4-3 {
  width: 31px;
  height: 24px;
}

.ratio-3-4 {
  width: 24px;
  height: 31px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.settings-grid.compact {
  margin-top: 14px;
}

.field-card {
  min-width: 0;
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.62);
}

.field-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--primary);
}

.field-card-head .label {
  margin-bottom: 0;
  color: var(--text);
}

.field-hint {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
  font-weight: 700;
}

.style-card {
  gap: 12px;
}

.style-textarea {
  min-height: 112px;
  width: 100%;
  resize: vertical;
  padding: 12px 13px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.76);
  color: var(--text);
  font-size: 13px;
  line-height: 1.6;
  font-weight: 700;
  outline: none;
}

.style-textarea:focus {
  border-color: rgba(99, 102, 241, 0.34);
  background: #fff;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.08);
}

.project-board-editor {
  display: grid;
  gap: 12px;
}

.plain-input {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.76);
  color: var(--text);
  font-size: 13px;
  font-weight: 750;
  outline: none;
}

.plain-input:focus {
  border-color: rgba(99, 102, 241, 0.34);
  background: #fff;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.08);
}

.project-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.project-board-list {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.project-board-item {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.62);
  text-align: left;
  cursor: pointer;
}

.project-board-item:hover {
  border-color: rgba(99, 102, 241, 0.22);
  background: rgba(255, 255, 255, 0.9);
}

.project-board-main {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.project-board-main strong {
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
}

.project-board-main span,
.project-board-meta {
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-board-delete {
  color: var(--accent);
  font-size: 12px;
  font-weight: 900;
}

.range-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.range-value {
  font-size: 12px;
  font-weight: 900;
  color: var(--primary);
  white-space: nowrap;
}

.field-range {
  width: 100%;
  accent-color: var(--primary);
}

.field-range:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 18px 22px 22px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}

.settings-preview {
  position: sticky;
  top: 18px;
  padding: 18px;
}

.preview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.preview-title {
  color: var(--text);
  font-size: 15px;
  font-weight: 950;
}

.preview-sub {
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
}

.preview-dot {
  width: 10px;
  height: 10px;
  margin-top: 5px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 0 6px rgba(236, 72, 153, 0.10);
}

.preview-canvas {
  position: relative;
  display: grid;
  place-items: center;
  margin: 0 auto 16px;
  overflow: hidden;
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(99, 102, 241, 0.16), rgba(236, 72, 153, 0.13)),
    rgba(255, 255, 255, 0.72);
  color: var(--primary);
  font-size: 13px;
  font-weight: 950;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.62), 0 18px 36px rgba(99, 102, 241, 0.12);
}

.preview-shine {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.18) 1px, transparent 1px),
    linear-gradient(0deg, rgba(255, 255, 255, 0.18) 1px, transparent 1px);
  background-size: 18px 18px;
  opacity: 0.6;
}

.preview-canvas span {
  position: relative;
  z-index: 1;
}

.preview-1-1 {
  width: 168px;
  height: 168px;
}

.preview-16-9 {
  width: 224px;
  height: 126px;
}

.preview-9-16 {
  width: 126px;
  height: 224px;
}

.preview-4-3 {
  width: 200px;
  height: 150px;
}

.preview-3-4 {
  width: 150px;
  height: 200px;
}

.preview-list {
  display: grid;
  gap: 8px;
}

.preview-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  color: var(--muted);
  font-size: 12px;
  font-weight: 850;
}

.preview-row strong {
  color: var(--text);
  font-size: 12px;
  font-weight: 950;
  text-align: right;
}

.preview-note {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding: 12px;
  border: 1px solid rgba(99, 102, 241, 0.14);
  border-radius: 14px;
  background: rgba(99, 102, 241, 0.06);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
  font-weight: 750;
}

.preview-note svg {
  flex: none;
  color: var(--primary);
  margin-top: 1px;
}

@media (max-width: 1020px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }

  .settings-preview {
    position: static;
  }
}

@media (max-width: 760px) {
  .settings-hero {
    flex-direction: column;
  }

  .hero-meta {
    justify-content: flex-start;
  }

  .ratio-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .settings-grid {
    grid-template-columns: 1fr;
  }

  .settings-actions {
    flex-direction: column-reverse;
  }
}
</style>
