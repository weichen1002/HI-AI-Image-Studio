<template>
  <Teleport to="body">
    <Transition name="editor-fade">
      <div v-if="open" class="editor-mask" @click="close">
        <div class="editor-shell" @click.stop>
          <div class="editor-head">
            <div class="editor-head-left">
              <div class="editor-title">图片编辑器</div>
              <div class="editor-subtitle">局部重绘与扩图共用同一套工作区，保持工作台首屏简洁。</div>
            </div>
            <button type="button" class="editor-close" @click="close" aria-label="关闭编辑器">
              <XIcon :size="18" />
            </button>
          </div>

          <div class="editor-body">
            <aside class="editor-sidebar">
              <div class="mode-switch">
                <button
                  v-for="item in modeOptions"
                  :key="item.value"
                  type="button"
                  class="mode-btn"
                  :class="{ active: mode === item.value }"
                  :disabled="loading"
                  @click="switchMode(item.value)"
                >
                  {{ item.label }}
                </button>
              </div>

              <div class="field">
                <label class="field-label">修改说明</label>
                <textarea
                  v-model="prompt"
                  class="textarea editor-textarea"
                  maxlength="4000"
                  placeholder="例如：修复手部细节，保持人物姿态和整体风格不变；不要出现文字和水印。"
                ></textarea>
              </div>

              <template v-if="mode === 'inpaint'">
                <div class="field">
                  <label class="field-label">画笔大小</label>
                  <input v-model="brushSize" class="editor-range" type="range" min="8" max="72" step="2" />
                  <div class="field-hint">当前 {{ brushSize }} px，先涂抹要修改的区域，再点击开始重绘。</div>
                </div>
                <div class="tool-row">
                  <Button variant="ghost" size="sm" :disabled="loading || !canUndo" @click="undoStroke">撤销</Button>
                  <Button variant="ghost" size="sm" :disabled="loading || !canRedo" @click="redoStroke">重做</Button>
                  <Button variant="ghost" size="sm" :disabled="loading || !strokes.length" @click="clearMask">清空蒙版</Button>
                </div>
              </template>

              <template v-else>
                <div class="field">
                  <label class="field-label">扩图方向</label>
                  <div class="expand-grid">
                    <button
                      v-for="item in expandDirections"
                      :key="item.value"
                      type="button"
                      class="expand-btn"
                      :class="{ active: expandDirection === item.value }"
                      :disabled="loading"
                      @click="expandDirection = item.value"
                    >
                      {{ item.label }}
                    </button>
                  </div>
                </div>
                <div class="field">
                  <label class="field-label">扩展比例</label>
                  <input v-model="expandRatio" class="editor-range" type="range" min="10" max="35" step="5" />
                  <div class="field-hint">当前 {{ expandRatio }}%，会按方向在画布新增留白，再通过编辑能力补全画面。</div>
                </div>
              </template>

              <div class="field">
                <label class="field-label">输出比例</label>
                <div class="ratio-chip">{{ outputAspectRatio }}</div>
              </div>

              <div v-if="errorMsg" class="error-text">{{ errorMsg }}</div>
            </aside>

            <section class="editor-stage-wrap">
              <div class="stage-topbar">
                <div class="stage-meta">
                  <span class="stage-chip">{{ mode === 'inpaint' ? '局部重绘' : '扩图' }}</span>
                  <span class="stage-chip">{{ naturalWidth }} x {{ naturalHeight }}</span>
                </div>
                <div class="stage-tip">
                  <template v-if="mode === 'inpaint'">拖拽涂抹要修改的区域，未涂抹部分会被尽量保留。</template>
                  <template v-else>彩色高亮区域表示新增画布，模型会只补全这部分内容。</template>
                </div>
              </div>

              <div class="editor-stage">
                <div class="stage-frame" :style="{ width: `${displayWidth}px`, height: `${displayHeight}px` }">
                  <canvas ref="baseCanvasRef" class="stage-canvas"></canvas>
                  <canvas
                    ref="overlayCanvasRef"
                    class="stage-canvas overlay"
                    :class="{ drawable: mode === 'inpaint' }"
                    @pointerdown="startDraw"
                    @pointermove="drawMove"
                    @pointerup="endDraw"
                    @pointercancel="endDraw"
                    @pointerleave="endDraw"
                  ></canvas>
                </div>
              </div>

              <div class="editor-foot">
                <Button variant="ghost" :disabled="loading" @click="resetCurrentMode">重置</Button>
                <Button :disabled="loading || !canSubmit" @click="submitEdit">
                  <template #icon>
                    <LoaderIcon v-if="loading" :size="16" class="spin" />
                    <Wand2Icon v-else :size="16" />
                  </template>
                  {{ loading ? submitTextLoading : submitText }}
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { LoaderIcon, Wand2Icon, XIcon } from 'lucide-vue-next'
import { Button, toastError, toastSuccess } from '../common'
import { useImagesStore } from '../../stores/images'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  sourceUrl: {
    type: String,
    default: ''
  },
  sourceFile: {
    type: [File, Object, null],
    default: null
  },
  sourceImageId: {
    type: String,
    default: ''
  },
  sourcePrompt: {
    type: String,
    default: ''
  },
  aspectRatio: {
    type: String,
    default: '1:1'
  },
  initialMode: {
    type: String,
    default: 'inpaint'
  }
})

