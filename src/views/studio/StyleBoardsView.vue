<template>
  <div class="style-page">
    <section class="style-head">
      <div class="style-sub">保存项目参考图和风格描述，创作时手动选择后才会参与本次生成。</div>
      <div class="style-actions">
        <Button variant="ghost" :disabled="store.loading" @click="reload">刷新</Button>
        <Button @click="openCreate">新建风格板</Button>
      </div>
    </section>

    <div v-if="store.loading" class="state-card">加载风格板中...</div>
    <div v-else-if="!store.boards.length" class="empty-card">
      <div class="empty-hero">
        <PanelsTopLeftIcon :size="42" />
        <div>
          <div class="empty-title">先建一个可复用的风格板</div>
          <div class="empty-sub">把本地参考图、历史作品或在线图片收进来，之后在创作时按需带入。</div>
        </div>
      </div>
      <div class="empty-actions">
        <button type="button" class="empty-action-card primary" :disabled="saving" @click="startFirstBoard('upload')">
          <ImageUpIcon :size="20" />
          <span>上传本地参考图</span>
        </button>
        <button type="button" class="empty-action-card" :disabled="saving" @click="startFirstBoard('history')">
          <HistoryIcon :size="20" />
          <span>从历史作品选择</span>
        </button>
        <button type="button" class="empty-action-card" :disabled="saving" @click="openCreate">
          <PlusIcon :size="20" />
          <span>创建第一个风格板</span>
        </button>
      </div>
    </div>

    <div v-else class="board-grid">
      <article v-for="board in store.boards" :key="board.id" class="board-card">
        <div class="board-top">
          <div class="board-title">
            <div class="board-name">{{ board.name }}</div>
            <div class="board-count">{{ board.refs.length }} 张参考</div>
          </div>
          <div class="board-tools" aria-label="风格板操作">
            <button type="button" class="icon-action" title="编辑风格板" @click="openEdit(board)">
              <PencilIcon :size="15" />
            </button>
            <button type="button" class="icon-action danger" title="删除风格板" @click="deleteBoard(board)">
              <Trash2Icon :size="15" />
            </button>
          </div>
        </div>
        <p class="board-desc">{{ board.description || '暂无描述' }}</p>

        <div class="ref-grid" :class="{ empty: !board.refs.length }">
          <div v-for="ref in board.refs.slice(0, 6)" :key="ref.id" class="ref-thumb">
            <img :src="ref.imageUrl" :alt="ref.note || board.name" loading="lazy" />
            <button type="button" class="ref-delete" title="移除参考图" @click="deleteRef(board, ref)">
              <XIcon :size="13" />
            </button>
          </div>
          <div v-if="!board.refs.length" class="ref-empty">还没有参考图</div>
        </div>

        <div class="board-footer">
          <Button size="sm" @click="openAddRef(board)">
            <template #icon><PlusIcon :size="15" /></template>
            添加参考
          </Button>
        </div>
      </article>
    </div>

    <Modal v-model:open="boardModalOpen" :title="editingBoard?.id ? '编辑风格板' : '新建风格板'" size="md">
      <div class="form-stack">
        <label class="field">
          <span>名称</span>
          <Input v-model="boardForm.name" placeholder="例如：新品电商冷白光" />
        </label>
        <label class="field">
          <span>风格描述</span>
          <textarea v-model="boardForm.description" class="textarea" placeholder="描述画面风格、构图、色彩、光线、材质等。"></textarea>
        </label>
      </div>
      <template #footer>
        <div class="modal-actions">
          <Button variant="ghost" @click="boardModalOpen = false">取消</Button>
          <Button :disabled="saving" @click="saveBoard">{{ saving ? '保存中...' : '保存' }}</Button>
        </div>
      </template>
    </Modal>

    <Modal v-model:open="refModalOpen" :title="refModalTitle" size="lg">
      <div class="ref-source-tabs" role="tablist" aria-label="参考图来源">
        <button
          v-for="source in refSources"
          :key="source.value"
          type="button"
          class="ref-source-tab"
          :class="{ active: refSource === source.value }"
          @click="selectRefSource(source.value)"
        >
          <component :is="source.icon" :size="15" />
          <span>{{ source.label }}</span>
        </button>
      </div>

      <div v-if="refSource === 'upload'" class="form-stack">
        <ImageUpload v-model="refFile" />
        <label class="field">
          <span>备注</span>
          <Input v-model="refForm.note" placeholder="例如：光影、构图、材质参考" />
        </label>
      </div>

      <div v-else-if="refSource === 'history'" class="history-picker">
        <div class="history-picker-toolbar">
          <Input v-model="historyQuery" placeholder="搜索提示词" size="sm" @keydown.enter.prevent="loadHistoryImages" />
          <Button variant="ghost" size="sm" :disabled="imagesStore.isLoading" @click="loadHistoryImages">
            {{ imagesStore.isLoading ? '加载中...' : '搜索' }}
          </Button>
        </div>
        <div v-if="imagesStore.isLoading" class="history-picker-state">加载历史作品中...</div>
        <div v-else-if="!historyCandidates.length" class="history-picker-state">暂无可加入的历史作品</div>
        <div v-else class="history-picker-grid">
          <button
            v-for="image in historyCandidates"
            :key="image.id"
            type="button"
            class="history-pick-card"
            :disabled="saving"
            @click="addHistoryImageToBoard(image)"
          >
            <img :src="historyImageUrl(image)" :alt="image.prompt || '历史作品'" loading="lazy" />
            <span>{{ image.prompt || '无提示词' }}</span>
          </button>
        </div>
      </div>

      <div v-else class="form-stack">
        <label class="field">
          <span>图片地址</span>
          <Input v-model="refForm.imageUrl" placeholder="https://... 或 /uploads/..." />
        </label>
        <label class="field">
          <span>备注</span>
          <Input v-model="refForm.note" placeholder="例如：光影、构图、材质参考" />
        </label>
      </div>

      <template #footer>
        <div class="modal-actions">
          <Button variant="ghost" @click="refModalOpen = false">取消</Button>
          <Button v-if="refSource !== 'history'" :disabled="saving || !canSaveRef" @click="saveRef">
            {{ saving ? '添加中...' : '添加' }}
          </Button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { HistoryIcon, ImageUpIcon, LinkIcon, PanelsTopLeftIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-vue-next'
import ImageUpload from '../../components/ImageUpload.vue'
import { useImagesStore } from '../../stores/images'
import { useStyleBoardsStore } from '../../stores/styleBoards'
import { Button, Input, Modal, confirmDanger, toastError, toastSuccess } from '../../components/common'

const store = useStyleBoardsStore()
const imagesStore = useImagesStore()
const boardModalOpen = ref(false)
const refModalOpen = ref(false)
const saving = ref(false)
const editingBoard = ref(null)
const refBoard = ref(null)
const historyQuery = ref('')
const refSource = ref('upload')
const refFile = ref(null)
const boardForm = reactive({
  name: '',
  description: ''
})
const refForm = reactive({
  imageUrl: '',
  note: ''
})
const refSources = [
  { value: 'upload', label: '本地上传', icon: ImageUpIcon },
  { value: 'history', label: '历史作品', icon: HistoryIcon },
  { value: 'url', label: '图片地址', icon: LinkIcon }
]
const refModalTitle = computed(() => {
  return refBoard.value?.name ? `添加参考 · ${refBoard.value.name}` : '添加参考'
})
const historyCandidates = computed(() => {
  return (imagesStore.images || []).filter((image) => historyImageUrl(image))
})
const canSaveRef = computed(() => {
  if (refSource.value === 'upload') return refFile.value instanceof File
  if (refSource.value === 'url') return Boolean(refForm.imageUrl.trim())
  return false
})

function resetBoardForm(board = null) {
  editingBoard.value = board
  boardForm.name = board?.name || ''
  boardForm.description = board?.description || ''
}

function openCreate() {
  resetBoardForm(null)
  boardModalOpen.value = true
}

function openEdit(board) {
  resetBoardForm(board)
  boardModalOpen.value = true
}

function openAddRef(board) {
  refBoard.value = board
  refForm.imageUrl = ''
  refForm.note = ''
  refFile.value = null
  refSource.value = 'upload'
  refModalOpen.value = true
}

async function selectRefSource(source) {
  refSource.value = source
  if (source === 'history' && !imagesStore.images.length) {
    await loadHistoryImages()
  }
}

async function startFirstBoard(source) {
  saving.value = true
  try {
    const board = await store.createBoard({
      name: source === 'history' ? '历史作品参考' : '本地参考图',
      description: '用于沉淀项目风格、构图、色彩、光影和材质参考。'
    })
    if (board?.id) {
      openAddRef(board)
      await selectRefSource(source)
    }
    toastSuccess('已创建风格板')
  } catch (error) {
    toastError(error.message || '创建失败')
  } finally {
    saving.value = false
  }
}

async function reload() {
  await store.fetchBoards()
}

async function loadHistoryImages() {
  await imagesStore.fetchImages({
    limit: 24,
    offset: 0,
    q: historyQuery.value,
    mode: 'all'
  })
}

async function saveBoard() {
  saving.value = true
  try {
    if (editingBoard.value?.id) {
      await store.updateBoard(editingBoard.value.id, boardForm)
      toastSuccess('已更新风格板')
    } else {
      await store.createBoard(boardForm)
      toastSuccess('已创建风格板')
    }
    boardModalOpen.value = false
  } catch (error) {
    toastError(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function saveRef() {
  if (!refBoard.value?.id) return
  saving.value = true
  try {
    const imageUrl = refSource.value === 'upload' ? await fileToStyleRefDataUrl(refFile.value) : refForm.imageUrl.trim()
    await store.addRef(refBoard.value.id, {
      imageUrl,
      note: refForm.note
    })
    toastSuccess('已添加参考图')
    refModalOpen.value = false
  } catch (error) {
    toastError(error.message || '添加失败')
  } finally {
    saving.value = false
  }
}

async function deleteRef(board, ref) {
  const ok = await confirmDanger({
    title: '移除参考图',
    objectName: ref.note || board.name,
    message: '确定从风格板中移除这张参考图吗？',
    details: '只会移除风格板引用，不会删除原始历史作品。',
    confirmText: '移除'
  })
  if (!ok) return
  await store.deleteRef(board.id, ref.id)
  toastSuccess('已移除参考图')
}

async function deleteBoard(board) {
  const ok = await confirmDanger({
    title: '删除风格板',
    objectName: board.name,
    message: '确定删除这个风格板吗？',
    details: `${board.refs.length} 张参考图引用会被移除，但不会删除历史作品。`,
    confirmText: '删除'
  })
  if (!ok) return
  await store.deleteBoard(board.id)
  toastSuccess('已删除风格板')
}

function historyImageUrl(image) {
  return image?.imageUrls?.[0] || image?.previewImageUrls?.[0] || ''
}

async function addHistoryImageToBoard(image) {
  if (!refBoard.value?.id || !image?.id) return
  saving.value = true
  try {
    await store.addRefFromImage(refBoard.value.id, image.id, image.prompt || '')
    toastSuccess('已加入风格板')
  } catch (error) {
    toastError(error?.message || '加入失败')
  } finally {
    saving.value = false
  }
}

function fileToStyleRefDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof File)) {
      reject(new Error('请选择一张本地图片'))
      return
    }
    if (!file.type.startsWith('image/')) {
      reject(new Error('请选择图片文件'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '')
      if (rawDataUrl.length <= 1_800_000) {
        resolve(rawDataUrl)
        return
      }
      compressImageDataUrl(rawDataUrl).then(resolve).catch(reject)
    }
    reader.onerror = () => reject(new Error('读取本地图片失败'))
    reader.readAsDataURL(file)
  })
}

function compressImageDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const maxSide = 1600
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
      const width = Math.max(1, Math.round(image.naturalWidth * scale))
      const height = Math.max(1, Math.round(image.naturalHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('无法处理这张图片'))
        return
      }
      context.drawImage(image, 0, 0, width, height)
      const qualities = [0.86, 0.74, 0.62, 0.5]
      for (const quality of qualities) {
        const compressed = canvas.toDataURL('image/jpeg', quality)
        if (compressed.length <= 1_800_000) {
          resolve(compressed)
          return
        }
      }
      reject(new Error('图片过大，请换一张较小的参考图'))
    }
    image.onerror = () => reject(new Error('无法读取这张图片'))
    image.src = dataUrl
  })
}

onMounted(() => {
  void reload()
})
</script>

<style scoped>
.style-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.style-head,
.board-footer,
.board-top,
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.style-head {
  min-height: 72px;
  padding: 14px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.09), rgba(255, 255, 255, 0.72) 48%),
    rgba(255, 255, 255, 0.76);
  box-shadow: 0 12px 34px rgba(15, 23, 42, 0.05);
  backdrop-filter: blur(18px);
}

.style-sub,
.board-desc {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
  font-weight: 700;
}

.style-actions {
  display: flex;
  gap: 8px;
  flex: 0 0 auto;
}

