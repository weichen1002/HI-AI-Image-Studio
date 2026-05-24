<template>
  <div class="models-view">
    <div class="models-toolbar">
      <Input v-model="searchText" size="sm" placeholder="搜索模板、场景、提示词" />
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
          <button
            type="button"
            class="favorite-btn"
            :class="{ active: isFavoriteTemplate(tpl) }"
            :title="isFavoriteTemplate(tpl) ? '取消收藏' : '收藏模板'"
            @click.stop="toggleFavoriteTemplate(tpl)"
          >
            <StarIcon :size="16" />
          </button>
          <span class="text-eyebrow mt-auto" style="position: relative; z-index: 1; background: rgba(255,255,255,0.9); padding: 4px 8px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); align-self: flex-start;">
            {{ tpl.category }}
          </span>
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
            class="w-full"
            style="border-color: rgba(99, 102, 241, 0.2); color: var(--primary);"
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { StarIcon } from 'lucide-vue-next'
import { Button, Input, Modal } from '../../components/common'
import { usePreferencesStore } from '../../stores/preferences'

const router = useRouter()
const preferencesStore = usePreferencesStore()

const activeCategory = ref("全部")
const searchText = ref("")
const favoritesOnly = ref(false)
const loading = ref(true)
const loadError = ref("")
const templates = ref([])
const templateModalOpen = ref(false)
const selectedTemplate = ref(null)
const templateArgumentValues = ref({})

const ARGUMENT_PATTERN = /\{argument\s+name=(["'])(.*?)\1\s+default=(["'])(.*?)\3\s*\}/g

onMounted(loadTemplates)

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

const categories = computed(() => {
  const set = new Set()
  for (const item of templates.value) {
    if (item?.category) set.add(String(item.category))
  }
  return ["全部", ...Array.from(set)]
})

const normalizedTemplates = computed(() => {
  return templates.value.map((tpl) => ({
    ...tpl,
    templateKey: templateId(tpl),
    arguments: templateArguments(tpl),
    searchText: [tpl.title, tpl.desc, tpl.prompt, tpl.category].join(' ').toLowerCase()
  }))
})

const filteredTemplates = computed(() => {
  const keyword = String(searchText.value || '').trim().toLowerCase()
  return normalizedTemplates.value.filter((tpl) => {
    const matchesCategory = activeCategory.value === "全部" || tpl.category === activeCategory.value
    const matchesKeyword = !keyword || tpl.searchText.includes(keyword)
    const matchesFavorite = !favoritesOnly.value || isFavoriteTemplate(tpl)
    return matchesCategory && matchesKeyword && matchesFavorite
  })
})

function templateId(tpl) {
  return String(tpl?.id || tpl?.title || tpl?.prompt || '')
}

function isFavoriteTemplate(tpl) {
  return preferencesStore.isFavoriteTemplate(tpl.templateKey || templateId(tpl))
}

function toggleFavoriteTemplate(tpl) {
  preferencesStore.toggleFavoriteTemplate(tpl.templateKey || templateId(tpl))
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

const selectedTemplateArgs = computed(() => templateArguments(selectedTemplate.value))
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
</script>

<style scoped>
.models-view {
  min-width: 0;
}

.models-toolbar {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto;
  gap: 10px;
  align-items: center;
  margin-bottom: 18px;
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
  background: radial-gradient(700px 240px at 20% 0%, rgba(99, 102, 241, 0.45), transparent 55%),
    radial-gradient(680px 260px at 85% 20%, rgba(236, 72, 153, 0.35), transparent 55%),
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

.favorite-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
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
}

.favorite-btn.active {
  color: #f59e0b;
  background: #fff7ed;
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
  border: 1px solid rgba(99, 102, 241, 0.16);
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.08);
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

  .template-modal-actions {
    flex-direction: column-reverse;
  }
}
</style>
