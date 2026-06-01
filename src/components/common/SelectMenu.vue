<template>
  <div ref="containerRef" class="relative w-full">
    <button
      ref="triggerRef"
      type="button"
      class="input w-full flex items-center justify-between gap-2"
      :class="[
        sizeClass,
        isOpen ? 'ring-2 ring-[rgba(99,102,241,0.18)] border-[rgba(99,102,241,0.25)]' : '',
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
      ]"
      :disabled="disabled"
      :aria-expanded="isOpen"
      :aria-haspopup="true"
      @click="toggle"
      @keydown="onTriggerKeyDown"
    >
      <span class="min-w-0 flex-1 truncate text-left" :class="selectedOption ? 'text-[var(--text)]' : 'text-[var(--muted)]'">
        <slot name="selected" :option="selectedOption">
          {{ selectedLabel }}
        </slot>
      </span>
      <span class="shrink-0 text-[var(--muted)] transition-transform duration-200" :class="isOpen ? 'rotate-180' : ''">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </button>

    <Teleport to="body">
      <Transition name="selectmenu-dd">
        <div
          v-if="isOpen"
          ref="dropdownRef"
          class="selectmenu-portal"
          :class="[instanceId]"
          :style="dropdownStyle"
          role="listbox"
          tabindex="-1"
          @keydown="onDropdownKeyDown"
          @mousedown.stop
          @click.stop
        >
          <div ref="optionsListRef" class="selectmenu-options">
            <button
              v-if="showPlaceholderOption"
              type="button"
              role="option"
              class="selectmenu-option"
              :class="modelValue === '' ? 'selectmenu-option-selected' : ''"
              @mouseenter="focusedIndex = 0"
              @click="selectValue('', null)"
            >
              <span class="min-w-0 flex-1 truncate text-left">{{ placeholder }}</span>
              <span v-if="modelValue === ''" class="text-[var(--primary)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
            </button>

            <button
              v-for="(opt, idx) in options"
              :key="String(getOptionValue(opt))"
              type="button"
              role="option"
              class="selectmenu-option"
              :class="[
                isSelected(opt) ? 'selectmenu-option-selected' : '',
                isOptionDisabled(opt) ? 'selectmenu-option-disabled' : '',
                focusedIndex === optionIndexOffset + idx ? 'selectmenu-option-focused' : ''
              ]"
              :disabled="isOptionDisabled(opt)"
              :aria-selected="isSelected(opt)"
              :aria-disabled="isOptionDisabled(opt)"
              @mouseenter="handleOptionMouseEnter(idx)"
              @click="!isOptionDisabled(opt) && selectOption(opt)"
            >
              <slot name="option" :option="opt" :selected="isSelected(opt)">
                <span class="min-w-0 flex-1 truncate text-left">{{ getOptionLabel(opt) }}</span>
                <span v-if="isSelected(opt)" class="text-[var(--primary)]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </span>
              </slot>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number, Boolean, null],
    default: ''
  },
  options: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: ''
  },
  placeholderSelectable: {
    type: Boolean,
    default: true
  },
  disabled: {
    type: Boolean,
    default: false
  },
  valueKey: {
    type: String,
    default: 'value'
  },
  labelKey: {
    type: String,
    default: 'label'
  },
  size: {
    type: String,
    default: 'md'
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const instanceId = `selectmenu-${Math.random().toString(36).slice(2, 9)}`

const isOpen = ref(false)
const focusedIndex = ref(-1)
const dropdownPosition = ref('bottom')
const triggerRect = ref(null)

const containerRef = ref(null)
const triggerRef = ref(null)
const dropdownRef = ref(null)
const optionsListRef = ref(null)

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'input-sm'
  if (props.size === 'xs') return 'input-xs'
  return ''
})

function getOptionValue(option) {
  if (typeof option === 'object' && option !== null) return option[props.valueKey]
  return option
}

function getOptionLabel(option) {
  if (typeof option === 'object' && option !== null) return String(option[props.labelKey] ?? '')
  return String(option ?? '')
}

function isOptionDisabled(option) {
  if (typeof option === 'object' && option !== null) return !!option.disabled
  return false
}

const selectedOption = computed(() => props.options.find((opt) => getOptionValue(opt) === props.modelValue) || null)

const selectedLabel = computed(() => {
  if (selectedOption.value) return getOptionLabel(selectedOption.value)
  if (props.placeholder) return props.placeholder
  return ''
})

function isSelected(option) {
  return getOptionValue(option) === props.modelValue
}

const showPlaceholderOption = computed(() => {
  if (!props.placeholder || !props.placeholderSelectable) return false
  return !props.options.some((opt) => {
    const value = getOptionValue(opt)
    return value === '' || getOptionLabel(opt) === props.placeholder
  })
})

const optionIndexOffset = computed(() => (showPlaceholderOption.value ? 1 : 0))

const dropdownStyle = computed(() => {
  if (!triggerRect.value) return {}
  const rect = triggerRect.value
  const style = {
    position: 'fixed',
    left: `${rect.left}px`,
    minWidth: `${rect.width}px`,
    zIndex: '100000020'
  }
  if (dropdownPosition.value === 'top') style.bottom = `${window.innerHeight - rect.top + 6}px`
  else style.top = `${rect.bottom + 6}px`
  return style
})

