<template>
  <div class="models-view">
    <div class="models-toolbar">
      <Input v-model="searchText" size="sm" placeholder="搜索模板、场景、提示词" />
      <div class="source-switch" aria-label="模板来源">
        <button
          v-for="item in sourceFilters"
          :key="item.value"
          type="button"
          class="source-switch-item"
          :class="{ active: sourceFilter === item.value }"
          @click="sourceFilter = item.value"
        >
          {{ item.label }}
        </button>
      </div>
      <Button
        size="sm"
        :variant="favoritesOnly ? 'primary' : 'ghost'"
        @click="favoritesOnly = !favoritesOnly"
      >
        <template #icon>
          <StarIcon :size="15" />
        </template>
        只看收藏
      </Button>
      <Button size="sm" :disabled="!authStore.user" @click="openTemplateEditor()">
        <template #icon>
          <PlusIcon :size="15" />
        </template>
        新建模板
      </Button>
    </div>

    <div class="flex gap-2 flex-wrap mb-8">
      <Button
        v-for="cat in categories"
        :key="cat"
        class="btn-pill"
        :variant="activeCategory === cat ? 'primary' : 'ghost'"
        @click="activeCategory = cat"
      >
        {{ cat }}
      </Button>
    </div>
    
    <div v-if="loading" class="templates-state">灵感模板加载中...</div>
    <div v-else-if="loadError" class="templates-state error">{{ loadError }}</div>
    <div v-else-if="!filteredTemplates.length" class="templates-state">
      没有匹配的模板
    </div>
    <div v-else class="grid-templates">
      <div v-for="tpl in filteredTemplates" :key="tpl.templateKey" class="template-card flex flex-col h-full">
        <div class="tpl-cover flex flex-col p-4 relative">
          <img v-if="tpl.coverImage" :src="tpl.coverImage" alt="cover" class="tpl-cover-img" />
          <div v-else class="tpl-cover-fallback">无封面</div>
          <div class="tpl-cover-overlay"></div>
          <div class="tpl-card-actions">
            <button
              type="button"
              class="icon-btn favorite-btn"
              :class="{ active: isFavoriteTemplate(tpl) }"
              :title="isFavoriteTemplate(tpl) ? '取消收藏' : '收藏模板'"
              @click.stop="toggleFavoriteTemplate(tpl)"
            >
              <StarIcon :size="16" />
            </button>
            <button
              v-if="tpl.sourceType === 'user'"
              type="button"
              class="icon-btn"
              title="编辑模板"
              @click.stop="openTemplateEditor(tpl)"
            >
              <PencilIcon :size="15" />
            </button>
            <button
              v-if="tpl.sourceType === 'user'"
              type="button"
              class="icon-btn danger"
              title="删除模板"
              @click.stop="deleteUserTemplate(tpl)"
            >
              <Trash2Icon :size="15" />
            </button>
          </div>
          <span class="text-eyebrow mt-auto" style="position: relative; z-index: 1; background: rgba(255,255,255,0.9); padding: 4px 8px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); align-self: flex-start;">
            {{ tpl.category }}
          </span>
          <span v-if="tpl.sourceType === 'user'" class="tpl-source-pill">我的模板</span>
        </div>
        <div class="tpl-body p-4 flex flex-col flex-1 justify-between" style="padding: 20px;">
          <div class="flex flex-col gap-2 mb-4">
            <h3 class="text-h3">{{ tpl.title }}</h3>
            <p class="text-muted" style="font-size: 14px; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 8px;">
              {{ tpl.desc }}
            </p>
            <div class="prompt-preview">
              <code style="display: block; white-space: pre-wrap; word-break: break-word; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; line-height: 1.5;">{{ tpl.prompt }}</code>
            </div>
            <div v-if="tpl.arguments.length" class="argument-summary">
              可填写 {{ tpl.arguments.length }} 个模板参数
            </div>
          </div>
          <Button
            variant="ghost"
            class="w-full tpl-use-btn"
            @click="prepareTemplate(tpl)"
          >
            {{ tpl.arguments.length ? '填写参数' : '带入工作台' }}
          </Button>
        </div>
      </div>
    </div>

    <Modal v-model:open="templateModalOpen" :title="selectedTemplate?.title || '填写模板参数'" size="lg">
      <div class="template-form">
        <p class="template-form-desc">
          填写后会替换模板中的占位参数，再带入工作台。
        </p>
        <div class="argument-grid">
          <div v-for="argument in selectedTemplateArgs" :key="argument.key" class="argument-field">
            <label class="label">{{ argument.label }}</label>
            <Input
              v-model="templateArgumentValues[argument.key]"
              :placeholder="argument.defaultValue"
            />
          </div>
        </div>
        <div class="resolved-preview">
          <div class="resolved-preview-label">生成提示词预览</div>
          <code>{{ resolvedTemplatePrompt }}</code>
        </div>
      </div>

      <template #footer>
        <div class="template-modal-actions">
          <Button variant="ghost" @click="templateModalOpen = false">取消</Button>
          <Button @click="useResolvedTemplate">带入工作台</Button>
        </div>
      </template>
    </Modal>

    <Modal v-model:open="editorOpen" :title="editingTemplateId ? '编辑模板' : '新建模板'" size="lg">
      <form class="template-editor" @submit.prevent="saveUserTemplate">
        <div class="editor-grid">
          <label class="editor-field">
            <span class="label">模板名称</span>
            <Input v-model="templateForm.title" placeholder="例如：电商产品主图" />
          </label>
          <label class="editor-field">
            <span class="label">分类</span>
            <Input v-model="templateForm.category" placeholder="我的模板" />
          </label>
          <label class="editor-field">
            <span class="label">默认比例</span>
            <select v-model="templateForm.aspectRatio" class="input">
              <option value="">不指定</option>
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="4:3">4:3</option>
              <option value="3:4">3:4</option>
            </select>
          </label>
          <label class="editor-field editor-field-wide">
            <span class="label">描述</span>
            <Input v-model="templateForm.description" placeholder="说明这个模板适合什么场景" />
          </label>
        </div>

        <label class="editor-field">
          <span class="label">提示词</span>
          <textarea
            v-model="templateForm.prompt"
            class="textarea editor-prompt"
            placeholder='用 {argument name="主体" default="玻璃杯"} 标记可填写参数'
          ></textarea>
        </label>

        <div class="editor-arguments-head">
          <div>
            <div class="label">模板参数</div>
            <p>保存变量默认值和示例；填参时会替换同名占位符。</p>
          </div>
          <div class="editor-argument-actions">
            <Button type="button" variant="ghost" size="sm" @click="syncArgumentsFromPrompt">
              从提示词识别
            </Button>
            <Button type="button" variant="ghost" size="sm" @click="addTemplateArgument">
              添加参数
            </Button>
          </div>
        </div>

        <div v-if="templateForm.arguments.length" class="editor-arguments">
          <div
            v-for="(argument, index) in templateForm.arguments"
            :key="argument.localId"
            class="editor-argument-row"
          >
            <Input v-model="argument.key" size="sm" placeholder="变量名" />
            <Input v-model="argument.label" size="sm" placeholder="显示名称" />
            <Input v-model="argument.defaultValue" size="sm" placeholder="默认值" />
            <Input v-model="argument.example" size="sm" placeholder="示例" />
            <button
              type="button"
              class="argument-remove"
              title="移除参数"
              @click="removeTemplateArgument(index)"
            >
              <Trash2Icon :size="15" />
            </button>
          </div>
        </div>
        <div v-else class="editor-empty-arguments">
          暂无参数。可手动添加，或在提示词里写入占位符后点击识别。
        </div>
      </form>

      <template #footer>
        <div class="template-modal-actions">
          <Button variant="ghost" @click="editorOpen = false">取消</Button>
          <Button :loading="savingTemplate" @click="saveUserTemplate">
            {{ editingTemplateId ? '保存修改' : '创建模板' }}
          </Button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { PencilIcon, PlusIcon, StarIcon, Trash2Icon } from 'lucide-vue-next'