.state-card,
.empty-card {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.76);
  color: var(--muted);
  text-align: center;
}

.empty-card {
  align-items: stretch;
}

.empty-hero {
  display: grid;
  justify-items: center;
  gap: 10px;
}

.empty-title {
  color: var(--text);
  font-weight: 900;
}

.empty-sub {
  max-width: 560px;
  margin-top: 6px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
  font-weight: 750;
}

.empty-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  width: min(760px, 100%);
  margin: 8px auto 0;
}

.empty-action-card {
  min-width: 0;
  min-height: 96px;
  display: grid;
  place-items: center;
  gap: 8px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.78);
  color: rgba(15, 23, 42, 0.72);
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  transition: transform 0.2s, border-color 0.2s, background 0.2s, color 0.2s, box-shadow 0.2s;
}

.empty-action-card:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(37, 99, 235, 0.24);
  background: rgba(255, 255, 255, 0.92);
  color: var(--primary);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
}

.empty-action-card.primary {
  border-color: rgba(37, 99, 235, 0.22);
  background: rgba(37, 99, 235, 0.08);
  color: var(--primary);
}

.empty-action-card:disabled {
  cursor: wait;
  opacity: 0.65;
}

.board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.board-card {
  min-width: 0;
  padding: 14px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
}

.board-top {
  align-items: flex-start;
}

