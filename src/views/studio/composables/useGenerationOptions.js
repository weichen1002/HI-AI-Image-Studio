import { computed, reactive, watch } from 'vue'
import { DEFAULT_MODEL_CAPABILITIES } from '../../../stores/modelCapabilities'

export const ratios = ['1:1', '16:9', '9:16', '4:3', '3:4']
export const ratioOptions = ratios.map((ratio) => ({ label: `比例 ${ratio}`, value: ratio }))
export const qualityTierOptions = [
  { label: '1K 标准', value: '1k' },
  { label: '2K 高清', value: '2k' },
  { label: '4K 超清', value: '4k' }
]
export const countOptions = [
  { label: '1 张', value: 1 },
  { label: '2 张', value: 2 },
  { label: '4 张', value: 4 }
]
export const outputFormatOptions = [
  { label: 'PNG', value: 'png' },
  { label: 'JPEG', value: 'jpeg' },
  { label: 'WEBP', value: 'webp' }
]
export const backgroundOptions = [
  { label: '自动', value: 'auto' },
  { label: '透明背景', value: 'transparent' },
  { label: '纯色背景', value: 'opaque' }
]
export const moderationOptions = [
  { label: '自动', value: 'auto' },
  { label: '低限制', value: 'low' }
]

const GENERATION_QUERY_KEYS = [
  'ratio',
  'qualityTier',
  'count',
  'outputFormat',
  'outputCompression',
  'background',
  'moderation'
]

export function getRatioValue(ratio) {
  if (ratio === 'auto') return '1 / 1'
  const [w, h] = String(ratio || '1:1').split(':')
  return `${w} / ${h}`
}

function optionIncludes(options, value) {
  return options.some((item) => item.value === value)
}

function labelFor(options, value, fallback) {
  return options.find((item) => item.value === value)?.label || fallback
}

export function hasGenerationRouteOptions(query = {}) {
  return GENERATION_QUERY_KEYS.some((key) => query[key] !== undefined)
}

function filterOptions(options, supported = []) {
  const allowed = new Set(Array.isArray(supported) ? supported : [])
  if (!allowed.size) return options
  return options.filter((item) => allowed.has(item.value))
}

function firstValue(options, fallback) {
  return options[0]?.value ?? fallback
}

