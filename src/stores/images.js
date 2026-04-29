import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

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
      const response = await fetch(`/api/images?limit=${limit}`)
      if (response.ok) {
        const data = await response.json()
        images.value = (data.images || []).map(toListImage)
      }
    } finally {
      isLoading.value = false
    }
  }

  async function fetchImage(id) {
    const response = await fetch(`/api/images/${id}`)
    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text }
    }
    if (!response.ok) {
      throw new Error(data.message || data.error || '加载失败')
    }
    return data.image
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
      const response = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspectRatio })
      })
      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        data = { message: text }
      }

      if (!response.ok) {
        throw new Error(data.message || data.error || '生成失败')
      }

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

      const response = await fetch('/api/images/from-image', {
        method: 'POST',
        body: form
      })

      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        data = { message: text }
      }

      if (!response.ok) {
        throw new Error(data.message || data.error || '生成失败')
      }

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

  return { images, isLoading, activeJob, isGenerating, fetchImages, fetchImage, generate, generateFromImage, clearJob }
})
