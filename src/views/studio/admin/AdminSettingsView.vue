<template>
  <TablePageLayout title="" subtitle="" density="compact" variant="plain">
    <div class="settings-shell">
      <div class="settings-tabs">
        <button
          v-for="item in tabs"
          :key="item.key"
          type="button"
          class="settings-tab"
          :class="{ active: activeTab === item.key }"
          @click="activeTab = item.key"
        >
          {{ item.label }}
        </button>
      </div>

      <div class="settings-card">
        <div class="settings-head">
          <div>
            <div class="settings-title">{{ activeTabMeta.title }}</div>
            <div class="settings-sub">{{ activeTabMeta.description }}</div>
          </div>
          <div class="settings-actions">
            <Button variant="ghost" size="sm" :disabled="loading || saving" @click="load">
              刷新
            </Button>
            <Button variant="ghost" size="sm" :disabled="loading || saving" @click="resetCurrentTab">
              重置
            </Button>
            <Button size="sm" :disabled="loading || saving" @click="saveCurrentTab">
              {{ saving ? '保存中...' : '保存设置' }}
            </Button>
          </div>
        </div>

        <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

        <div v-if="activeTab === 'general'" class="settings-body">
          <div class="section-card">
            <div class="section-title">站点信息</div>
            <div class="field-grid">
              <div class="field">
                <div class="field-label">站点名称</div>
                <Input v-model="forms.general.siteName" :disabled="loading || saving" />
              </div>
              <div class="field">
                <div class="field-label">客服联系方式</div>
                <Input v-model="forms.general.supportContact" :disabled="loading || saving" />
              </div>
              <div class="field field-span-2">
                <div class="field-label">站点副标题</div>
                <Input v-model="forms.general.siteSubtitle" :disabled="loading || saving" />
              </div>
              <div class="field field-span-2">
                <div class="field-label">页脚版权文案</div>
                <Input v-model="forms.general.footerCopyright" :disabled="loading || saving" />
              </div>
            </div>
          </div>

          <div class="section-card">
            <div class="section-row">
              <div>
                <div class="section-title">注册开关</div>
                <div class="field-help">关闭后，前台会隐藏注册入口，后端也会直接拒绝新用户注册请求。</div>
              </div>
              <Switch v-model="forms.general.allowRegistration" :disabled="loading || saving" />
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'credits'" class="settings-body">
          <div class="section-card">
            <div class="section-row">
              <div>
                <div class="section-title">注册赠送余额</div>
                <div class="field-help">仅影响后续新注册用户，现有用户余额不会回溯调整。</div>
              </div>
              <Switch v-model="forms.signupBonus.enabled" :disabled="loading || saving" />
            </div>
            <div class="field-grid compact-top">
              <div class="field">
                <div class="field-label">注册来源</div>
                <Input model-value="用户名注册" disabled />
              </div>
              <div class="field">
                <div class="field-label">赠送余额</div>
                <Input v-model="forms.signupBonus.usernameBonus" type="number" :disabled="loading || saving" />
              </div>
            </div>
          </div>

          <div class="section-card">
            <div class="section-title">功能扣费价格</div>
            <div class="pricing-grid">
              <div class="pricing-cell head">操作</div>
              <div class="pricing-cell head">FREE</div>
              <div class="pricing-cell head">PRO</div>

              <div class="pricing-cell label">提示词润色</div>
              <div class="pricing-cell"><Input v-model="forms.pricing.free.promptEnhance" type="number" :disabled="loading || saving" /></div>
              <div class="pricing-cell"><Input v-model="forms.pricing.pro.promptEnhance" type="number" :disabled="loading || saving" /></div>

              <div class="pricing-cell label">文生图</div>
              <div class="pricing-cell"><Input v-model="forms.pricing.free.textToImage" type="number" :disabled="loading || saving" /></div>
              <div class="pricing-cell"><Input v-model="forms.pricing.pro.textToImage" type="number" :disabled="loading || saving" /></div>

              <div class="pricing-cell label">图生图</div>
              <div class="pricing-cell"><Input v-model="forms.pricing.free.imageToImage" type="number" :disabled="loading || saving" /></div>
              <div class="pricing-cell"><Input v-model="forms.pricing.pro.imageToImage" type="number" :disabled="loading || saving" /></div>
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'model'" class="settings-body">
          <div class="section-card">
            <div class="section-title">模型服务</div>
            <div class="field-grid">
              <div class="field field-span-2">
                <div class="field-label">接口地址</div>
                <Input v-model="forms.model.baseUrl" :disabled="loading || saving" />
                <div class="field-help">这里配置接口地址、模型名、超时等非敏感参数；API Key 仍建议放在服务端环境变量中。</div>
              </div>
              <div class="field">
                <div class="field-label">图片模型</div>
                <Input v-model="forms.model.imageModel" :disabled="loading || saving" />
              </div>
              <div class="field">
                <div class="field-label">抠图模型</div>
                <Input v-model="forms.model.cutoutModel" :disabled="loading || saving" />
                <div class="field-help">仅用于抠图工具，建议填写支持透明背景编辑的模型；留空时会回退到图片模型。</div>
              </div>
              <div class="field">
                <div class="field-label">文本模型</div>
                <Input v-model="forms.model.textModel" :disabled="loading || saving" />
              </div>
              <div class="field">
                <div class="field-label">超时时间（毫秒）</div>
                <Input v-model="forms.model.timeoutMs" type="number" :disabled="loading || saving" />
              </div>
              <div class="field">
                <div class="field-label">返回格式</div>
                <select v-model="forms.model.responseFormat" class="native-select" :disabled="loading || saving">
                  <option value="url">url</option>
                  <option value="b64_json">b64_json</option>
                </select>
              </div>
              <div class="field">
                <div class="field-label">尺寸格式</div>
                <select v-model="forms.model.sizeFormat" class="native-select" :disabled="loading || saving">
                  <option value="pixel">pixel</option>
                  <option value="ratio">ratio</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="settings-body">
          <div class="section-card">
            <div class="section-title">上传限制</div>
            <div class="field-grid">
              <div class="field">
                <div class="field-label">最大上传大小（MB）</div>
                <Input v-model="forms.upload.maxFileSizeMb" type="number" :disabled="loading || saving" />
                <div class="field-help">这里控制业务层允许的上传大小；如果部署层还有反向代理限制，需要同步调大。</div>
              </div>
            </div>

            <div class="field-group">
              <div class="field-label">允许上传格式</div>
              <div class="check-list">
                <label v-for="item in mimeOptions" :key="item.value" class="check-item">
                  <input
                    type="checkbox"
                    :value="item.value"
                    :checked="forms.upload.allowedMimeTypes.includes(item.value)"
                    :disabled="loading || saving"
                    @change="toggleMimeType(item.value, $event)"
                  />
                  <span>{{ item.label }}</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </TablePageLayout>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Button, Input, Switch, toastSuccess } from '../../../components/common'
