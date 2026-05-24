import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiFetch } from '../utils/api'
import { toastSuccess } from '../components/common'
import { useAuthStore } from './auth'
import { compressImage } from '../utils/imageCompressor'

export const useImagesStore = defineStore('images', () => {
  const images = ref([])
  const total = ref(0)
  const lastQuery = ref({ limit: 12, offset: 0, mode: 'all', q: '' })
  const isLoading = ref(false)
  const activeJob = ref(null)
  const isGenerating = computed(() => activeJob.value?.status === 'running')

  function normalizeSourceImageUrl(sourceImageUrl, sourceImageId) {
    const normalizedUrl = String(sourceImageUrl || '').trim()
    if (!normalizedUrl || sourceImageId) return ''

    // `data:` / `blob:` URL 往往非常长，而且后端无法长期复用，直接回退到上传后的文件地址更稳妥。
    if (normalizedUrl.startsWith('data:') || normalizedUrl.startsWith('blob:')) {
      return ''
    }

    try {
      const parsed = new URL(normalizedUrl, window.location.origin)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return ''
      }
      return parsed.toString()
    } catch {
      return ''
    }
  }

  function costFor(plan, action) {
    const normalizedPlan = plan === 'pro' ? 'pro' : 'free'
    const table = {
      free: { text_to_image: 2, image_to_image: 3 },
      pro: { text_to_image: 1, image_to_image: 2 }
    }
    return table[normalizedPlan]?.[action] ?? 0
  }

  async function ensureEnoughCredits(action) {
    const authStore = useAuthStore()
    const user = authStore.user
    if (!user) return

    const cost = costFor(user.plan, action)
    const balance = Number(user.creditBalance ?? 0)
    if (balance >= cost) return

    await authStore.refreshUser()
    const refreshed = authStore.user
    const refreshedBalance = Number(refreshed?.creditBalance ?? 0)
    const refreshedCost = costFor(refreshed?.plan, action)
    if (refreshedBalance >= refreshedCost) return

    throw new Error('余额不足')
  }

  function toListImage(image) {
    return {
      ...image,
      imageUrls: (image.imageUrls || [])
        .filter(Boolean),
      inputImageUrls: (image.inputImageUrls || [])
        .filter(Boolean),
      mode: image.mode || 'text',
      operationType: image.operationType || (image.mode === 'image' ? 'image_to_image' : 'generate'),
      generationParams: image.generationParams && typeof image.generationParams === 'object'
        ? image.generationParams
        : {},
      sourceImageId: image.sourceImageId || '',
      continuationChainId: image.continuationChainId || '',
      folder: String(image.folder || ''),
      tags: Array.isArray(image.tags)
        ? Array.from(new Set(image.tags.map((item) => String(item || '').trim()).filter(Boolean)))
        : []
    }
  }

  async function fetchImages(options = 12) {
    const params = typeof options === 'number'
      ? { limit: options }
      : { ...(options || {}) }
    const limit = Number(params.limit || 12)
    const offset = Number(params.offset || 0)
    const mode = params.mode || 'all'
    const q = String(params.q || '').trim()

    isLoading.value = true
    try {
      const search = new URLSearchParams()
      search.set('limit', String(limit))
      search.set('offset', String(offset))
      if (mode && mode !== 'all') search.set('mode', mode)
      if (q) search.set('q', q)
      const data = await apiFetch(`/api/images?${search.toString()}`)
      images.value = (data?.images || []).map(toListImage)
      total.value = Number(data?.total ?? images.value.length)
      lastQuery.value = { limit, offset, mode, q }
      return {
        images: images.value,
        total: total.value,
        limit: Number(data?.limit ?? limit),
        offset: Number(data?.offset ?? offset)
      }
    } catch {
      images.value = images.value || []
      return {
        images: images.value,
        total: total.value,
        limit,
        offset
      }
    } finally {
      isLoading.value = false
    }
  }

  async function fetchImage(id) {
    const data = await apiFetch(`/api/images/${id}`)
    return {
      image: data?.image ? toListImage(data.image) : null,
      dialogueMessages: Array.isArray(data?.dialogueMessages) ? data.dialogueMessages : []
    }
  }

  async function fetchDialogueHistory({ chainId = '', imageId = '', limit = 5 } = {}) {
    const search = new URLSearchParams()
    if (chainId) search.set('chainId', chainId)
    if (imageId) search.set('imageId', imageId)
    search.set('limit', String(limit))
    const data = await apiFetch(`/api/images/dialogue/history?${search.toString()}`)
    return {
      chainId: data?.chainId || '',
      messages: Array.isArray(data?.messages) ? data.messages : []
    }
  }

  async function fetchDialogueChain({ chainId = '', imageId = '' } = {}) {
    const search = new URLSearchParams()
    if (chainId) search.set('chainId', chainId)
    if (imageId) search.set('imageId', imageId)
    const data = await apiFetch(`/api/images/dialogue/chain?${search.toString()}`)
    return {
      chainId: data?.chainId || '',
      images: Array.isArray(data?.images) ? data.images.map(toListImage) : [],
      messages: Array.isArray(data?.messages) ? data.messages : []
    }
  }

  async function generate(prompt, aspectRatio, options = {}) {
    if (isGenerating.value) {
      throw new Error('已有图片正在生成，请等待当前任务完成')
    }

    await ensureEnoughCredits('text_to_image')

    activeJob.value = {
      id: Date.now(),
      mode: 'text',
      status: 'running',
      prompt,
      aspectRatio,
      image: null,
      error: '',
      startedAt: new Date().toISOString()
    }

    try {
      const data = await apiFetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          aspectRatio,
          mode: options.mode || 'text',
          qualityTier: options.qualityTier || '1k',
          count: options.count || 1,
          outputFormat: options.outputFormat || 'png',
          outputCompression: options.outputCompression ?? 100,
          background: options.background || 'auto',
          moderation: options.moderation || 'auto'
        })
      })

      images.value.unshift(toListImage(data.image))
      activeJob.value = {
        ...activeJob.value,
        status: 'success',
        image: data.image,
        completedAt: new Date().toISOString()
      }
      return data.image
    } catch (error) {
      activeJob.value = {
        ...activeJob.value,
        status: 'error',
        error: error.message || '生成失败',
        completedAt: new Date().toISOString()
      }
      throw error
    }
  }

  async function generateFromImages(files, prompt, aspectRatio, options = {}) {
    if (isGenerating.value) {
      throw new Error('已有图片正在生成，请等待当前任务完成')
    }

    const validFiles = Array.isArray(files)
      ? files.filter((file) => file instanceof File)
      : []
    if (!validFiles.length) {
      throw new Error('请先上传参考图')
    }

    await ensureEnoughCredits('image_to_image')

    activeJob.value = {
      id: Date.now(),
      mode: 'image',
      status: 'running',
      prompt,
      aspectRatio,
      image: null,
      error: '',
      startedAt: new Date().toISOString()
    }

    try {
      const form = new FormData()
      validFiles.forEach((file) => {
        form.append('images', file)
      })
      form.append('prompt', prompt)
      form.append('aspectRatio', aspectRatio)
      form.append('mode', options.mode || 'image')
      form.append('qualityTier', options.qualityTier || '1k')
      form.append('count', String(options.count || 1))
      form.append('outputFormat', options.outputFormat || 'png')
      form.append('outputCompression', String(options.outputCompression ?? 100))
      form.append('background', options.background || 'auto')
      form.append('moderation', options.moderation || 'auto')

      const data = await apiFetch('/api/images/from-image', {
        method: 'POST',
        body: form
      })

      images.value.unshift(toListImage(data.image))
      activeJob.value = {
        ...activeJob.value,
        status: 'success',
        image: data.image,
        completedAt: new Date().toISOString()
      }
      return data.image
    } catch (error) {
      activeJob.value = {
        ...activeJob.value,
        status: 'error',
        error: error.message || '生成失败',
        completedAt: new Date().toISOString()
      }
      throw error
    }
  }

  async function continueDialogue({
    prompt,
    aspectRatio,
    chainId = '',
    sourceImageId = '',
    imageFile = null,
    qualityTier = '1k',
    count = 1,
    outputFormat = 'png',
    outputCompression = 100,
    background = 'auto',
    moderation = 'auto'
  } = {}) {
    if (isGenerating.value) {
      throw new Error('已有图片正在生成，请等待当前任务完成')
    }

    if (!String(prompt || '').trim()) {
      throw new Error('请输入这轮对话要求')
    }

    const usesImageContext = Boolean(chainId || sourceImageId || imageFile instanceof File)
    await ensureEnoughCredits(usesImageContext ? 'image_to_image' : 'text_to_image')

    activeJob.value = {
      id: Date.now(),
      mode: 'dialogue',
      status: 'running',
      prompt,
      aspectRatio,
      image: null,
      error: '',
      startedAt: new Date().toISOString()
    }

    try {
      const form = new FormData()
      form.append('prompt', String(prompt).trim())
      form.append('aspectRatio', aspectRatio)
      form.append('qualityTier', qualityTier)
      form.append('count', String(count || 1))
      form.append('outputFormat', outputFormat)
      form.append('outputCompression', String(outputCompression ?? 100))
      form.append('background', background)
      form.append('moderation', moderation)
      if (chainId) form.append('chainId', chainId)
      if (sourceImageId) form.append('sourceImageId', sourceImageId)
      if (imageFile instanceof File) form.append('image', imageFile)

      const data = await apiFetch('/api/images/dialogue', {
        method: 'POST',
        body: form
      })

      const image = toListImage(data.image)
      images.value.unshift(image)
      activeJob.value = {
        ...activeJob.value,
        status: 'success',
        image,
        completedAt: new Date().toISOString()
      }
      return {
        image,
        chainId: data?.chainId || image.continuationChainId || '',
        messages: Array.isArray(data?.messages) ? data.messages : []
      }
    } catch (error) {
      activeJob.value = {
        ...activeJob.value,
        status: 'error',
        error: error.message || '对话创作失败',
        completedAt: new Date().toISOString()
      }
      throw error
    }
  }

  async function editImage({ imageFile, maskFile, prompt, aspectRatio, operationType, sourceImageId, sourceImageUrl }) {
    if (isGenerating.value) {
      throw new Error('已有图片正在生成，请等待当前任务完成')
    }

    if (!imageFile) {
      throw new Error('缺少待编辑图片')
    }

    await ensureEnoughCredits('image_to_image')

    activeJob.value = {
      id: Date.now(),
      mode: operationType === 'cutout' ? 'tools' : 'image',
      operationType,
      status: 'running',
      prompt,
      aspectRatio,
      image: null,
      error: '',
      startedAt: new Date().toISOString()
    }

    try {
      const compressedImageFile = await compressImage(imageFile, 1);
      const compressedMaskFile = maskFile ? await compressImage(maskFile, 1) : null;
      const normalizedSourceImageUrl = normalizeSourceImageUrl(sourceImageUrl, sourceImageId)
      
      const form = new FormData()
      form.append('image', compressedImageFile)
      if (compressedMaskFile) form.append('mask', compressedMaskFile)
      form.append('prompt', prompt)
      form.append('aspectRatio', aspectRatio)
      form.append('operationType', operationType)
      if (sourceImageId) form.append('sourceImageId', sourceImageId)
      if (normalizedSourceImageUrl) form.append('sourceImageUrl', normalizedSourceImageUrl)

      const data = await apiFetch('/api/images/edit', {
        method: 'POST',
        body: form
      })

      images.value.unshift(toListImage(data.image))
      activeJob.value = {
        ...activeJob.value,
        status: 'success',
        image: data.image,
        completedAt: new Date().toISOString()
      }
      return data.image
    } catch (error) {
      activeJob.value = {
        ...activeJob.value,
        status: 'error',
        error: error.message || '编辑失败',
        completedAt: new Date().toISOString()
      }
      throw error
    }
  }

  function clearJob() {
    if (!isGenerating.value) activeJob.value = null
  }

  async function deleteImage(id) {
    await apiFetch(`/api/images/${id}`, { method: 'DELETE' })
    const idx = images.value.findIndex((im) => String(im.id) === String(id))
    if (idx >= 0) images.value.splice(idx, 1)
    total.value = Math.max(0, total.value - 1)
    toastSuccess('已删除')
  }

  async function updateImageMeta(id, meta = {}) {
    const data = await apiFetch(`/api/images/${encodeURIComponent(id)}/meta`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta)
    })
    const nextImage = data?.image ? toListImage(data.image) : null
    if (nextImage) {
      const idx = images.value.findIndex((im) => String(im.id) === String(id))
      if (idx >= 0) images.value.splice(idx, 1, nextImage)
    }
    return nextImage
  }

  async function deleteDialogueChain(chainId) {
    await apiFetch(`/api/images/dialogue/chain/${encodeURIComponent(chainId)}`, { method: 'DELETE' })
    const removedCount = images.value.filter((im) => String(im.continuationChainId || '') === String(chainId || '')).length
    images.value = images.value.filter((im) => String(im.continuationChainId || '') !== String(chainId || ''))
    total.value = Math.max(0, total.value - removedCount)
    toastSuccess('已删除对话')
  }

  async function clearImages() {
    await apiFetch('/api/images', { method: 'DELETE' })
    images.value = []
    total.value = 0
    toastSuccess('已清空')
  }

  return { images, total, lastQuery, isLoading, activeJob, isGenerating, fetchImages, fetchImage, fetchDialogueHistory, fetchDialogueChain, generate, generateFromImages, continueDialogue, editImage, clearJob, updateImageMeta, deleteImage, deleteDialogueChain, clearImages }
})