const emit = defineEmits(['update:open', 'completed'])

const imagesStore = useImagesStore()

const modeOptions = [
  { value: 'inpaint', label: '局部重绘' },
  { value: 'outpaint', label: '扩图' }
]
const expandDirections = [
  { value: 'left', label: '向左' },
  { value: 'right', label: '向右' },
  { value: 'top', label: '向上' },
  { value: 'bottom', label: '向下' },
  { value: 'all', label: '四周' }
]

const baseCanvasRef = ref(null)
const overlayCanvasRef = ref(null)

const mode = ref('inpaint')
const prompt = ref('')
const loading = ref(false)
const errorMsg = ref('')
const brushSize = ref(28)
const expandDirection = ref('right')
const expandRatio = ref(20)
const sourceFileRef = ref(null)
const sourceImage = ref(null)
const naturalWidth = ref(0)
const naturalHeight = ref(0)
const displayWidth = ref(0)
const displayHeight = ref(0)
const drawing = ref(false)
const pointerId = ref(null)
const strokes = ref([])
const redoStack = ref([])

const stageLimitWidth = 780
const stageLimitHeight = 520

const canUndo = computed(() => strokes.value.length > 0)
const canRedo = computed(() => redoStack.value.length > 0)
const canSubmit = computed(() => {
  if (!sourceFileRef.value || !prompt.value.trim()) return false
  if (mode.value === 'inpaint') return strokes.value.length > 0
  return true
})

const submitText = computed(() => (mode.value === 'inpaint' ? '开始重绘' : '开始扩图'))
const submitTextLoading = computed(() => (mode.value === 'inpaint' ? '重绘中...' : '扩图中...'))
const outputAspectRatio = computed(() => {
  if (!naturalWidth.value || !naturalHeight.value) return props.aspectRatio
  if (mode.value === 'inpaint') return normalizeAspect(naturalWidth.value, naturalHeight.value)
  const layout = outpaintLayout()
  return normalizeAspect(layout.width, layout.height)
})

watch(
  () => props.open,
  async (value) => {
    if (!value) return
    await initialize()
  }
)

watch([mode, expandDirection, expandRatio], async () => {
  if (!props.open || !sourceImage.value) return
  await nextTick()
  renderStage()
})

function close() {
  emit('update:open', false)
}

async function initialize() {
  loading.value = false
  errorMsg.value = ''
  prompt.value = props.sourcePrompt || ''
  mode.value = props.initialMode === 'outpaint' ? 'outpaint' : 'inpaint'
  expandDirection.value = 'right'
  expandRatio.value = 20
  brushSize.value = 28
  strokes.value = []
  redoStack.value = []

  try {
    const file = await resolveSourceFile()
    sourceFileRef.value = file
    sourceImage.value = await loadImage(URL.createObjectURL(file))
    naturalWidth.value = sourceImage.value.naturalWidth || sourceImage.value.width
    naturalHeight.value = sourceImage.value.naturalHeight || sourceImage.value.height
    await nextTick()
    renderStage()
  } catch (error) {
    errorMsg.value = error.message || '图片加载失败'
  }
}