import { TablePageLayout } from '../../../components/layout'
import { apiFetch } from '../../../utils/api'

const tabs = [
  { key: 'general', label: '通用设置', title: '通用设置', description: '管理站点名称、客服信息与注册开关。' },
  { key: 'credits', label: '积分规则', title: '积分规则', description: '管理注册赠送和各项功能的扣费价格。' },
  { key: 'model', label: '模型服务', title: '模型服务', description: '管理接口地址、模型名、返回格式和超时。' },
  { key: 'upload', label: '上传限制', title: '上传限制', description: '控制图生图上传大小与允许的图片格式。' }
]

const mimeOptions = [
  { label: 'PNG', value: 'image/png' },
  { label: 'JPEG', value: 'image/jpeg' },
  { label: 'WEBP', value: 'image/webp' }
]

const activeTab = ref('general')
const loading = ref(false)
const saving = ref(false)
const errorMsg = ref('')
const loadedSnapshot = ref(null)

const forms = reactive({
  general: {
    siteName: '',
    siteSubtitle: '',
    supportContact: '',
    allowRegistration: true,
    footerCopyright: ''
  },
  signupBonus: {
    enabled: true,
    usernameBonus: '5'
  },
  pricing: {
    free: { promptEnhance: '1', textToImage: '2', imageToImage: '3' },
    pro: { promptEnhance: '1', textToImage: '1', imageToImage: '2' }
  },
  model: {
    baseUrl: '',
    imageModel: '',
    cutoutModel: '',
    textModel: '',
    timeoutMs: '60000',
    responseFormat: 'b64_json',
    sizeFormat: 'pixel'
  },
  upload: {
    maxFileSizeMb: '25',
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp']
  }
})

