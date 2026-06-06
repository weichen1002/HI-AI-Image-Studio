import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiFetch } from '../utils/api'
import { toastSuccess } from '../components/common'
import { useAuthStore } from './auth'
import { compressImage } from '../utils/imageCompressor'

export const useImagesStore = defineStore('images', () => {
  const images = ref([])
  const dialogueChains = ref([])
  const total = ref(0)
  const lastQuery = ref({ limit: 12, offset: 0, mode: 'all', q: '', folder: 'all', tag: 'all' })
  const isLoading = ref(false)
  const activeJob = ref(null)
  const jobs = ref([])
  const jobsTotal = ref(0)
  const jobsLastQuery = ref({ status: '', limit: 20, offset: 0 })
  const jobStats = ref({ queued: 0, running: 0, succeeded: 0, failed: 0, cancelled: 0, total: 0, failureRate: 0 })
  const jobQueueStats = ref({ queued: 0, running: 0, concurrency: 1 })
  const isLoadingJobs = ref(false)
  let jobPollTimer = null
  const isGenerating = computed(() => ['queued', 'running'].includes(activeJob.value?.status))

  function normalizeJobStatus(status) {
    const value = String(status || '').trim()
    if (value === 'succeeded') return 'success'
    if (value === 'failed') return 'error'
    if (value === 'queued' || value === 'running') return value
    if (value === 'success' || value === 'error') return value
    if (value === 'cancelled') return 'cancelled'
    return 'running'
  }

  function toActiveJob(payload = {}) {
    const job = payload?.job || payload
    const image = payload?.image || null
    const id = String(job?.id || '')
    return {
      id,
      mode: job?.mode || 'text',
      operationType: job?.operationType || job?.operation_type || '',
      status: normalizeJobStatus(job?.status),
      prompt: String(job?.prompt || ''),
      image: image ? toListImage(image) : null,
      chainId: String(payload?.chainId || image?.continuationChainId || ''),
      dialogueMessages: Array.isArray(payload?.dialogueMessages) ? payload.dialogueMessages : [],
      retryable: job?.payload?.retryable === true,
      attempts: Math.max(0, Math.floor(Number(job?.attempts || 0))),
      error: String(job?.errorMessage || job?.error || ''),
      startedAt: job?.createdAt || new Date().toISOString(),
      updatedAt: job?.updatedAt || '',
      completedAt: ['succeeded', 'failed', 'success', 'error'].includes(String(job?.status || ''))
        ? (job?.updatedAt || new Date().toISOString())
        : ''
    }
  }

  function toJobStatusParam(status) {
    const value = String(status || '').trim()
    if (!value || value === 'all') return ''
    if (value === 'success') return 'succeeded'
    if (value === 'error') return 'failed'
    if (value === 'active') return 'queued,running'
    if (value === 'completed') return 'succeeded,failed,cancelled'
    return value
  }

  function upsertJob(job) {
    const nextJob = toActiveJob(job?.job ? job : { job })
    if (!nextJob.id) return null
    const idx = jobs.value.findIndex((item) => String(item.id) === String(nextJob.id))
    if (idx >= 0) {
      jobs.value.splice(idx, 1, {
        ...jobs.value[idx],
        ...nextJob
      })
    } else {
      jobs.value.unshift(nextJob)
      jobsTotal.value += 1
    }
    return nextJob
  }

  function stopJobPolling() {
    if (jobPollTimer) window.clearTimeout(jobPollTimer)
    jobPollTimer = null
  }

  function upsertImage(image) {
    const nextImage = image ? toListImage(image) : null
    if (!nextImage?.id) return null
    const idx = images.value.findIndex((item) => String(item.id) === String(nextImage.id))
    if (idx >= 0) {
      images.value.splice(idx, 1, nextImage)
    } else {
      images.value.unshift(nextImage)
      total.value += 1
    }
    return nextImage
  }

  async function refreshAfterJobSuccess(image) {
    if (image) upsertImage(image)
    const authStore = useAuthStore()
    await authStore.refreshUser()
    if (image?.continuationChainId) {
      await fetchDialogueChains({ limit: 100 })
    }
  }

  async function pollJob(jobId, { immediate = false } = {}) {
    const id = String(jobId || '').trim()
    if (!id) return null
    stopJobPolling()

    const tick = async () => {
      try {
        const data = await apiFetch(`/api/images/jobs/${encodeURIComponent(id)}`, undefined, { toast: false })
        const nextJob = toActiveJob(data)
        upsertJob(data)
        activeJob.value = {
          ...(activeJob.value || {}),
          ...nextJob
        }

        if (nextJob.status === 'success') {
          await refreshAfterJobSuccess(nextJob.image)
          activeJob.value = {
            ...(activeJob.value || {}),
            status: 'success',
            image: nextJob.image,
            completedAt: nextJob.completedAt || new Date().toISOString()
          }
          stopJobPolling()
          return activeJob.value
        }

        if (nextJob.status === 'error') {
          activeJob.value = {
            ...(activeJob.value || {}),
            status: 'error',
            error: nextJob.error || '生成失败',
            completedAt: nextJob.completedAt || new Date().toISOString()
          }
          await useAuthStore().refreshUser()
          stopJobPolling()
          return activeJob.value
        }

        jobPollTimer = window.setTimeout(tick, 1600)
        return activeJob.value
      } catch (error) {
        activeJob.value = {
          ...(activeJob.value || { id }),
          status: 'error',
          error: error.message || '任务状态获取失败',
          completedAt: new Date().toISOString()
        }
        stopJobPolling()
        throw error
      }
    }

    if (immediate) return tick()
    jobPollTimer = window.setTimeout(tick, 1000)
    return activeJob.value
  }

  async function restoreActiveJob() {
    if (isGenerating.value) return activeJob.value
    try {
      const data = await apiFetch('/api/images/jobs?status=queued,running&limit=1&offset=0', undefined, {
        toast: false,
        redirectOn401: false
      })
      const job = Array.isArray(data?.jobs) ? data.jobs[0] : null
      if (!job?.id && !job?.job?.id) return null
      activeJob.value = toActiveJob(job)
      await pollJob(activeJob.value.id, { immediate: true })
      return activeJob.value
    } catch {
      return null
    }
  }

  async function ensureNoActiveGeneration() {
    if (isGenerating.value) {
      throw new Error('已有图片正在生成，请等待当前任务完成')
    }
    const data = await apiFetch('/api/images/jobs?status=queued,running&limit=1&offset=0', undefined, {
      toast: false
    })
    const job = Array.isArray(data?.jobs) ? data.jobs[0] : null
    if (!job?.id && !job?.job?.id) return
    activeJob.value = toActiveJob(job)
    upsertJob(job)
    void pollJob(activeJob.value.id, { immediate: true })
    throw new Error('已有图片正在生成，请等待当前任务完成')
  }

  async function fetchJobs({ status = '', limit = 20, offset = 0 } = {}) {
    const normalizedLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 20)))
    const normalizedOffset = Math.max(0, Math.floor(Number(offset) || 0))
    const statusParam = toJobStatusParam(status)
    isLoadingJobs.value = true
    try {
      const search = new URLSearchParams()
      search.set('limit', String(normalizedLimit))
      search.set('offset', String(normalizedOffset))
      if (statusParam) search.set('status', statusParam)
      const data = await apiFetch(`/api/images/jobs?${search.toString()}`, undefined, { toast: false })
      jobs.value = Array.isArray(data?.jobs)
        ? data.jobs.map((job) => toActiveJob(job))
        : []
      jobsTotal.value = Number(data?.total ?? jobs.value.length)
      if (data?.stats) jobStats.value = normalizeJobStats(data.stats)
      if (data?.queue) jobQueueStats.value = normalizeQueueStats(data.queue)
      jobsLastQuery.value = { status, limit: normalizedLimit, offset: normalizedOffset }
      return {
        jobs: jobs.value,
        total: jobsTotal.value,
        limit: normalizedLimit,
        offset: normalizedOffset
      }
    } finally {
      isLoadingJobs.value = false
    }
  }

  function normalizeJobStats(stats = {}) {
    return {
      queued: Number(stats.queued || 0),
      running: Number(stats.running || 0),
      succeeded: Number(stats.succeeded || 0),
      failed: Number(stats.failed || 0),
      cancelled: Number(stats.cancelled || 0),
      total: Number(stats.total || 0),
      failureRate: Number(stats.failureRate || 0)
    }
  }

  function normalizeQueueStats(stats = {}) {
    return {
      queued: Number(stats.queued || 0),
      running: Number(stats.running || 0),
      concurrency: Math.max(1, Number(stats.concurrency || 1))
    }
  }

  async function fetchJobStats() {
    const data = await apiFetch('/api/images/jobs/stats', undefined, { toast: false })
    jobStats.value = normalizeJobStats(data?.stats)
    jobQueueStats.value = normalizeQueueStats(data?.queue)
    return { stats: jobStats.value, queue: jobQueueStats.value }
  }

  async function cancelJob(id) {
    const data = await apiFetch(`/api/images/jobs/${encodeURIComponent(id)}/cancel`, {
      method: 'POST'
    })
    const job = upsertJob(data)
    if (activeJob.value?.id === job?.id) activeJob.value = job
    return job
  }

  async function retryJob(id) {
    const data = await apiFetch(`/api/images/jobs/${encodeURIComponent(id)}/retry`, {
      method: 'POST'
    })
    const job = upsertJob(data)
    if (job) {
      activeJob.value = job
      void pollJob(job.id)
    }
    return job
  }

  async function clearCompletedJobs() {
    const data = await apiFetch('/api/images/jobs/completed', { method: 'DELETE' })
    const deleted = Number(data?.deleted || 0)
    if (deleted > 0) {
      jobs.value = jobs.value.filter((job) => !['success', 'error', 'cancelled'].includes(job.status))
      jobsTotal.value = Math.max(0, jobsTotal.value - deleted)
    }
    return deleted
  }

  function setQueuedJob(data, fallback = {}) {
    const nextJob = toActiveJob(data)
    activeJob.value = {
      ...fallback,
      ...nextJob,
      status: nextJob.status === 'queued' ? 'queued' : 'running',
      image: null,
      error: '',
      startedAt: nextJob.startedAt || new Date().toISOString()
    }
    upsertJob({ job: activeJob.value })
    void pollJob(nextJob.id)
    return activeJob.value
  }

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

  function isTransientGeneratedUrl(url) {
    const value = String(url || '').trim()
    if (!value) return false
    try {
      const parsed = new URL(value, window.location.origin)
      return parsed.hostname === 'chatgpt.com' && parsed.pathname.startsWith('/backend-api/estuary/content')
    } catch {
      return value.includes('chatgpt.com/backend-api/estuary/content')
    }
  }

  function normalizeDisplayImageUrls(urls) {
    return (Array.isArray(urls) ? urls : [])
      .map((item) => String(item || '').trim())
      .filter((item) => item && !isTransientGeneratedUrl(item))
  }

  function toListImage(image) {
    return {
      ...image,
      imageUrls: normalizeDisplayImageUrls(image.imageUrls),
      inputImageUrls: (image.inputImageUrls || [])
        .filter(Boolean),
      previewImageUrls: (image.previewImageUrls || [])
        .filter(Boolean),
      mode: image.mode || 'text',
      operationType: image.operationType || (image.mode === 'image' ? 'image_to_image' : 'generate'),
      generationParams: image.generationParams && typeof image.generationParams === 'object'
        ? image.generationParams
        : {},
      sourceImageId: image.sourceImageId || '',
      continuationChainId: image.continuationChainId || '',
      chainRoundCount: Math.max(0, Math.floor(Number(image.chainRoundCount || 0))),
      folder: String(image.folder || ''),
      tags: Array.isArray(image.tags)
        ? Array.from(new Set(image.tags.map((item) => String(item || '').trim()).filter(Boolean)))
        : [],
      favoriteAt: String(image.favoriteAt || ''),
      isFavorite: Boolean(image.isFavorite || image.favoriteAt),
      feedback: image.feedback && typeof image.feedback === 'object'
        ? {
            imageId: String(image.feedback.imageId || image.id || ''),
            userId: String(image.feedback.userId || ''),
            rating: ['like', 'dislike'].includes(String(image.feedback.rating || ''))
              ? String(image.feedback.rating)
              : 'none',
            issueType: String(image.feedback.issueType || ''),
            note: String(image.feedback.note || ''),
            createdAt: String(image.feedback.createdAt || ''),
            updatedAt: String(image.feedback.updatedAt || '')
          }
        : null
    }
  }

  function toDialogueChain(chain) {
    return {
      chainId: String(chain?.chainId || ''),
      title: String(chain?.title || '对话创作'),
      firstImage: chain?.firstImage ? toListImage(chain.firstImage) : null,
      lastImage: chain?.lastImage ? toListImage(chain.lastImage) : null,
      roundCount: Math.max(1, Math.floor(Number(chain?.roundCount || 1))),
      updatedAt: String(chain?.updatedAt || chain?.lastImage?.createdAt || ''),
      coverUrl: String(
        chain?.coverUrl ||
        chain?.lastImage?.imageUrls?.[0] ||
        chain?.lastImage?.previewImageUrls?.[0] ||
        chain?.firstImage?.imageUrls?.[0] ||
        chain?.firstImage?.previewImageUrls?.[0] ||
        ''
      )
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
    const folder = String(params.folder || 'all').trim()
    const tag = String(params.tag || 'all').trim()
    const favorite = Boolean(params.favorite)
    const ratio = String(params.ratio || 'all').trim()
    const quality = String(params.quality || 'all').trim()
    const hasReference = Boolean(params.hasReference)
    const inStyleBoard = Boolean(params.inStyleBoard)
    const dateFrom = String(params.dateFrom || '').trim()
    const dateTo = String(params.dateTo || '').trim()

    isLoading.value = true
    try {
      const search = new URLSearchParams()
      search.set('limit', String(limit))
      search.set('offset', String(offset))
      if (mode && mode !== 'all') search.set('mode', mode)
      if (q) search.set('q', q)
      if (folder && folder !== 'all') search.set('folder', folder)
      if (tag && tag !== 'all') search.set('tag', tag)
      if (favorite) search.set('favorite', '1')
      if (ratio && ratio !== 'all') search.set('ratio', ratio)
      if (quality && quality !== 'all') search.set('quality', quality)
      if (hasReference) search.set('hasReference', '1')
      if (inStyleBoard) search.set('inStyleBoard', '1')
      if (dateFrom) search.set('dateFrom', dateFrom)
      if (dateTo) search.set('dateTo', dateTo)
      const data = await apiFetch(`/api/images?${search.toString()}`)
      images.value = (data?.images || []).map(toListImage)
      total.value = Number(data?.total ?? images.value.length)
      lastQuery.value = { limit, offset, mode, q, folder, tag, favorite, ratio, quality, hasReference, inStyleBoard, dateFrom, dateTo }
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
      sourceImage: data?.sourceImage ? toListImage(data.sourceImage) : null,
      variants: Array.isArray(data?.variants) ? data.variants.map(toListImage) : [],
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

  async function fetchDialogueChains({ limit = 100 } = {}) {
    const search = new URLSearchParams()
    search.set('limit', String(limit))
    const data = await apiFetch(`/api/images/dialogue/chains?${search.toString()}`)
    dialogueChains.value = Array.isArray(data?.chains)
      ? data.chains.map(toDialogueChain).filter((chain) => chain.chainId)
      : []
    return dialogueChains.value
  }

  async function generate(prompt, aspectRatio, options = {}) {
    await ensureNoActiveGeneration()

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

      return setQueuedJob(data, {
        mode: 'text',
        prompt,
        aspectRatio
      })
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
    await ensureNoActiveGeneration()

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

      return setQueuedJob(data, {
        mode: 'image',
        prompt,
        aspectRatio
      })
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
    await ensureNoActiveGeneration()

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

      return setQueuedJob(data, {
        mode: 'dialogue',
        prompt,
        aspectRatio
      })
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
    await ensureNoActiveGeneration()

    if (!imageFile) {
      throw new Error('缺少待编辑图片')
    }

    await ensureEnoughCredits('image_to_image')

    activeJob.value = {
      id: Date.now(),
      mode: operationType === 'cutout' || operationType === 'upscale' ? 'tools' : 'image',
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

      return setQueuedJob(data, {
        mode: operationType === 'cutout' || operationType === 'upscale' ? 'tools' : 'image',
        operationType,
        prompt,
        aspectRatio
      })
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

  function patchFavoriteState(ids, favorite, favoriteAt = '') {
    const idSet = new Set((Array.isArray(ids) ? ids : [ids]).map((id) => String(id || '')).filter(Boolean))
    if (!idSet.size) return
    images.value = images.value.map((image) => {
      if (!idSet.has(String(image.id || ''))) return image
      return {
        ...image,
        isFavorite: favorite,
        favoriteAt: favorite ? (favoriteAt || image.favoriteAt || new Date().toISOString()) : ''
      }
    })
  }

  async function updateImageFavorite(id, favorite) {
    const data = await apiFetch(`/api/images/${encodeURIComponent(id)}/favorite`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite: Boolean(favorite) })
    })
    const nextImage = data?.image ? toListImage(data.image) : null
    if (nextImage) {
      const idx = images.value.findIndex((im) => String(im.id) === String(id))
      if (idx >= 0) images.value.splice(idx, 1, nextImage)
    } else {
      patchFavoriteState([id], Boolean(favorite))
    }
    return nextImage
  }

  async function updateImageFeedback(id, feedback = {}) {
    const data = await apiFetch(`/api/images/${encodeURIComponent(id)}/feedback`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedback)
    })
    const nextFeedback = data?.feedback || null
    const idx = images.value.findIndex((im) => String(im.id) === String(id))
    if (idx >= 0) {
      images.value.splice(idx, 1, {
        ...images.value[idx],
        feedback: nextFeedback
      })
    }
    return nextFeedback
  }

  async function importFavoriteImages(ids = []) {
    const values = Array.isArray(ids)
      ? Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)))
      : []
    if (!values.length) return { imported: 0 }
    const data = await apiFetch('/api/images/favorites/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageIds: values })
    }, { toast: false })
    patchFavoriteState(values, true)
    return data
  }

  async function deleteDialogueChain(chainId) {
    await apiFetch(`/api/images/dialogue/chain/${encodeURIComponent(chainId)}`, { method: 'DELETE' })
    const removedCount = images.value.filter((im) => String(im.continuationChainId || '') === String(chainId || '')).length
    images.value = images.value.filter((im) => String(im.continuationChainId || '') !== String(chainId || ''))
    dialogueChains.value = dialogueChains.value.filter((chain) => String(chain.chainId || '') !== String(chainId || ''))
    total.value = Math.max(0, total.value - removedCount)
    toastSuccess('已删除对话')
  }

  async function clearImages() {
    await apiFetch('/api/images', { method: 'DELETE' })
    images.value = []
    dialogueChains.value = []
    total.value = 0
    toastSuccess('已清空')
  }

  return { images, dialogueChains, total, lastQuery, isLoading, activeJob, jobs, jobsTotal, jobsLastQuery, jobStats, jobQueueStats, isLoadingJobs, isGenerating, fetchImages, fetchImage, fetchDialogueHistory, fetchDialogueChain, fetchDialogueChains, restoreActiveJob, pollJob, fetchJobs, fetchJobStats, cancelJob, retryJob, clearCompletedJobs, generate, generateFromImages, continueDialogue, editImage, clearJob, updateImageMeta, updateImageFavorite, updateImageFeedback, importFavoriteImages, deleteImage, deleteDialogueChain, clearImages }
})