async function resolveSourceFile() {
  if (props.sourceFile instanceof File) return props.sourceFile
  if (!props.sourceUrl) {
    throw new Error('缺少可编辑图片')
  }
  const response = await fetch(props.sourceUrl)
  if (!response.ok) {
    throw new Error('图片加载失败')
  }
  const blob = await response.blob()
  const fileName = props.sourceUrl.split('/').pop() || 'edit-source.png'
  return new File([blob], fileName, { type: blob.type || 'image/png' })
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解析失败'))
    image.src = url
  })
}

function switchMode(nextMode) {
  if (loading.value) return
  mode.value = nextMode
  resetCurrentMode()
}

function resetCurrentMode() {
  errorMsg.value = ''
  if (mode.value === 'inpaint') {
    strokes.value = []
    redoStack.value = []
  } else {
    expandDirection.value = 'right'
    expandRatio.value = 20
  }
  renderStage()
}

function renderStage() {
  if (!baseCanvasRef.value || !overlayCanvasRef.value || !sourceImage.value) return
  if (mode.value === 'inpaint') {
    renderInpaintStage()
    return
  }
  renderOutpaintStage()
}

function setCanvasSize(baseCanvas, overlayCanvas, width, height) {
  displayWidth.value = Math.round(width)
  displayHeight.value = Math.round(height)

  for (const canvas of [baseCanvas, overlayCanvas]) {
    canvas.width = Math.max(1, Math.round(width))
    canvas.height = Math.max(1, Math.round(height))
    canvas.style.width = `${Math.round(width)}px`
    canvas.style.height = `${Math.round(height)}px`
  }
}

function renderInpaintStage() {
  const baseCanvas = baseCanvasRef.value
  const overlayCanvas = overlayCanvasRef.value
  const fit = fitSize(naturalWidth.value, naturalHeight.value)
  setCanvasSize(baseCanvas, overlayCanvas, fit.width, fit.height)

  const baseCtx = baseCanvas.getContext('2d')
  const overlayCtx = overlayCanvas.getContext('2d')
  baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height)
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
  baseCtx.drawImage(sourceImage.value, 0, 0, baseCanvas.width, baseCanvas.height)

  // 预览层只负责展示用户涂抹区域，不影响实际导出的原图。
  drawPreviewMask(overlayCtx, overlayCanvas.width, overlayCanvas.height)
}

function renderOutpaintStage() {
  const baseCanvas = baseCanvasRef.value
  const overlayCanvas = overlayCanvasRef.value
  const layout = outpaintLayout()
  const fit = fitSize(layout.width, layout.height)
  const scale = fit.width / layout.width
  const offsetX = layout.offsetX * scale
  const offsetY = layout.offsetY * scale
  const sourceWidth = naturalWidth.value * scale
  const sourceHeight = naturalHeight.value * scale

  setCanvasSize(baseCanvas, overlayCanvas, fit.width, fit.height)
  const baseCtx = baseCanvas.getContext('2d')
  const overlayCtx = overlayCanvas.getContext('2d')
  baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height)
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

  baseCtx.fillStyle = 'rgba(15, 23, 42, 0.03)'
  baseCtx.fillRect(0, 0, baseCanvas.width, baseCanvas.height)
  baseCtx.drawImage(sourceImage.value, offsetX, offsetY, sourceWidth, sourceHeight)

  overlayCtx.fillStyle = 'rgba(37, 99, 235, 0.12)'
  const regions = getOutpaintRegions(
    fit.width,
    fit.height,
    offsetX,
    offsetY,
    sourceWidth,
    sourceHeight
  )
  for (const region of regions) {
    overlayCtx.fillRect(region.x, region.y, region.width, region.height)
  }
  overlayCtx.strokeStyle = 'rgba(37, 99, 235, 0.55)'
  overlayCtx.lineWidth = 2
  overlayCtx.strokeRect(offsetX, offsetY, sourceWidth, sourceHeight)
}

