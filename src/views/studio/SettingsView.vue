<template>
  <div class="settings-page">
    <section class="settings-hero">
      <div class="hero-main">
        <div class="hero-avatar">{{ userInitial }}</div>
        <div class="hero-copy">
          <div class="hero-eyebrow">Preferences</div>
          <h2>账户与偏好</h2>
          <p>查看账户状态，并保存新建作品时自动带入的默认创作参数。</p>
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

    <section class="account-section">
      <div class="section-head account-head">
        <div class="section-icon">
          <UserIcon :size="18" />
        </div>
        <div>
          <div class="section-title">账户资料</div>
          <div class="section-desc">这些信息来自当前登录账户，仅用于状态确认。</div>
        </div>
      </div>
      <div class="account-grid">
        <div class="account-item">
          <span>用户名</span>
          <strong>{{ authStore.user?.username || '' }}</strong>
        </div>
        <div class="account-item">
          <span>角色</span>
          <strong>{{ authStore.user?.role || '' }}</strong>
        </div>
        <div class="account-item">
          <span>套餐</span>
          <strong>{{ authStore.user?.plan || '' }}</strong>
        </div>
        <div class="account-item">
          <span>余额</span>
          <strong>{{ authStore.user?.creditBalance ?? 0 }}</strong>
        </div>
        <div class="account-item account-id">
          <span>用户 ID</span>
          <strong>{{ authStore.user?.id || '' }}</strong>
          <Button variant="ghost" size="xs" @click="copyUserId">复制</Button>
        </div>
        <div v-if="authStore.user?.createdAt" class="account-item">
          <span>创建时间</span>
          <strong>{{ formatTime(authStore.user.createdAt) }}</strong>
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
                <SlidersHorizontalIcon :size="17" />
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
import { computed, reactive, watch } from 'vue'
import {
  DownloadIcon,
  FileImageIcon,
  ImageIcon,
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
import { Button, SelectMenu, toastError, toastSuccess } from '../../components/common'

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
const supportsCompression = computed(() => form.outputFormat === 'jpeg' || form.outputFormat === 'webp')
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

function formatTime(val) {
  if (!val) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(val))
}

async function copyUserId() {
  const value = String(authStore.user?.id || '').trim()
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    toastSuccess('已复制用户 ID')
  } catch {
    toastError('复制失败')
  }
}

</script>

<style scoped>
.settings-page {
  display: grid;
  gap: 18px;
  width: 100%;
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
    radial-gradient(920px 320px at 8% -20%, rgba(37, 99, 235, 0.12), transparent 58%),
    radial-gradient(820px 320px at 94% 0%, rgba(14, 165, 233, 0.08), transparent 58%),
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
  box-shadow: 0 16px 32px rgba(37, 99, 235, 0.18);
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
  border-color: rgba(37, 99, 235, 0.2);
  background: rgba(37, 99, 235, 0.08);
}

.settings-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 18px;
  align-items: start;
}

.settings-surface,
.settings-preview,
.account-section {
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: calc(var(--radius-lg) + 4px);
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 14px 44px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(18px);
}

.settings-surface {
  overflow: hidden;
}

.account-section {
  padding: 20px 22px 22px;
}

.account-head {
  margin-bottom: 14px;
}

.account-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.account-item {
  min-width: 0;
  min-height: 74px;
  display: grid;
  align-content: center;
  gap: 7px;
  padding: 13px 14px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.62);
}

.account-item span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
}

.account-item strong {
  min-width: 0;
  color: var(--text);
  font-size: 13px;
  font-weight: 950;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-id {
  grid-template-columns: minmax(0, 1fr) auto;
}

.account-id span,
.account-id strong {
  grid-column: 1 / 2;
}

.account-id :deep(.btn) {
  grid-column: 2 / 3;
  grid-row: 1 / 3;
  align-self: center;
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
  border: 1px solid rgba(37, 99, 235, 0.14);
  background: rgba(37, 99, 235, 0.08);
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
  border-color: rgba(37, 99, 235, 0.24);
  background: rgba(255, 255, 255, 0.94);
  transform: translateY(-1px);
}

.ratio-option.active {
  color: var(--primary);
  border-color: rgba(37, 99, 235, 0.38);
  background: rgba(37, 99, 235, 0.07);
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.12);
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
  background: var(--primary);
  box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.10);
}

.preview-canvas {
  position: relative;
  display: grid;
  place-items: center;
  margin: 0 auto 16px;
  overflow: hidden;
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.14), rgba(14, 165, 233, 0.09)),
    rgba(255, 255, 255, 0.72);
  color: var(--primary);
  font-size: 13px;
  font-weight: 950;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.62), 0 18px 36px rgba(37, 99, 235, 0.12);
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
  border: 1px solid rgba(37, 99, 235, 0.14);
  border-radius: 14px;
  background: rgba(37, 99, 235, 0.06);
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
  .account-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

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

  .account-grid {
    grid-template-columns: 1fr;
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
