import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'

const STORAGE_KEY = 'hi-image-studio:preferences:v1'
const ANONYMOUS_SCOPE = 'anonymous'

export const DEFAULT_CREATE_SETTINGS = {
  aspectRatio: '1:1',
  qualityTier: '1k',
  count: 1,
  outputFormat: 'png',
  outputCompression: 100,
  background: 'auto',
  moderation: 'auto',
  stylePrompt: ''
}

function storageKeyForScope(scope) {
  const value = String(scope || ANONYMOUS_SCOPE).trim() || ANONYMOUS_SCOPE
  return `${STORAGE_KEY}:${value}`
}

function safeRead(scope = ANONYMOUS_SCOPE) {
  if (typeof window === 'undefined') return {}
  try {
    const scoped = window.localStorage.getItem(storageKeyForScope(scope))
    if (scoped) return JSON.parse(scoped)
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function normalizeCreateSettings(value = {}) {
  const raw = value && typeof value === 'object' ? value : {}
  const outputFormat = ['png', 'jpeg', 'webp'].includes(raw.outputFormat)
    ? raw.outputFormat
    : DEFAULT_CREATE_SETTINGS.outputFormat
  const background =
    raw.background === 'transparent' && outputFormat === 'jpeg'
      ? 'auto'
      : ['auto', 'transparent', 'opaque'].includes(raw.background)
        ? raw.background
        : DEFAULT_CREATE_SETTINGS.background

  return {
    aspectRatio: ['1:1', '16:9', '9:16', '4:3', '3:4'].includes(raw.aspectRatio)
      ? raw.aspectRatio
      : DEFAULT_CREATE_SETTINGS.aspectRatio,
    qualityTier: ['1k', '2k', '4k'].includes(raw.qualityTier)
      ? raw.qualityTier
      : DEFAULT_CREATE_SETTINGS.qualityTier,
    count: [1, 2, 4].includes(Number(raw.count))
      ? Number(raw.count)
      : DEFAULT_CREATE_SETTINGS.count,
    outputFormat,
    outputCompression: Math.max(
      0,
      Math.min(100, Math.floor(Number(raw.outputCompression ?? DEFAULT_CREATE_SETTINGS.outputCompression))),
    ),
    background,
    moderation: raw.moderation === 'low' ? 'low' : DEFAULT_CREATE_SETTINGS.moderation,
    stylePrompt: String(raw.stylePrompt || '').trim().slice(0, 500)
  }
}

function normalizeStringList(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)))
    : []
}

function normalizeAssetMetaMap(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const out = {}
  for (const [id, meta] of Object.entries(source)) {
    const key = String(id || '').trim()
    if (!key || !meta || typeof meta !== 'object') continue
    const folder = String(meta.folder || '').trim()
    const tags = normalizeStringList(meta.tags)
    if (!folder && !tags.length) continue
    out[key] = { folder, tags }
  }
  return out
}

function normalizeProjectBoards(value) {
  return Array.isArray(value)
    ? value
        .map((item) => {
          const id = String(item?.id || '').trim()
          const name = String(item?.name || '').trim().slice(0, 40)
          if (!id || !name) return null
          return {
            id,
            name,
            description: String(item?.description || '').trim().slice(0, 120),
            aspectRatio: ['1:1', '16:9', '9:16', '4:3', '3:4'].includes(item?.aspectRatio)
              ? item.aspectRatio
              : DEFAULT_CREATE_SETTINGS.aspectRatio,
            tags: normalizeStringList(item?.tags).slice(0, 12),
            stylePrompt: String(item?.stylePrompt || '').trim().slice(0, 500)
          }
        })
        .filter(Boolean)
    : []
}