function fitSize(width, height) {
  const scale = Math.min(stageLimitWidth / width, stageLimitHeight / height, 1)
  return {
    width: width * scale,
    height: height * scale,
    scale
  }
}

function outpaintLayout() {
  const ratio = Number(expandRatio.value || 0) / 100
  const addX = Math.round(naturalWidth.value * ratio)
  const addY = Math.round(naturalHeight.value * ratio)
  if (expandDirection.value === 'left') {
    return { width: naturalWidth.value + addX, height: naturalHeight.value, offsetX: addX, offsetY: 0 }
  }
  if (expandDirection.value === 'right') {
    return { width: naturalWidth.value + addX, height: naturalHeight.value, offsetX: 0, offsetY: 0 }
  }
  if (expandDirection.value === 'top') {
    return { width: naturalWidth.value, height: naturalHeight.value + addY, offsetX: 0, offsetY: addY }
  }
  if (expandDirection.value === 'bottom') {
    return { width: naturalWidth.value, height: naturalHeight.value + addY, offsetX: 0, offsetY: 0 }
  }
  return {
    width: naturalWidth.value + addX * 2,
    height: naturalHeight.value + addY * 2,
    offsetX: addX,
    offsetY: addY
  }
}

function getOutpaintRegions(canvasWidth, canvasHeight, offsetX, offsetY, sourceWidth, sourceHeight) {
  const regions = []
  const sourceRight = offsetX + sourceWidth
  const sourceBottom = offsetY + sourceHeight

  // 左侧新增区域
  if (offsetX > 0) {
    regions.push({
      x: 0,
      y: 0,
      width: offsetX,
      height: canvasHeight
    })
  }

  // 右侧新增区域
  if (sourceRight < canvasWidth) {
    regions.push({
      x: sourceRight,
      y: 0,
      width: canvasWidth - sourceRight,
      height: canvasHeight
    })
  }

  // 上方新增区域
  if (offsetY > 0) {
    regions.push({
      x: offsetX,
      y: 0,
      width: sourceWidth,
      height: offsetY
    })
  }

  // 下方新增区域
  if (sourceBottom < canvasHeight) {
    regions.push({
      x: offsetX,
      y: sourceBottom,
      width: sourceWidth,
      height: canvasHeight - sourceBottom
    })
  }

  return regions.filter((region) => region.width > 0 && region.height > 0)
}

function getPoint(event) {
  const canvas = overlayCanvasRef.value
  const rect = canvas.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
}

function startDraw(event) {
  if (mode.value !== 'inpaint' || loading.value) return
  drawing.value = true
  pointerId.value = event.pointerId
  overlayCanvasRef.value?.setPointerCapture?.(event.pointerId)
  redoStack.value = []
  strokes.value.push({
    size: Number(brushSize.value),
    points: [getPoint(event)]
  })
  renderStage()
}

function drawMove(event) {
  if (!drawing.value || pointerId.value !== event.pointerId) return
  const current = strokes.value[strokes.value.length - 1]
  if (!current) return
  current.points.push(getPoint(event))
  drawPreviewMask(
    overlayCanvasRef.value.getContext('2d'),
    overlayCanvasRef.value.width,
    overlayCanvasRef.value.height
  )
}

function endDraw(event) {
  if (!drawing.value) return
  if (pointerId.value !== null && event.pointerId !== pointerId.value) return
  drawing.value = false
  pointerId.value = null
  overlayCanvasRef.value?.releasePointerCapture?.(event.pointerId)
}

function drawPreviewMask(ctx, width, height) {
  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(14, 165, 233, 0.46)'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const stroke of strokes.value) {
    drawStroke(ctx, stroke.points, stroke.size, 1)
  }
}

