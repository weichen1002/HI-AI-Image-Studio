import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useImagesStore = defineStore('images', () => {
  const images = ref([])
  const isLoading = ref(false)

  function toListImage(image) {
    return {
      ...image,
      imageUrls: (image.imageUrls || [])
        .filter((url) => url && !url.startsWith('data:'))
        .slice(0, 1)
    }
  }

  async function fetchImages(limit = 24) {
    isLoading.value = true
    try {
      const response = await fetch(`/api/images?limit=${limit}`)
      if (response.ok) {
        const data = await response.json()
        images.value = data.images
      }
    } finally {
      isLoading.value = false
    }
  }

  async function generate(prompt, aspectRatio) {
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
    
    // Prepend new image
    images.value.unshift(toListImage(data.image))
    return data.image
  }

  return { images, isLoading, fetchImages, generate }
})