const activeTabMeta = computed(() => tabs.find((item) => item.key === activeTab.value) || tabs[0])

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function applyBootstrap(data) {
  loadedSnapshot.value = clone(data)
  forms.general.siteName = String(data?.general?.siteName || '')
  forms.general.siteSubtitle = String(data?.general?.siteSubtitle || '')
  forms.general.supportContact = String(data?.general?.supportContact || '')
  forms.general.allowRegistration = data?.general?.allowRegistration !== false
  forms.general.footerCopyright = String(data?.general?.footerCopyright || '')

  forms.signupBonus.enabled = data?.signupBonus?.enabled !== false
  forms.signupBonus.usernameBonus = String(data?.signupBonus?.usernameBonus ?? 5)

  forms.pricing.free.promptEnhance = String(data?.pricing?.free?.promptEnhance ?? 1)
  forms.pricing.free.textToImage = String(data?.pricing?.free?.textToImage ?? 2)
  forms.pricing.free.imageToImage = String(data?.pricing?.free?.imageToImage ?? 3)
  forms.pricing.pro.promptEnhance = String(data?.pricing?.pro?.promptEnhance ?? 1)
  forms.pricing.pro.textToImage = String(data?.pricing?.pro?.textToImage ?? 1)
  forms.pricing.pro.imageToImage = String(data?.pricing?.pro?.imageToImage ?? 2)

  forms.model.baseUrl = String(data?.model?.baseUrl || '')
  forms.model.imageModel = String(data?.model?.imageModel || '')
  forms.model.cutoutModel = String(data?.model?.cutoutModel || '')
  forms.model.textModel = String(data?.model?.textModel || '')
  forms.model.timeoutMs = String(data?.model?.timeoutMs ?? 60000)
  forms.model.responseFormat = data?.model?.responseFormat === 'b64_json' ? 'b64_json' : 'url'
  forms.model.sizeFormat = data?.model?.sizeFormat === 'ratio' ? 'ratio' : 'pixel'

  forms.upload.maxFileSizeMb = String(data?.upload?.maxFileSizeMb ?? 25)
  forms.upload.allowedMimeTypes = Array.isArray(data?.upload?.allowedMimeTypes)
    ? data.upload.allowedMimeTypes.map((item) => String(item))
    : ['image/png', 'image/jpeg', 'image/webp']
}

function resetCurrentTab() {
  if (!loadedSnapshot.value) return
  applyBootstrap(loadedSnapshot.value)
  errorMsg.value = ''
}

function toSafeInt(value, fallback = 0) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(0, Math.floor(num))
}

function toggleMimeType(value, event) {
  if (event.target.checked) {
    if (!forms.upload.allowedMimeTypes.includes(value)) {
      forms.upload.allowedMimeTypes = [...forms.upload.allowedMimeTypes, value]
    }
    return
  }
  const next = forms.upload.allowedMimeTypes.filter((item) => item !== value)
  forms.upload.allowedMimeTypes = next.length ? next : [value]
}

async function load() {
  errorMsg.value = ''
  try {
    loading.value = true
    const data = await apiFetch('/api/admin/settings/bootstrap')
    applyBootstrap(data)
  } catch (e) {
    errorMsg.value = e.message || '加载系统设置失败'
  } finally {
    loading.value = false
  }
}