function drawStroke(ctx, points, size, scale) {
  if (!points.length) return
  if (points.length === 1) {
    ctx.beginPath()
    ctx.arc(points[0].x * scale, points[0].y * scale, (size * scale) / 2, 0, Math.PI * 2)
    ctx.fillStyle = ctx.strokeStyle
    ctx.fill()
    return
  }
  ctx.lineWidth = size * scale
  ctx.beginPath()
  ctx.moveTo(points[0].x * scale, points[0].y * scale)
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x * scale, points[i].y * scale)
  }
  ctx.stroke()
}

function undoStroke() {
  if (!strokes.value.length) return
  redoStack.value.push(strokes.value.pop())
  renderStage()
}

function redoStroke() {
  if (!redoStack.value.length) return
  strokes.value.push(redoStack.value.pop())
  renderStage()
}

function clearMask() {
  strokes.value = []
  redoStack.value = []
  renderStage()
}

async function submitEdit() {
  if (!canSubmit.value || loading.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const payload =
      mode.value === 'inpaint' ? await buildInpaintPayload() : await buildOutpaintPayload()

    const image = await imagesStore.editImage({
      imageFile: payload.imageFile,
      maskFile: payload.maskFile,
      prompt: prompt.value.trim(),
      aspectRatio: payload.aspectRatio,
      operationType: mode.value,
      sourceImageId: props.sourceImageId,
      sourceImageUrl: props.sourceUrl
    })
    toastSuccess(mode.value === 'inpaint' ? '局部重绘完成' : '扩图完成')
    emit('completed', image)
    close()
  } catch (error) {
    errorMsg.value = error.message || '编辑失败'
    toastError(errorMsg.value)
  } finally {
    loading.value = false
  }
}

async function buildInpaintPayload() {
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = naturalWidth.value
  maskCanvas.height = naturalHeight.value
  const maskCtx = maskCanvas.getContext('2d')

  maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
  maskCtx.fillStyle = '#ffffff'
  maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
  maskCtx.strokeStyle = '#000000'
  maskCtx.lineCap = 'round'
  maskCtx.lineJoin = 'round'
  maskCtx.globalCompositeOperation = 'destination-out'

  const scaleX = naturalWidth.value / displayWidth.value
  const scaleY = naturalHeight.value / displayHeight.value
  const scale = Math.min(scaleX, scaleY)

  // OpenAI 图片编辑使用透明区域作为可重绘区域，因此这里把用户涂抹部分擦成透明。
  for (const stroke of strokes.value) {
    drawStroke(maskCtx, stroke.points, stroke.size, scale)
  }

  return {
    imageFile: sourceFileRef.value,
    maskFile: await canvasToFile(maskCanvas, 'inpaint-mask.png'),
    aspectRatio: normalizeAspect(naturalWidth.value, naturalHeight.value)
  }
}

async function buildOutpaintPayload() {
  const layout = outpaintLayout()
  const imageCanvas = document.createElement('canvas')
  imageCanvas.width = layout.width
  imageCanvas.height = layout.height
  const imageCtx = imageCanvas.getContext('2d')
  imageCtx.clearRect(0, 0, layout.width, layout.height)
  imageCtx.drawImage(sourceImage.value, layout.offsetX, layout.offsetY, naturalWidth.value, naturalHeight.value)

  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = layout.width
  maskCanvas.height = layout.height
  const maskCtx = maskCanvas.getContext('2d')
  maskCtx.clearRect(0, 0, layout.width, layout.height)
  maskCtx.fillStyle = '#ffffff'
  maskCtx.fillRect(layout.offsetX, layout.offsetY, naturalWidth.value, naturalHeight.value)

  return {
    imageFile: await canvasToFile(imageCanvas, 'outpaint-base.png'),
    maskFile: await canvasToFile(maskCanvas, 'outpaint-mask.png'),
    aspectRatio: normalizeAspect(layout.width, layout.height)
  }
}

function normalizeAspect(width, height) {
  const ratios = [
    { label: '1:1', value: 1 },
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16 },
    { label: '4:3', value: 4 / 3 },
    { label: '3:4', value: 3 / 4 }
  ]
  const current = width / height
  return ratios
    .slice()
    .sort((a, b) => Math.abs(a.value - current) - Math.abs(b.value - current))[0]
    .label
}

