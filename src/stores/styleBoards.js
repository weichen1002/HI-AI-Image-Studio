import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiFetch } from '../utils/api'

function toStyleBoard(board = {}) {
  return {
    id: String(board.id || ''),
    name: String(board.name || ''),
    description: String(board.description || ''),
    refs: Array.isArray(board.refs)
      ? board.refs.map((ref) => ({
          id: String(ref.id || ''),
          boardId: String(ref.boardId || board.id || ''),
          imageId: String(ref.imageId || ''),
          imageUrl: String(ref.imageUrl || ''),
          note: String(ref.note || ''),
          createdAt: String(ref.createdAt || '')
        })).filter((ref) => ref.id && ref.imageUrl)
      : [],
    createdAt: String(board.createdAt || ''),
    updatedAt: String(board.updatedAt || '')
  }
}

export const useStyleBoardsStore = defineStore('styleBoards', () => {
  const boards = ref([])
  const loading = ref(false)

  function upsertBoard(board) {
    const next = toStyleBoard(board)
    if (!next.id) return null
    const index = boards.value.findIndex((item) => item.id === next.id)
    if (index >= 0) {
      boards.value.splice(index, 1, next)
    } else {
      boards.value.unshift(next)
    }
    return next
  }

  async function fetchBoards() {
    loading.value = true
    try {
      const data = await apiFetch('/api/style-boards', undefined, { toast: false })
      boards.value = Array.isArray(data?.boards) ? data.boards.map(toStyleBoard) : []
      return boards.value
    } finally {
      loading.value = false
    }
  }

  async function createBoard(payload = {}) {
    const data = await apiFetch('/api/style-boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    return upsertBoard(data?.board)
  }

  async function updateBoard(id, payload = {}) {
    const data = await apiFetch(`/api/style-boards/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    return upsertBoard(data?.board)
  }

  async function deleteBoard(id) {
    await apiFetch(`/api/style-boards/${encodeURIComponent(id)}`, { method: 'DELETE' })
    boards.value = boards.value.filter((board) => board.id !== id)
  }

  async function addRefFromImage(boardId, imageId, note = '') {
    const data = await apiFetch(`/api/style-boards/${encodeURIComponent(boardId)}/refs/from-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageId, note })
    })
    return upsertBoard(data?.board)
  }

  async function addRef(boardId, payload = {}) {
    const data = await apiFetch(`/api/style-boards/${encodeURIComponent(boardId)}/refs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    return upsertBoard(data?.board)
  }

  async function deleteRef(boardId, refId) {
    const data = await apiFetch(`/api/style-boards/${encodeURIComponent(boardId)}/refs/${encodeURIComponent(refId)}`, {
      method: 'DELETE'
    })
    return upsertBoard(data?.board)
  }

  return {
    boards,
    loading,
    fetchBoards,
    createBoard,
    updateBoard,
    deleteBoard,
    addRefFromImage,
    addRef,
    deleteRef
  }
})