async function saveGeneral() {
  return apiFetch('/api/admin/settings/general', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteName: forms.general.siteName,
      siteSubtitle: forms.general.siteSubtitle,
      supportContact: forms.general.supportContact,
      allowRegistration: forms.general.allowRegistration,
      footerCopyright: forms.general.footerCopyright
    })
  })
}

async function saveCredits() {
  const signupBonus = await apiFetch('/api/admin/settings/signup-bonus', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enabled: forms.signupBonus.enabled,
      usernameBonus: toSafeInt(forms.signupBonus.usernameBonus, 5)
    })
  })

  const pricing = await apiFetch('/api/admin/settings/pricing', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      free: {
        promptEnhance: toSafeInt(forms.pricing.free.promptEnhance, 1),
        textToImage: toSafeInt(forms.pricing.free.textToImage, 2),
        imageToImage: toSafeInt(forms.pricing.free.imageToImage, 3)
      },
      pro: {
        promptEnhance: toSafeInt(forms.pricing.pro.promptEnhance, 1),
        textToImage: toSafeInt(forms.pricing.pro.textToImage, 1),
        imageToImage: toSafeInt(forms.pricing.pro.imageToImage, 2)
      }
    })
  })

  return { signupBonus, pricing }
}

async function saveModel() {
  return apiFetch('/api/admin/settings/model', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseUrl: forms.model.baseUrl,
      imageModel: forms.model.imageModel,
      cutoutModel: forms.model.cutoutModel,
      textModel: forms.model.textModel,
      timeoutMs: toSafeInt(forms.model.timeoutMs, 60000),
      responseFormat: forms.model.responseFormat,
      sizeFormat: forms.model.sizeFormat
    })
  })
}

async function saveUpload() {
  return apiFetch('/api/admin/settings/upload', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      maxFileSizeMb: toSafeInt(forms.upload.maxFileSizeMb, 25),
      allowedMimeTypes: forms.upload.allowedMimeTypes
    })
  })
}

async function saveCurrentTab() {
  errorMsg.value = ''
  try {
    saving.value = true
    if (activeTab.value === 'general') {
      await saveGeneral()
    } else if (activeTab.value === 'credits') {
      await saveCredits()
    } else if (activeTab.value === 'model') {
      await saveModel()
    } else {
      await saveUpload()
    }
    await load()
    toastSuccess('系统设置已保存')
  } catch (e) {
    errorMsg.value = e.message || '保存失败'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  load()
})
</script>

<style scoped>
.settings-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-tabs {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px);
}

.settings-tab {
  height: 36px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.settings-tab.active {
  color: var(--primary);
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.16);
}

.settings-card {
  padding: 22px;
  border-radius: 24px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.76);
  backdrop-filter: blur(18px);
  box-shadow: 0 12px 36px rgba(15, 23, 42, 0.06);
}

.settings-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.settings-title {
  font-size: 22px;
  font-weight: 950;
  color: var(--text);
}

.settings-sub {
  margin-top: 6px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.settings-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.settings-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-card {
  padding: 18px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.82);
}

.section-title {
  font-size: 15px;
  font-weight: 900;
  color: var(--text);
}

.section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}

.compact-top {
  margin-top: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-span-2 {
  grid-column: span 2;
}

.field-label {
  font-size: 13px;
  font-weight: 900;
  color: var(--text);
}

.field-help {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.pricing-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}

.pricing-cell {
  display: flex;
  align-items: center;
}

.pricing-cell.head,
.pricing-cell.label {
  font-size: 13px;
  font-weight: 900;
  color: var(--text);
}

.native-select {
  width: 100%;
  min-height: 42px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--text);
}

.field-group {
  margin-top: 18px;
}

.check-list {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.check-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(248, 250, 252, 0.7);
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 820px) {
  .settings-head,
  .section-row {
    flex-direction: column;
    align-items: stretch;
  }

  .field-grid,
  .pricing-grid {
    grid-template-columns: 1fr;
  }

  .field-span-2 {
    grid-column: span 1;
  }
}
</style>