import { Button, Input, Modal, confirmDanger, toastError, toastSuccess } from '../../components/common'
import { usePreferencesStore } from '../../stores/preferences'
import { useAuthStore } from '../../stores/auth'
import { apiFetch } from '../../utils/api'

const router = useRouter()
const preferencesStore = usePreferencesStore()
const authStore = useAuthStore()

const activeCategory = ref("全部")
const searchText = ref("")
const favoritesOnly = ref(false)
const sourceFilter = ref("all")
const loading = ref(true)
const loadError = ref("")
const templates = ref([])
const userTemplates = ref([])
const userTemplatesLoaded = ref(false)
const templateModalOpen = ref(false)
const selectedTemplate = ref(null)
const templateArgumentValues = ref({})
const editorOpen = ref(false)
const editingTemplateId = ref("")
const savingTemplate = ref(false)
const templateForm = reactive({
  title: '',
  description: '',
  category: '我的模板',
  aspectRatio: '',
  prompt: '',
  arguments: []
})

const ARGUMENT_PATTERN = /\{argument\s+name=(["'])(.*?)\1\s+default=(["'])(.*?)\3\s*\}/g
const sourceFilters = [
  { value: 'all', label: '全部' },
  { value: 'system', label: '系统模板' },
  { value: 'user', label: '我的模板' }
]

onMounted(() => {
  loadTemplates()
  syncTemplateFavorites()
  loadUserTemplates()
})

async function syncTemplateFavorites() {
  if (!authStore.user?.id) return
  const localIds = preferencesStore.favoriteTemplateIds.slice()
  try {
    if (localIds.length) {
      await preferencesStore.importServerTemplateFavorites(localIds)
      return
    }
    await preferencesStore.loadServerTemplateFavorites()
  } catch {
    void 0
  }
}

async function loadTemplates() {
  loading.value = true
  loadError.value = ""
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/inspiration-templates.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    templates.value = Array.isArray(data) ? data : []
  } catch {
    loadError.value = "灵感模板暂时无法加载，请稍后重试。"
  } finally {
    loading.value = false
  }
}

async function loadUserTemplates() {
  if (!authStore.user?.id) {
    userTemplates.value = []
    userTemplatesLoaded.value = true
    return
  }
  try {
    const data = await apiFetch('/api/templates/user', undefined, { toast: false })
    userTemplates.value = Array.isArray(data?.templates) ? data.templates : []
  } catch {
    userTemplates.value = []
  } finally {
    userTemplatesLoaded.value = true
  }
}

const categories = computed(() => {
  const set = new Set()
  for (const item of allTemplates.value) {
    if (item?.category) set.add(String(item.category))
  }
  return ["全部", ...Array.from(set)]
})

const allTemplates = computed(() => [
  ...templates.value.map((tpl) => ({ ...tpl, sourceType: 'system' })),
  ...userTemplates.value.map((tpl) => ({ ...tpl, sourceType: 'user', coverImage: tpl.coverImage || '' }))
])

const normalizedTemplates = computed(() => {
  return allTemplates.value.map((tpl) => ({
    ...tpl,
    templateKey: templateId(tpl),
    desc: tpl.desc ?? tpl.description ?? '',
    arguments: normalizeTemplateArguments(tpl),
    searchText: [tpl.title, tpl.desc, tpl.prompt, tpl.category].join(' ').toLowerCase()
  }))
})

const filteredTemplates = computed(() => {
  const keyword = String(searchText.value || '').trim().toLowerCase()
  return normalizedTemplates.value.filter((tpl) => {
    const matchesCategory = activeCategory.value === "全部" || tpl.category === activeCategory.value
    const matchesKeyword = !keyword || tpl.searchText.includes(keyword)
    const matchesFavorite = !favoritesOnly.value || isFavoriteTemplate(tpl)
    const matchesSource = sourceFilter.value === 'all' || tpl.sourceType === sourceFilter.value
    return matchesCategory && matchesKeyword && matchesFavorite && matchesSource
  })
})

function templateId(tpl) {
  const sourceType = String(tpl?.sourceType || 'system')
  const id = String(tpl?.id || tpl?.title || tpl?.prompt || '')
  return sourceType === 'user' ? `user:${id}` : id
}

function isFavoriteTemplate(tpl) {
  return preferencesStore.isFavoriteTemplate(tpl.templateKey || templateId(tpl))
}

async function toggleFavoriteTemplate(tpl) {
  const id = tpl.templateKey || templateId(tpl)
  const nextFavorite = !preferencesStore.isFavoriteTemplate(id)
  preferencesStore.toggleFavoriteTemplate(id)
  if (!authStore.user?.id) return

  try {
    await preferencesStore.setServerTemplateFavorite(id, nextFavorite)
  } catch (error) {
    preferencesStore.toggleFavoriteTemplate(id)
    toastError(error?.message || '模板收藏更新失败')
  }
}

function templateArguments(tpl) {
  const prompt = String(tpl?.prompt || '')
  const matches = []
  const seen = new Set()
  for (const match of prompt.matchAll(ARGUMENT_PATTERN)) {
    const label = String(match[2] || '').trim()
    if (!label || seen.has(label)) continue
    seen.add(label)
    matches.push({
      key: label,
      label,
      defaultValue: String(match[4] || '')
    })
  }
  return matches
}

function normalizeTemplateArguments(tpl) {
  const explicit = Array.isArray(tpl?.arguments)
    ? tpl.arguments
        .map((argument) => ({
          key: String(argument?.key || '').trim(),
          label: String(argument?.label || argument?.key || '').trim(),
          defaultValue: String(argument?.defaultValue || ''),
          example: String(argument?.example || '')
        }))
        .filter((argument) => argument.key)
    : []
  return explicit.length ? explicit : templateArguments(tpl)
}

const selectedTemplateArgs = computed(() => normalizeTemplateArguments(selectedTemplate.value))
const resolvedTemplatePrompt = computed(() => {
  if (!selectedTemplate.value) return ''
  return resolveTemplatePrompt(selectedTemplate.value, templateArgumentValues.value)
})

function resolveTemplatePrompt(tpl, values = {}) {
  return String(tpl?.prompt || '').replace(ARGUMENT_PATTERN, (_raw, _nameQuote, name, _defaultQuote, defaultValue) => {
    const value = String(values[name] ?? '').trim()
    return value || defaultValue
  })
}

function prepareTemplate(tpl) {
  const args = tpl.arguments || templateArguments(tpl)
  if (!args.length) {
    useTemplate(tpl, tpl.prompt)
    return
  }
  selectedTemplate.value = tpl
  templateArgumentValues.value = Object.fromEntries(
    args.map((argument) => [argument.key, argument.defaultValue]),
  )
  templateModalOpen.value = true
}

function useResolvedTemplate() {
  if (!selectedTemplate.value) return
  useTemplate(selectedTemplate.value, resolvedTemplatePrompt.value)
  templateModalOpen.value = false
}

function useTemplate(tpl, prompt = tpl.prompt) {
  router.push({
    path: '/studio',
    query: {
      prompt,
      ...(tpl.aspectRatio ? { ratio: tpl.aspectRatio } : {})
    }
  })
}

function resetTemplateForm() {
  editingTemplateId.value = ''
  Object.assign(templateForm, {
    title: '',
    description: '',
    category: '我的模板',
    aspectRatio: '',
    prompt: '',
    arguments: []
  })
}

function argumentLocalId() {
  return crypto.randomUUID()
}

function toFormArguments(args = []) {
  return normalizeTemplateArguments({ arguments: args }).map((argument) => ({
    ...argument,
    localId: argumentLocalId()
  }))
}

function openTemplateEditor(tpl = null) {
  if (!authStore.user?.id) {
    toastError('请先登录后再创建模板')
    return
  }
  resetTemplateForm()
  if (tpl) {
    editingTemplateId.value = String(tpl.id || '')
    Object.assign(templateForm, {
      title: String(tpl.title || ''),
      description: String(tpl.desc || tpl.description || ''),
      category: String(tpl.category || '我的模板'),
      aspectRatio: String(tpl.aspectRatio || ''),
      prompt: String(tpl.prompt || ''),
      arguments: toFormArguments(tpl.arguments)
    })
  }
  editorOpen.value = true
}

function syncArgumentsFromPrompt() {
  const parsed = templateArguments({ prompt: templateForm.prompt })
  const currentByKey = new Map(
    templateForm.arguments
      .filter((argument) => String(argument.key || '').trim())
      .map((argument) => [String(argument.key || '').trim(), argument]),
  )
  templateForm.arguments = parsed.map((argument) => {
    const existing = currentByKey.get(argument.key)
    return {
      localId: existing?.localId || argumentLocalId(),
      key: argument.key,
      label: existing?.label || argument.label,
      defaultValue: existing?.defaultValue || argument.defaultValue,
      example: existing?.example || ''
    }
  })
}

function addTemplateArgument() {
  templateForm.arguments.push({
    localId: argumentLocalId(),
    key: '',
    label: '',
    defaultValue: '',
    example: ''
  })
}

function removeTemplateArgument(index) {
  templateForm.arguments.splice(index, 1)
}

function serializeTemplateForm() {
  const seen = new Set()
  return {
    title: templateForm.title,
    description: templateForm.description,
    category: templateForm.category || '我的模板',
    aspectRatio: templateForm.aspectRatio,
    prompt: templateForm.prompt,
    arguments: templateForm.arguments
      .map((argument) => ({
        key: String(argument.key || '').trim(),
        label: String(argument.label || argument.key || '').trim(),
        defaultValue: String(argument.defaultValue || ''),
        example: String(argument.example || '')
      }))
      .filter((argument) => {
        if (!argument.key || seen.has(argument.key)) return false
        seen.add(argument.key)
        return true
      })
  }
}

async function saveUserTemplate() {
  if (savingTemplate.value) return
  const payload = serializeTemplateForm()
  if (!payload.title.trim()) {
    toastError('请输入模板名称')
    return
  }
  if (!payload.prompt.trim()) {
    toastError('请输入提示词内容')
    return
  }
  savingTemplate.value = true
  try {
    const url = editingTemplateId.value
      ? `/api/templates/user/${encodeURIComponent(editingTemplateId.value)}`
      : '/api/templates/user'
    const data = await apiFetch(url, {
      method: editingTemplateId.value ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const saved = data?.template
    if (saved) {
      const index = userTemplates.value.findIndex((tpl) => tpl.id === saved.id)
      if (index >= 0) userTemplates.value.splice(index, 1, saved)
      else userTemplates.value = [saved, ...userTemplates.value]
    } else {
      await loadUserTemplates()
    }
    editorOpen.value = false
    toastSuccess(editingTemplateId.value ? '模板已保存' : '模板已创建')
  } catch (error) {
    toastError(error?.message || '模板保存失败')
  } finally {
    savingTemplate.value = false
  }
}

async function deleteUserTemplate(tpl) {
  const id = String(tpl?.id || '').trim()
  if (!id) return
  const confirmed = await confirmDanger({
    title: '删除模板',
    objectName: tpl.title || '未命名模板',
    message: '确认删除这个模板吗？',
    details: '删除后无法恢复。',
    confirmText: '删除'
  })
  if (!confirmed) return
  try {
    await apiFetch(`/api/templates/user/${encodeURIComponent(id)}`, { method: 'DELETE' })
    userTemplates.value = userTemplates.value.filter((item) => item.id !== id)
    toastSuccess('模板已删除')
  } catch (error) {
    toastError(error?.message || '模板删除失败')
  }
}
</script>

<style scoped>
.models-view {
  min-width: 0;
}

.models-toolbar {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto auto auto;
  gap: 10px;
  align-items: center;
  margin-bottom: 18px;
}

.source-switch {
  display: inline-flex;
  min-height: 42px;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.66);
}

.source-switch-item {
  min-width: 74px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;
}

.source-switch-item.active {
  border: 1px solid rgba(37, 99, 235, 0.18);
  background: rgba(37, 99, 235, 0.10);
  color: var(--primary);
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.10);
}

.grid-templates {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.templates-state {
  display: grid;
  min-height: 220px;
  place-items: center;
  border: 1px dashed var(--line);
  border-radius: var(--radius-md);
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
}

.templates-state.error {
  color: var(--accent);
}

.template-card {
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  background: var(--bg-card);
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.template-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-hover);
}

.tpl-cover {
  height: 180px;
  position: relative;
  overflow: hidden;
}

.tpl-cover-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.tpl-cover-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 900;
  background: radial-gradient(700px 240px at 20% 0%, rgba(37, 99, 235, 0.45), transparent 55%),
    radial-gradient(680px 260px at 85% 20%, rgba(14, 165, 233, 0.28), transparent 55%),
    rgba(15, 23, 42, 0.65);
}

.template-card:hover .tpl-cover-img {
  transform: scale(1.05);
}

.tpl-cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 100%);
  pointer-events: none;
}

