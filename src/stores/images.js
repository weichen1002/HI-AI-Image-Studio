import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiFetch } from '../utils/api'
import { toastSuccess } from '../components/common'

export const useImagesStore = defineStore('images', () => {
  const images = ref([])
  const isLoading = ref(false)
  const activeJob = ref(null)
  const isGenerating = computed(() => activeJob.value?.status === 'running')

  function toListImage(image) {
    return {
      ...image,
      imageUrls: (image.imageUrls || [])
        .filter(Boolean)
        .slice(0, 1),
      inputImageUrls: (image.inputImageUrls || [])
        .filter(Boolean)
        .slice(0, 1),
      mode: image.mode || 'text'
    }
  }

  async function fetchImages(limit = 12) {
    isLoading.value = true
    try {
      const data = await apiFetch(`/api/images?limit=${limit}`)
      images.value = (data?.images || []).map(toListImage)
    } catch {
      images.value = images.value || []
    } finally {
      isLoading.value = false
    }
  }

  async function fetchImage(id) {
    const data = await apiFetch(`/api/images/${id}`)
    return data?.image
  }

  async function generate(prompt, aspectRatio) {
    if (isGenerating.value) {
      throw new Error('已有图片正在生成，请等待当前任务完成')
    }

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
        body: JSON.stringify({ prompt, aspectRatio })
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

  async function generateFromImage(file, prompt, aspectRatio) {
    if (isGenerating.value) {
      throw new Error('已有图片正在生成，请等待当前任务完成')
    }

    if (!file) {
      throw new Error('请先上传参考图')
    }

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
      form.append('image', file)
      form.append('prompt', prompt)
      form.append('aspectRatio', aspectRatio)

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

  function clearJob() {
    if (!isGenerating.value) activeJob.value = null
  }

  async function deleteImage(id) {
    await apiFetch(`/api/images/${id}`, { method: 'DELETE' })
    const idx = images.value.findIndex((im) => String(im.id) === String(id))
    if (idx >= 0) images.value.splice(idx, 1)
    toastSuccess('已删除')
  }

  async function clearImages() {
    await apiFetch('/api/images', { method: 'DELETE' })
    images.value = []
    toastSuccess('已清空')
  }

  return { images, isLoading, activeJob, isGenerating, fetchImages, fetchImage, generate, generateFromImage, clearJob, deleteImage, clearImages }
})
