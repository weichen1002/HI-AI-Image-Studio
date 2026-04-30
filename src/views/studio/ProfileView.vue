<template>
  <div class="profile-page">
    <div class="profile-hero">
      <div class="profile-hero-top">
        <div class="profile-identity">
          <div class="profile-avatar">{{ initial }}</div>
          <div class="profile-identity-text">
            <div class="profile-name">{{ authStore.user?.username || '' }}</div>
            <div class="profile-sub">{{ authStore.user?.role || '' }}</div>
          </div>
        </div>
        <Button variant="ghost" @click="goBack">返回</Button>
      </div>

      <div class="profile-hero-bottom">
        <div class="profile-meta">
          <span class="meta-pill meta-primary">{{ (authStore.user?.plan || '').toUpperCase() }}</span>
          <span class="meta-pill">余额 {{ authStore.user?.creditBalance ?? 0 }}</span>
        </div>
        <div class="profile-hint">仅展示个人资料信息，不支持在此编辑。</div>
      </div>
    </div>

    <div class="profile-section">
      <div class="info-list">
        <div class="info-row">
          <div class="info-k">用户名</div>
          <div class="info-v">{{ authStore.user?.username || '' }}</div>
        </div>
        <div class="info-row">
          <div class="info-k">角色</div>
          <div class="info-v">{{ authStore.user?.role || '' }}</div>
        </div>
        <div class="info-row">
          <div class="info-k">套餐</div>
          <div class="info-v">{{ authStore.user?.plan || '' }}</div>
        </div>
        <div class="info-row">
          <div class="info-k">余额</div>
          <div class="info-v">{{ authStore.user?.creditBalance ?? '' }}</div>
        </div>
        <div class="info-row">
          <div class="info-k">用户 ID</div>
          <div class="info-v mono">
            <span class="mono-text">{{ authStore.user?.id || '' }}</span>
            <Button variant="ghost" size="xs" @click="copy(authStore.user?.id)">复制</Button>
          </div>
        </div>
        <div v-if="authStore.user?.createdAt" class="info-row">
          <div class="info-k">创建时间</div>
          <div class="info-v">{{ formatTime(authStore.user?.createdAt) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { Button, toastError, toastSuccess } from '../../components/common'

const router = useRouter()
const authStore = useAuthStore()

const initial = computed(() => {
  const name = String(authStore.user?.username || '').trim()
  return name ? name.charAt(0).toUpperCase() : 'U'
})

function goBack() {
  router.push('/studio')
}

function formatTime(val) {
  if (!val) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(val))
}

async function copy(text) {
  const value = String(text || '').trim()
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    toastSuccess('已复制')
  } catch {
    toastError('复制失败')
  }
}
</script>

<style scoped>
.profile-page {
  max-width: 1040px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.profile-hero {
  border-radius: calc(var(--radius-lg) + 6px);
  border: 1px solid rgba(255, 255, 255, 0.7);
  background:
    radial-gradient(1200px 420px at 10% 0%, rgba(99, 102, 241, 0.18), transparent 55%),
    radial-gradient(980px 420px at 92% 10%, rgba(236, 72, 153, 0.14), transparent 55%),
    rgba(255, 255, 255, 0.68);
  box-shadow: 0 18px 60px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(18px);
  overflow: hidden;
  padding: 18px 18px 16px;
}

.profile-hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.profile-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.profile-avatar {
  width: 46px;
  height: 46px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: var(--gradient-primary);
  color: #fff;
  font-weight: 950;
  font-size: 15px;
  box-shadow: 0 14px 34px rgba(99, 102, 241, 0.28);
}

.profile-identity-text {
  min-width: 0;
  min-width: 0;
}

.profile-name {
  font-size: 17px;
  font-weight: 950;
  color: var(--text);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-sub {
  margin-top: 4px;
  font-size: 11px;
  font-weight: 900;
  color: rgba(15, 23, 42, 0.58);
  letter-spacing: 0.10em;
  text-transform: uppercase;
}

.profile-hero-bottom {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.profile-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-pill {
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  font-weight: 950;
  color: rgba(15, 23, 42, 0.78);
}

.meta-primary {
  color: var(--primary);
  border-color: rgba(99, 102, 241, 0.22);
  background: var(--gradient-subtle);
}

.profile-hint {
  font-size: 11px;
  font-weight: 900;
  color: var(--muted);
}

.profile-section {
  border-radius: calc(var(--radius-lg) + 4px);
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 14px 44px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(18px);
  overflow: hidden;
}

.info-list {
  display: flex;
  flex-direction: column;
}

.info-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 16px;
  padding: 14px 16px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  align-items: center;
  transition: background 0.16s ease;
}

.info-row:first-child {
  border-top: none;
}

.info-row:hover {
  background: rgba(99, 102, 241, 0.04);
}

.info-k {
  font-size: 11px;
  font-weight: 900;
  color: var(--muted);
  letter-spacing: 0.10em;
  text-transform: uppercase;
}

.info-v {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  font-weight: 900;
  font-size: 13px;
  color: var(--text);
  word-break: break-word;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  color: var(--text);
}

.mono-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .profile-hero {
    padding: 16px 14px 14px;
  }
  .section-head {
    padding: 14px 14px 10px;
  }
  .info-row {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 12px 14px;
  }
  .info-v {
    justify-content: flex-start;
  }
}
</style>
