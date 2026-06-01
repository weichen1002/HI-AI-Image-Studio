import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import { apiFetch } from '../utils/api'

const STORAGE_KEY = 'hi-image-studio:preferences:v1'
const ANONYMOUS_SCOPE = 'anonymous'

export const DEFAULT_CREATE_SETTINGS = {
  aspectRatio: '1:1',
  qualityTier: '1k',
  count: 1,
  outputFormat: 'png',
  outputCompression: 100,
  background: 'auto',
  moderation: 'auto'
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
    moderation: raw.moderation === 'low' ? 'low' : DEFAULT_CREATE_SETTINGS.moderation
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

export const usePreferencesStore = defineStore('preferences', () => {
  const scope = ref(ANONYMOUS_SCOPE)
  const initial = safeRead(scope.value)
  const createSettings = reactive(normalizeCreateSettings(initial.createSettings))
  const favoriteImageIds = ref(normalizeStringList(initial.favoriteImageIds))
  const favoriteTemplateIds = ref(normalizeStringList(initial.favoriteTemplateIds))
  const assetMetaByImageId = ref(normalizeAssetMetaMap(initial.assetMetaByImageId))

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
        assetMetaByImageId: assetMetaByImageId.value
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

  function setFavoriteTemplates(ids = []) {
    favoriteTemplateIds.value = normalizeStringList(ids)
  }

  async function loadServerTemplateFavorites() {
    const data = await apiFetch('/api/templates/favorites', undefined, { toast: false })
    const ids = normalizeStringList(data?.templateIds)
    setFavoriteTemplates(ids)
    return ids
  }

  async function importServerTemplateFavorites(ids = []) {
    const values = normalizeStringList(ids)
    if (!values.length) return favoriteTemplateIds.value
    const data = await apiFetch('/api/templates/favorites/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateIds: values })
    }, { toast: false })
    const nextIds = normalizeStringList(data?.templateIds)
    setFavoriteTemplates(nextIds)
    return nextIds
  }

  async function setServerTemplateFavorite(id, favorite) {
    const value = String(id || '').trim()
    if (!value) return favoriteTemplateIds.value
    const data = await apiFetch('/api/templates/favorites', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: value, favorite: Boolean(favorite) })
    })
    const ids = normalizeStringList(data?.templateIds)
    setFavoriteTemplates(ids)
    return ids
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

  watch(
    [createSettings, favoriteImageIds, favoriteTemplateIds, assetMetaByImageId],
    persist,
    { deep: true },
  )

  return {
    createSettings,
    scope,
    favoriteImageIds,
    favoriteTemplateIds,
    assetMetaByImageId,
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
    setFavoriteTemplates,
    loadServerTemplateFavorites,
    importServerTemplateFavorites,
    setServerTemplateFavorite,
    assetMeta,
    updateAssetMeta,
    removeAssetMeta
  }
})
