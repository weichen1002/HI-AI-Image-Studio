import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useImagesStore = defineStore('images', () => {
  const images = ref([])
  const isLoading = ref(false)

  async function fetchImages() {
    isLoading.value = true
    try {
      const response = await fetch('/api/images')
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
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '生成失败')
    
    // Prepend new image
    images.value.unshift(data.image)
    return data.image
  }

  return { images, isLoading, fetchImages, generate }
})