export function useGenerationOptions(createSettings = {}, capabilitiesRef = null) {
  const capabilities = computed(() => capabilitiesRef?.value || DEFAULT_MODEL_CAPABILITIES)
  const supportedRatioOptions = computed(() => filterOptions(ratioOptions, capabilities.value.generation?.aspectRatios))
  const supportedQualityTierOptions = computed(() => filterOptions(qualityTierOptions, capabilities.value.generation?.qualityTiers))
  const supportedCountOptions = computed(() => filterOptions(countOptions, capabilities.value.generation?.counts))
  const supportedOutputFormatOptions = computed(() => filterOptions(outputFormatOptions, capabilities.value.generation?.outputFormats))
  const supportedBackgroundOptions = computed(() => filterOptions(backgroundOptions, capabilities.value.generation?.backgrounds))
  const supportedModerationOptions = computed(() => filterOptions(moderationOptions, capabilities.value.generation?.moderationLevels))

  const generationForm = reactive({
    prompt: '',
    aspectRatio: createSettings.aspectRatio || '1:1',
    qualityTier: createSettings.qualityTier || '1k',
    count: createSettings.count || 1,
    outputFormat: createSettings.outputFormat || 'png',
    outputCompression: createSettings.outputCompression ?? 100,
    background: createSettings.background || 'auto',
    moderation: createSettings.moderation || 'auto'
  })

  function generationOptions(extra = {}) {
    return {
      qualityTier: generationForm.qualityTier,
      count: generationForm.count,
      outputFormat: generationForm.outputFormat,
      outputCompression: generationForm.outputCompression,
      background: generationForm.background,
      moderation: generationForm.moderation,
      ...extra
    }
  }

  function applyRouteGenerationOptions(query = {}) {
    const supportedRatios = supportedRatioOptions.value.map((item) => item.value)
    if (query.ratio && supportedRatios.includes(String(query.ratio))) {
      generationForm.aspectRatio = String(query.ratio)
    }

    if (query.qualityTier && optionIncludes(supportedQualityTierOptions.value, String(query.qualityTier))) {
      generationForm.qualityTier = String(query.qualityTier)
    }

    if (query.count && optionIncludes(supportedCountOptions.value, Number(query.count))) {
      generationForm.count = Number(query.count)
    }

    if (query.outputFormat && optionIncludes(supportedOutputFormatOptions.value, String(query.outputFormat))) {
      generationForm.outputFormat = String(query.outputFormat)
    }

    if (query.outputCompression !== undefined) {
      const compression = Number(query.outputCompression)
      if (Number.isFinite(compression)) {
        generationForm.outputCompression = Math.max(0, Math.min(100, Math.floor(compression)))
      }
    }

    if (query.background && optionIncludes(supportedBackgroundOptions.value, String(query.background))) {
      generationForm.background = String(query.background)
    }

    if (query.moderation && optionIncludes(supportedModerationOptions.value, String(query.moderation))) {
      generationForm.moderation = String(query.moderation)
    }
  }

  watch(
    [
      supportedRatioOptions,
      supportedQualityTierOptions,
      supportedCountOptions,
      supportedOutputFormatOptions,
      supportedBackgroundOptions,
      supportedModerationOptions
    ],
    () => {
      if (!optionIncludes(supportedRatioOptions.value, generationForm.aspectRatio)) {
        generationForm.aspectRatio = firstValue(supportedRatioOptions.value, '1:1')
      }
      if (!optionIncludes(supportedQualityTierOptions.value, generationForm.qualityTier)) {
        generationForm.qualityTier = firstValue(supportedQualityTierOptions.value, '1k')
      }
      if (!optionIncludes(supportedCountOptions.value, generationForm.count)) {
        generationForm.count = firstValue(supportedCountOptions.value, 1)
      }
      if (!optionIncludes(supportedOutputFormatOptions.value, generationForm.outputFormat)) {
        generationForm.outputFormat = firstValue(supportedOutputFormatOptions.value, 'png')
      }
      if (!optionIncludes(supportedBackgroundOptions.value, generationForm.background)) {
        generationForm.background = firstValue(supportedBackgroundOptions.value, 'auto')
      }
      if (!optionIncludes(supportedModerationOptions.value, generationForm.moderation)) {
        generationForm.moderation = firstValue(supportedModerationOptions.value, 'auto')
      }
    },
    { immediate: true }
  )

  watch(
    () => generationForm.background,
    (value) => {
      if (value === 'transparent' && generationForm.outputFormat === 'jpeg') {
        generationForm.outputFormat = 'png'
      }
    }
  )

  watch(
    () => generationForm.outputFormat,
    (value) => {
      if (value === 'jpeg' && generationForm.background === 'transparent') {
        generationForm.background = 'auto'
      }
    }
  )

  const supportsCompression = computed(() => {
    return generationForm.outputFormat === 'jpeg' || generationForm.outputFormat === 'webp'
  })
  const previewAspectRatio = computed(() => getRatioValue(generationForm.aspectRatio))
  const advancedSummary = computed(() => {
    const summaryParts = [
      labelFor(supportedQualityTierOptions.value, generationForm.qualityTier, '标准'),
      labelFor(supportedCountOptions.value, generationForm.count, '1 张'),
      String(generationForm.outputFormat || 'png').toUpperCase(),
      labelFor(supportedBackgroundOptions.value, generationForm.background, '自动'),
      `${labelFor(supportedModerationOptions.value, generationForm.moderation, '自动')}审核`
    ]
    if (supportsCompression.value) {
      summaryParts.push(`压缩 ${generationForm.outputCompression}%`)
    }
    return summaryParts.join(' · ')
  })

  return {
    generationForm,
    ratios: computed(() => supportedRatioOptions.value.map((item) => item.value)),
    ratioOptions: supportedRatioOptions,
    qualityTierOptions: supportedQualityTierOptions,
    countOptions: supportedCountOptions,
    outputFormatOptions: supportedOutputFormatOptions,
    backgroundOptions: supportedBackgroundOptions,
    moderationOptions: supportedModerationOptions,
    supportsCompression,
    previewAspectRatio,
    advancedSummary,
    generationOptions,
    applyRouteGenerationOptions
  }
}