.tpl-card-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  display: flex;
  gap: 7px;
}

.icon-btn {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.84);
  color: rgba(15, 23, 42, 0.7);
  cursor: pointer;
  backdrop-filter: blur(12px);
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.icon-btn:hover {
  background: #fff;
  border-color: rgba(37, 99, 235, 0.20);
  color: var(--primary);
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.10);
}

.favorite-btn.active {
  border-color: rgba(37, 99, 235, 0.22);
  color: var(--primary);
  background: rgba(37, 99, 235, 0.10);
}

.icon-btn.danger {
  color: rgba(220, 38, 38, 0.82);
}

.icon-btn.danger:hover {
  border-color: rgba(220, 38, 38, 0.20);
  background: rgba(254, 242, 242, 0.92);
  color: var(--accent);
  box-shadow: 0 8px 18px rgba(220, 38, 38, 0.08);
}

.tpl-source-pill {
  position: absolute;
  left: 16px;
  top: 16px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.74);
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  backdrop-filter: blur(10px);
}

.prompt-preview {
  background: var(--bg-subtle);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  min-height: 76px;
}

.prompt-preview code {
  display: -webkit-box;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted);
  white-space: pre-wrap;
  word-break: break-word;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.argument-summary {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: 26px;
  padding: 0 9px;
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  color: var(--primary);
  font-size: 12px;
  font-weight: 900;
}

