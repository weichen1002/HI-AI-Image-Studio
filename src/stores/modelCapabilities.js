import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiFetch } from '../utils/api'

export const DEFAULT_MODEL_CAPABILITIES = {
  model: {
    imageModel: '',
    cutoutModel: '',
    textModel: '',
    sizeFormat: 'pixel',
    responseFormat: 'url'
  },
  generation: {
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    qualityTiers: ['1k', '2k', '4k'],
    counts: [1, 2, 4],
    outputFormats: ['png', 'jpeg', 'webp'],
    backgrounds: ['auto', 'transparent', 'opaque'],
    moderationLevels: ['auto', 'low']
  },
  edit: {
    sizes: ['auto', '1024x1024', '1536x1024', '1024x1536'],
    qualities: ['auto', 'low', 'medium', 'high'],
    operations: ['inpaint', 'outpaint', 'cutout', 'upscale']
  },
  features: {
    textToImage: true,
    imageToImage: true,
    dialogue: true,
    describe: true,
    promptEnhance: true,
    cutout: true,
    transparentBackground: true
  }
}

function mergeCapabilities(value = {}) {
  return {
    ...DEFAULT_MODEL_CAPABILITIES,
    ...value,
    model: {
      ...DEFAULT_MODEL_CAPABILITIES.model,
      ...(value.model || {})
    },
    generation: {
      ...DEFAULT_MODEL_CAPABILITIES.generation,
      ...(value.generation || {})
    },
    edit: {
      ...DEFAULT_MODEL_CAPABILITIES.edit,
      ...(value.edit || {})
    },
    features: {
      ...DEFAULT_MODEL_CAPABILITIES.features,
      ...(value.features || {})
    }
  }
}

export const useModelCapabilitiesStore = defineStore('modelCapabilities', () => {
  const capabilities = ref(mergeCapabilities())
  const loading = ref(false)
  const loaded = ref(false)

  async function fetchCapabilities() {
    loading.value = true
    try {
      const data = await apiFetch('/api/hiapi/capabilities', undefined, { toast: false, redirectOn401: false })
      capabilities.value = mergeCapabilities(data?.capabilities)
      loaded.value = true
      return capabilities.value
    } catch {
      capabilities.value = mergeCapabilities()
      loaded.value = true
      return capabilities.value
    } finally {
      loading.value = false
    }
  }

  const features = computed(() => capabilities.value.features || DEFAULT_MODEL_CAPABILITIES.features)
  const generation = computed(() => capabilities.value.generation || DEFAULT_MODEL_CAPABILITIES.generation)
  const edit = computed(() => capabilities.value.edit || DEFAULT_MODEL_CAPABILITIES.edit)

  return {
    capabilities,
    features,
    generation,
    edit,
    loading,
    loaded,
    fetchCapabilities
  }
})