export const usePreferencesStore = defineStore('preferences', () => {
  const scope = ref(ANONYMOUS_SCOPE)
  const initial = safeRead(scope.value)
  const createSettings = reactive(normalizeCreateSettings(initial.createSettings))
  const favoriteImageIds = ref(normalizeStringList(initial.favoriteImageIds))
  const favoriteTemplateIds = ref(normalizeStringList(initial.favoriteTemplateIds))
  const assetMetaByImageId = ref(normalizeAssetMetaMap(initial.assetMetaByImageId))
  const projectBoards = ref(normalizeProjectBoards(initial.projectBoards))

  const favoriteImageSet = computed(() => new Set(favoriteImageIds.value))
  const favoriteTemplateSet = computed(() => new Set(favoriteTemplateIds.value))
  const assetFolders = computed(() => {
    return Array.from(
      new Set(
        Object.values(assetMetaByImageId.value)
          .map((meta) => String(meta?.folder || '').trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  })
  const assetTags = computed(() => {
    return Array.from(
      new Set(
        Object.values(assetMetaByImageId.value)
          .flatMap((meta) => normalizeStringList(meta?.tags)),
      ),
    ).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  })

  function persist() {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      storageKeyForScope(scope.value),
      JSON.stringify({
        createSettings: { ...createSettings },
        favoriteImageIds: favoriteImageIds.value,
        favoriteTemplateIds: favoriteTemplateIds.value,
        assetMetaByImageId: assetMetaByImageId.value,
        projectBoards: projectBoards.value
      }),
    )
  }

  function loadScope(nextScope = ANONYMOUS_SCOPE) {
    const normalizedScope = String(nextScope || ANONYMOUS_SCOPE).trim() || ANONYMOUS_SCOPE
    if (scope.value === normalizedScope) return
    scope.value = normalizedScope
    const next = safeRead(normalizedScope)
    Object.assign(createSettings, normalizeCreateSettings(next.createSettings))
    favoriteImageIds.value = normalizeStringList(next.favoriteImageIds)
    favoriteTemplateIds.value = normalizeStringList(next.favoriteTemplateIds)
    assetMetaByImageId.value = normalizeAssetMetaMap(next.assetMetaByImageId)
    projectBoards.value = normalizeProjectBoards(next.projectBoards)
  }

  function updateCreateSettings(next) {
    Object.assign(createSettings, normalizeCreateSettings(next))
  }

  function resetCreateSettings() {
    Object.assign(createSettings, DEFAULT_CREATE_SETTINGS)
  }

  function isFavoriteImage(id) {
    return favoriteImageSet.value.has(String(id || ''))
  }

  function toggleFavoriteImage(id) {
    const value = String(id || '').trim()
    if (!value) return
    favoriteImageIds.value = isFavoriteImage(value)
      ? favoriteImageIds.value.filter((item) => item !== value)
      : [value, ...favoriteImageIds.value]
  }

  function setFavoriteImages(ids, favorite) {
    const values = normalizeStringList(ids)
    if (!values.length) return
    const current = new Set(favoriteImageIds.value)
    for (const id of values) {
      if (favorite) current.add(id)
      else current.delete(id)
    }
    favoriteImageIds.value = Array.from(current)
  }

  function removeImagePreferences(ids) {
    const values = normalizeStringList(ids)
    if (!values.length) return
    const removeSet = new Set(values)
    favoriteImageIds.value = favoriteImageIds.value.filter((id) => !removeSet.has(id))
    removeAssetMeta(values)
  }

  function isFavoriteTemplate(id) {
    return favoriteTemplateSet.value.has(String(id || ''))
  }

  function toggleFavoriteTemplate(id) {
    const value = String(id || '').trim()
    if (!value) return
    favoriteTemplateIds.value = isFavoriteTemplate(value)
      ? favoriteTemplateIds.value.filter((item) => item !== value)
      : [value, ...favoriteTemplateIds.value]
  }

  function assetMeta(id) {
    const key = String(id || '').trim()
    return assetMetaByImageId.value[key] || { folder: '', tags: [] }
  }

  function updateAssetMeta(ids, next = {}) {
    const values = normalizeStringList(ids)
    if (!values.length) return
    const shouldSetFolder = Object.prototype.hasOwnProperty.call(next, 'folder')
    const shouldSetTags = Object.prototype.hasOwnProperty.call(next, 'tags')
    const nextFolder = shouldSetFolder ? String(next.folder || '').trim() : ''
    const nextTags = shouldSetTags ? normalizeStringList(next.tags) : []
    const current = { ...assetMetaByImageId.value }

    for (const id of values) {
      const existing = current[id] || { folder: '', tags: [] }
      const meta = {
        folder: shouldSetFolder ? nextFolder : String(existing.folder || '').trim(),
        tags: shouldSetTags ? nextTags : normalizeStringList(existing.tags)
      }
      if (meta.folder || meta.tags.length) current[id] = meta
      else delete current[id]
    }

    assetMetaByImageId.value = current
  }

  function removeAssetMeta(ids) {
    const values = normalizeStringList(ids)
    if (!values.length) return
    const current = { ...assetMetaByImageId.value }
    for (const id of values) {
      delete current[id]
    }
    assetMetaByImageId.value = current
  }

  function upsertProjectBoard(board = {}) {
    const normalized = normalizeProjectBoards([
      {
        ...board,
        id: String(board.id || '').trim() || `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      }
    ])[0]
    if (!normalized) return null
    const list = projectBoards.value.slice()
    const idx = list.findIndex((item) => item.id === normalized.id)
    if (idx >= 0) list.splice(idx, 1, normalized)
    else list.unshift(normalized)
    projectBoards.value = list
    return normalized
  }

  function removeProjectBoard(id) {
    const key = String(id || '').trim()
    if (!key) return
    projectBoards.value = projectBoards.value.filter((item) => item.id !== key)
  }

  function projectBoard(id) {
    const key = String(id || '').trim()
    return projectBoards.value.find((item) => item.id === key) || null
  }

  watch(
    [createSettings, favoriteImageIds, favoriteTemplateIds, assetMetaByImageId, projectBoards],
    persist,
    { deep: true },
  )

  return {
    createSettings,
    scope,
    favoriteImageIds,
    favoriteTemplateIds,
    assetMetaByImageId,
    projectBoards,
    assetFolders,
    assetTags,
    loadScope,
    updateCreateSettings,
    resetCreateSettings,
    isFavoriteImage,
    toggleFavoriteImage,
    setFavoriteImages,
    removeImagePreferences,
    isFavoriteTemplate,
    toggleFavoriteTemplate,
    assetMeta,
    updateAssetMeta,
    removeAssetMeta,
    upsertProjectBoard,
    removeProjectBoard,
    projectBoard
  }
})