.tpl-body {
  min-height: 300px;
}

.tpl-body .btn {
  margin-top: auto;
}

.tpl-use-btn {
  border-color: rgba(37, 99, 235, 0.18) !important;
  background: rgba(37, 99, 235, 0.06) !important;
  color: var(--primary) !important;
}

.tpl-use-btn:hover:not(:disabled) {
  border-color: rgba(37, 99, 235, 0.30) !important;
  background: rgba(37, 99, 235, 0.10) !important;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.10);
}

.template-form {
  display: grid;
  gap: 16px;
}

.template-form-desc {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.argument-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.argument-field {
  min-width: 0;
}

.resolved-preview {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg-subtle);
}

.resolved-preview-label {
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
}

.resolved-preview code {
  max-height: 190px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text);
  font-family: monospace;
  font-size: 12px;
  line-height: 1.55;
}

.template-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.template-editor {
  display: grid;
  gap: 16px;
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.editor-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.editor-field-wide {
  grid-column: 1 / -1;
}

.editor-prompt {
  min-height: 180px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 13px;
}

.editor-arguments-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 14px;
  padding-top: 2px;
}

.editor-arguments-head p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.editor-argument-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.editor-arguments {
  display: grid;
  gap: 10px;
}

.editor-argument-row {
  display: grid;
  grid-template-columns: minmax(90px, 1fr) minmax(90px, 1fr) minmax(100px, 1fr) minmax(90px, 1fr) 36px;
  gap: 8px;
  align-items: center;
}

.argument-remove {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(220, 38, 38, 0.18);
  border-radius: 10px;
  background: rgba(254, 242, 242, 0.82);
  color: #dc2626;
  cursor: pointer;
}

.editor-empty-arguments {
  display: grid;
  min-height: 58px;
  place-items: center;
  border: 1px dashed var(--line);
  border-radius: var(--radius-sm);
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  background: var(--bg-subtle);
}

@media (max-width: 760px) {
  .models-toolbar {
    grid-template-columns: 1fr;
  }

  .grid-templates {
    grid-template-columns: 1fr;
  }

  .argument-grid {
    grid-template-columns: 1fr;
  }

  .source-switch {
    width: 100%;
  }

  .source-switch-item {
    flex: 1;
  }

  .editor-grid,
  .editor-argument-row {
    grid-template-columns: 1fr;
  }

  .editor-arguments-head {
    align-items: stretch;
    flex-direction: column;
  }

  .editor-argument-actions {
    justify-content: stretch;
  }

  .template-modal-actions {
    flex-direction: column-reverse;
  }
}
</style>