function canvasToFile(canvas, fileName) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('图片处理失败'))
        return
      }
      resolve(new File([blob], fileName, { type: 'image/png' }))
    }, 'image/png')
  })
}

onBeforeUnmount(() => {
  if (props.sourceFile instanceof File) return
})
</script>

<style scoped>
.editor-mask {
  position: fixed;
  inset: 0;
  z-index: 100000030;
  background: rgba(15, 23, 42, 0.30);
  backdrop-filter: blur(8px);
  padding: 18px;
  display: grid;
  place-items: center;
}

.editor-shell {
  width: min(1180px, calc(100vw - 36px));
  max-height: calc(100vh - 36px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.65);
  background:
    radial-gradient(900px 320px at 0% 0%, rgba(37, 99, 235, 0.12), transparent 55%),
    radial-gradient(780px 260px at 100% 0%, rgba(14, 165, 233, 0.07), transparent 55%),
    rgba(255, 255, 255, 0.96);
  box-shadow: 0 28px 90px rgba(15, 23, 42, 0.22);
}

.editor-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.editor-title {
  font-size: 18px;
  font-weight: 950;
  color: var(--text);
}

.editor-subtitle {
  margin-top: 6px;
  font-size: 13px;
  font-weight: 750;
  color: var(--muted);
}

.editor-close {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.72);
  display: grid;
  place-items: center;
  color: var(--muted);
  cursor: pointer;
}

.editor-body {
  min-height: 0;
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
}

.editor-sidebar {
  padding: 18px 18px;
  border-right: 1px solid rgba(15, 23, 42, 0.06);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.mode-btn,
.expand-btn {
  height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.72);
  color: var(--muted);
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.mode-btn.active,
.expand-btn.active {
  border-color: rgba(37, 99, 235, 0.24);
  background: rgba(37, 99, 235, 0.10);
  color: var(--primary);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 13px;
  font-weight: 950;
  color: var(--text);
}

.editor-textarea {
  min-height: 146px;
  resize: vertical;
}

.editor-range {
  width: 100%;
}

.field-hint {
  font-size: 12px;
  font-weight: 750;
  color: var(--muted);
  line-height: 1.5;
}

.tool-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.expand-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.ratio-chip {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(37, 99, 235, 0.16);
  background: rgba(37, 99, 235, 0.08);
  color: var(--primary);
  font-size: 12px;
  font-weight: 900;
}

.editor-stage-wrap {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.stage-topbar {
  padding: 16px 18px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.stage-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stage-chip {
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.72);
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
}

.stage-tip {
  font-size: 12px;
  font-weight: 750;
  color: var(--muted);
  text-align: right;
}

.editor-stage {
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 8px 18px 18px;
}

.stage-frame {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  background:
    linear-gradient(45deg, rgba(15, 23, 42, 0.03) 25%, transparent 25%, transparent 75%, rgba(15, 23, 42, 0.03) 75%),
    linear-gradient(45deg, rgba(15, 23, 42, 0.03) 25%, transparent 25%, transparent 75%, rgba(15, 23, 42, 0.03) 75%);
  background-position: 0 0, 10px 10px;
  background-size: 20px 20px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
}

.stage-canvas {
  position: absolute;
  inset: 0;
}

.stage-canvas.overlay.drawable {
  cursor: crosshair;
}

.editor-foot {
  padding: 14px 18px 18px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.spin {
  animation: spin 1s linear infinite;
}

.editor-fade-enter-active,
.editor-fade-leave-active {
  transition: opacity 0.18s ease;
}

.editor-fade-enter-from,
.editor-fade-leave-to {
  opacity: 0;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 980px) {
  .editor-shell {
    width: min(100vw, calc(100vw - 16px));
    max-height: calc(100vh - 16px);
  }
  .editor-body {
    grid-template-columns: 1fr;
  }
  .editor-sidebar {
    border-right: none;
    border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  }
  .stage-topbar {
    flex-direction: column;
    align-items: flex-start;
  }
  .stage-tip {
    text-align: left;
  }
}
</style>