.board-title {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.board-name {
  min-width: 0;
  color: var(--text);
  font-size: 15px;
  font-weight: 950;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.board-count {
  flex: 0 0 auto;
  color: var(--primary);
  font-size: 12px;
  font-weight: 900;
}

.board-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.icon-action {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.78);
  color: rgba(15, 23, 42, 0.62);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s, transform 0.2s;
}

.icon-action:hover {
  border-color: rgba(37, 99, 235, 0.24);
  background: rgba(37, 99, 235, 0.07);
  color: var(--primary);
  transform: translateY(-1px);
}

.icon-action.danger:hover {
  border-color: rgba(220, 38, 38, 0.22);
  background: rgba(220, 38, 38, 0.07);
  color: #dc2626;
}

.ref-grid {
  min-height: 150px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
  margin: 12px 0;
}

.ref-grid.empty {
  grid-template-columns: 1fr;
}

.ref-thumb {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.05);
}

.ref-thumb img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  display: block;
}

.ref-delete {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.68);
  color: #ffffff;
  cursor: pointer;
}

.ref-empty {
  display: grid;
  place-items: center;
  border: 1px dashed rgba(15, 23, 42, 0.16);
  border-radius: 12px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
}

.board-footer {
  justify-content: stretch;
}

.board-footer :deep(.btn) {
  width: 100%;
}

.form-stack {
  display: grid;
  gap: 12px;
}

.ref-source-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 14px;
  padding: 4px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.74);
}

.ref-source-tab {
  min-width: 0;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: rgba(15, 23, 42, 0.58);
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.ref-source-tab.active {
  background: #ffffff;
  color: var(--primary);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.07);
}

.history-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-picker-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.history-picker-state {
  min-height: 180px;
  display: grid;
  place-items: center;
  color: var(--muted);
  font-size: 13px;
  font-weight: 850;
}

.history-picker-grid {
  max-height: min(520px, 58vh);
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  padding-right: 4px;
}

.history-pick-card {
  min-width: 0;
  display: grid;
  gap: 8px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.82);
  padding: 8px;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.history-pick-card:hover:not(:disabled) {
  border-color: rgba(37, 99, 235, 0.28);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}

.history-pick-card:disabled {
  cursor: wait;
  opacity: 0.7;
}

.history-pick-card img {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  object-fit: cover;
  background: rgba(15, 23, 42, 0.05);
}

.history-pick-card span {
  min-height: 34px;
  color: rgba(15, 23, 42, 0.78);
  font-size: 12px;
  line-height: 1.4;
  font-weight: 800;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.field {
  display: grid;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
}

.textarea {
  min-height: 140px;
  resize: vertical;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(248, 250, 252, 0.78);
  color: var(--text);
  padding: 10px 11px;
  font: inherit;
  font-size: 13px;
  line-height: 1.55;
  outline: none;
}

@media (max-width: 680px) {
  .style-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .ref-source-tabs {
    grid-template-columns: 1fr;
  }

  .empty-actions {
    grid-template-columns: 1fr;
  }
}
</style>