function updateTriggerRect() {
  if (!containerRef.value) return
  triggerRect.value = containerRef.value.getBoundingClientRect()
}

function calculateDropdownPosition() {
  updateTriggerRect()
  nextTick(() => {
    if (!dropdownRef.value || !triggerRect.value) return
    const dropdownHeight = dropdownRef.value.offsetHeight || 240
    const spaceBelow = window.innerHeight - triggerRect.value.bottom
    const spaceAbove = triggerRect.value.top
    dropdownPosition.value = spaceBelow < dropdownHeight && spaceAbove > dropdownHeight ? 'top' : 'bottom'
  })
}

function open() {
  if (props.disabled) return
  isOpen.value = true
}

function close({ restoreFocus = true } = {}) {
  isOpen.value = false
  focusedIndex.value = -1
  if (restoreFocus) triggerRef.value?.focus?.()
}

function toggle() {
  if (isOpen.value) close({ restoreFocus: false })
  else open()
}

function selectValue(value, option) {
  emit('update:modelValue', value)
  emit('change', value, option)
  close()
}

function selectOption(option) {
  const value = getOptionValue(option) ?? ''
  selectValue(value, option)
}

function setInitialFocus() {
  const opts = props.options || []
  if (props.placeholder && props.placeholderSelectable) {
    if (props.modelValue === '') focusedIndex.value = 0
    else focusedIndex.value = 1
    return
  }
  const idx = opts.findIndex((o) => getOptionValue(o) === props.modelValue)
  focusedIndex.value = Math.max(0, idx)
}

function findNextEnabledIndex(start) {
  const listSize = optionIndexOffset.value + props.options.length
  for (let i = 0; i < listSize; i++) {
    const idx = (start + i) % listSize
    if (idx < optionIndexOffset.value) return idx
    const opt = props.options[idx - optionIndexOffset.value]
    if (!isOptionDisabled(opt)) return idx
  }
  return -1
}

function findPrevEnabledIndex(start) {
  const listSize = optionIndexOffset.value + props.options.length
  for (let i = 0; i < listSize; i++) {
    const idx = (start - i + listSize) % listSize
    if (idx < optionIndexOffset.value) return idx
    const opt = props.options[idx - optionIndexOffset.value]
    if (!isOptionDisabled(opt)) return idx
  }
  return -1
}

function scrollToFocused() {
  nextTick(() => {
    const list = optionsListRef.value
    if (!list) return
    const el = list.children[focusedIndex.value]
    if (!el) return
    const top = el.offsetTop
    const bottom = top + el.offsetHeight
    if (top < list.scrollTop) list.scrollTop = top
    else if (bottom > list.scrollTop + list.offsetHeight) list.scrollTop = bottom - list.offsetHeight
  })
}

function onTriggerKeyDown(e) {
  if (props.disabled) return
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (!isOpen.value) open()
  }
}

function onDropdownKeyDown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    focusedIndex.value = findNextEnabledIndex(Math.max(0, focusedIndex.value + 1))
    scrollToFocused()
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    focusedIndex.value = findPrevEnabledIndex(Math.max(0, focusedIndex.value - 1))
    scrollToFocused()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    if (focusedIndex.value < 0) return
    if (focusedIndex.value < optionIndexOffset.value) {
      selectValue('', null)
      return
    }
    const opt = props.options[focusedIndex.value - optionIndexOffset.value]
    if (!opt || isOptionDisabled(opt)) return
    selectOption(opt)
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    return
  }
  if (e.key === 'Tab') {
    close({ restoreFocus: false })
  }
}

function handleOptionMouseEnter(idx) {
  focusedIndex.value = optionIndexOffset.value + idx
}

function handleClickOutside(event) {
  const target = event.target
  const inTrigger = containerRef.value?.contains?.(target)
  const inDropdown = target?.closest?.(`.${instanceId}`)
  if (!inTrigger && !inDropdown && isOpen.value) close({ restoreFocus: false })
}

watch(isOpen, (openNow) => {
  if (openNow) {
    calculateDropdownPosition()
    setInitialFocus()
    nextTick(() => dropdownRef.value?.focus?.())
    window.addEventListener('scroll', updateTriggerRect, { capture: true, passive: true })
    window.addEventListener('resize', calculateDropdownPosition)
  } else {
    window.removeEventListener('scroll', updateTriggerRect, { capture: true })
    window.removeEventListener('resize', calculateDropdownPosition)
  }
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('scroll', updateTriggerRect, { capture: true })
  window.removeEventListener('resize', calculateDropdownPosition)
})
</script>

<style scoped>
.selectmenu-portal {
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14px 44px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(18px);
  overflow: hidden;
  pointer-events: auto;
}

.selectmenu-options {
  max-height: 220px;
  overflow: auto;
  padding: 5px;
  outline: none;
}

.selectmenu-option {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: var(--text);
  cursor: pointer;
}

.selectmenu-option:hover {
  background: rgba(15, 23, 42, 0.04);
}

.selectmenu-option-focused {
  background: rgba(15, 23, 42, 0.06);
}

.selectmenu-option-selected {
  background: rgba(37, 99, 235, 0.10);
  color: var(--primary);
}

.selectmenu-option-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.selectmenu-dd-enter-active,
.selectmenu-dd-leave-active {
  transition: all 0.18s ease;
}

.selectmenu-dd-enter-from,
.selectmenu-dd-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
