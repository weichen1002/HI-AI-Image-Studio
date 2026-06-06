<template>
  <TablePageLayout title="" subtitle="" density="compact" variant="plain">
    <div class="ops-shell">
      <section class="ops-hero">
        <div>
          <div class="ops-kicker">运营中心</div>
          <h2>把一次运营动作从计划到复盘串起来</h2>
          <p>先建一个运营活动说明“为什么做、给谁看、用什么工具做”，再去配置公告、兑换码或反馈样本。这样后面复盘时不会只剩一堆零散记录。</p>
        </div>
        <div class="ops-hero-mark">
          <TargetIcon :size="30" />
        </div>
      </section>

      <section class="ops-overview">
        <div class="ops-section-head">
          <ChartNoAxesCombinedIcon :size="18" />
          <span>当前运营状态</span>
        </div>
        <div v-if="summaryError" class="ops-error">{{ summaryError }}</div>
        <div class="overview-grid" :class="{ loading: summaryLoading }">
          <div v-for="item in overviewItems" :key="item.label" class="overview-card">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <small>{{ item.sub }}</small>
          </div>
        </div>
      </section>

      <section class="ops-guide">
        <div class="ops-section-head">
          <ListChecksIcon :size="18" />
          <span>常见运营动作怎么落地</span>
        </div>
        <div class="scenario-grid">
          <div v-for="item in scenarios" :key="item.title" class="scenario-card">
            <div class="scenario-top">
              <span class="scenario-icon">
                <component :is="item.icon" :size="18" />
              </span>
              <strong>{{ item.title }}</strong>
            </div>
            <p>{{ item.desc }}</p>
            <div class="scenario-flow">
              <span v-for="step in item.steps" :key="step">{{ step }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="ops-tools">
        <div class="ops-section-head">
          <MousePointerClickIcon :size="18" />
          <span>运营工具入口</span>
        </div>
        <div class="ops-grid">
          <router-link
            v-for="item in operationCards"
            :key="item.to"
            class="ops-card"
            :to="item.to"
          >
            <span class="ops-card-icon">
              <component :is="item.icon" :size="20" />
            </span>
            <span class="ops-card-copy">
              <strong>{{ item.title }}</strong>
              <span>{{ item.desc }}</span>
            </span>
            <ArrowRightIcon :size="18" class="ops-card-arrow" />
          </router-link>
        </div>
      </section>

      <section class="ops-plan">
        <div class="ops-section-head">
          <ChartNoAxesCombinedIcon :size="18" />
          <span>运营能力模块</span>
        </div>
        <div class="ops-plan-list">
          <div v-for="item in capabilityItems" :key="item.title" class="ops-plan-item">
            <strong>{{ item.title }}</strong>
            <span>{{ item.desc }}</span>
            <small>{{ item.meta }}</small>
          </div>
        </div>
      </section>
    </div>
  </TablePageLayout>
</template>

<script setup>
import {
  ArrowRightIcon,
  ChartNoAxesCombinedIcon,
  GiftIcon,
  ImageIcon,
  ListChecksIcon,
  MegaphoneIcon,
  MousePointerClickIcon,
  RocketIcon,
  TargetIcon
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { TablePageLayout } from '../../../components/layout'
import { apiFetch } from '../../../utils/api'

const summary = ref(null)
const summaryLoading = ref(false)
const summaryError = ref('')
const segments = ref([])

const overviewItems = computed(() => {
  const data = summary.value || {}
  return [
    {
      label: '进行中的运营活动',
      value: data.campaigns?.active || 0,
      sub: `草稿 ${data.campaigns?.draft || 0} / 已归档 ${data.campaigns?.archived || 0}`
    },
    {
      label: '展示中的公告',
      value: data.announcements?.published || 0,
      sub: `草稿 ${data.announcements?.draft || 0} / 已下线 ${data.announcements?.archived || 0}`
    },
    {
      label: '可用兑换码',
      value: data.redeemCodes?.active || 0,
      sub: `停用 ${data.redeemCodes?.disabled || 0} / 已领完 ${data.redeemCodes?.exhausted || 0}`
    },
    {
      label: '待处理反馈',
      value: data.feedback?.needsReview || 0,
      sub: `累计反馈 ${data.feedback?.total || 0}`
    }
  ]
})

const touch = computed(() => summary.value?.touch || {})

const capabilityItems = computed(() => [
  {
    title: '活动复盘',
    desc: '进入运营活动列表，点击“复盘”即可集中看关联对象、活动时间窗内生成量和反馈量。',
    meta: `当前进行中 ${summary.value?.campaigns?.active || 0} 个，草稿 ${summary.value?.campaigns?.draft || 0} 个`
  },
  {
    title: '触达统计',
    desc: '汇总公告展示中数量、公告已读、兑换码领取和后续生成任务。',
    meta: `公告已读 ${touch.value.announcements?.reads || 0}，兑换 ${touch.value.redeemCodes?.redeemed || 0} 次，成功生成 ${touch.value.generation?.succeededJobs || 0} 次`
  },
  {
    title: '用户分群',
    desc: '提供新用户、沉默用户、付费用户、活跃用户的命中人数，可在运营活动里一键带入。',
    meta: segments.value.length
      ? segments.value.map((item) => `${item.name} ${item.matchedUsers}`).join(' / ')
      : '加载后显示各分群命中人数'
  }
])

async function loadSummary() {
  summaryError.value = ''
  try {
    summaryLoading.value = true
    summary.value = await apiFetch('/api/admin/operations/campaigns/summary', undefined, { toast: false })
    const data = await apiFetch('/api/admin/operations/campaigns/segments', undefined, { toast: false })
    segments.value = data?.segments || []
  } catch (e) {
    summaryError.value = e.message || '运营汇总加载失败'
  } finally {
    summaryLoading.value = false
  }
}

onMounted(loadSummary)

const operationCards = [
  {
    title: '运营活动',
    desc: '记录一次活动为什么做、给谁做、用什么工具做。',
    to: '/studio/admin/operation-campaigns',
    icon: RocketIcon
  },
  {
    title: '公告投放',
    desc: '管理公告、弹窗触达和必读提示。',
    to: '/studio/admin/announcements',
    icon: MegaphoneIcon
  },
  {
    title: '兑换码',
    desc: '创建活动码、单次码，承接拉新和补偿。',
    to: '/studio/admin/redeem-codes',
    icon: GiftIcon
  },
  {
    title: '反馈样本',
    desc: '查看低分反馈，反推模型、提示词和运营策略。',
    to: '/studio/admin/image-feedback',
    icon: ImageIcon
  }
]

const scenarios = [
  {
    title: '想通知用户一件事',
    desc: '比如版本更新、功能上线、重要维护。',
    steps: ['建运营活动', '配置公告投放', '上线后归档复盘'],
    icon: MegaphoneIcon
  },
  {
    title: '想做拉新或补偿',
    desc: '比如注册送额外余额、节日活动码、客服补偿。',
    steps: ['建运营活动', '创建兑换码', '看兑换记录'],
    icon: GiftIcon
  },
  {
    title: '想优化生成质量',
    desc: '比如收集差评样本、定位提示词或模型问题。',
    steps: ['看反馈样本', '归类问题', '沉淀优化动作'],
    icon: ImageIcon
  }
]

</script>

<style scoped>
.ops-shell {
  display: grid;
  gap: 14px;
  min-height: 0;
}

.ops-hero,
.ops-guide,
.ops-overview,
.ops-tools,
.ops-card,
.ops-plan {
  border: 1px solid rgba(15, 23, 42, 0.07);
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.045);
  backdrop-filter: blur(18px);
}

.ops-hero {
  min-height: 154px;
  padding: 22px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  overflow: hidden;
}

.ops-kicker {
  margin-bottom: 8px;
  color: var(--primary);
  font-size: 12px;
  font-weight: 950;
}

.ops-hero h2 {
  margin: 0;
  color: var(--text);
  font-size: 24px;
  font-weight: 950;
  letter-spacing: 0;
  line-height: 1.2;
}

.ops-hero p {
  max-width: 640px;
  margin: 9px 0 0;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.65;
}

.ops-hero-mark {
  flex: none;
  width: 76px;
  height: 76px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(37, 99, 235, 0.14);
  border-radius: 20px;
  color: var(--primary);
  background: rgba(37, 99, 235, 0.08);
}

.ops-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.ops-guide,
.ops-overview,
.ops-tools {
  padding: 16px;
  border-radius: 16px;
}

.ops-section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-size: 14px;
  font-weight: 950;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.overview-grid.loading {
  opacity: 0.7;
}

.overview-card {
  min-width: 0;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(248, 250, 252, 0.78);
  display: grid;
  gap: 5px;
}

.overview-card span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
}

.overview-card strong {
  color: var(--text);
  font-size: 26px;
  font-weight: 950;
  line-height: 1.1;
}

.overview-card small {
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
}

.ops-error {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(220, 38, 38, 0.16);
  background: rgba(220, 38, 38, 0.06);
  color: var(--accent);
  font-size: 12px;
  font-weight: 850;
}

.scenario-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.scenario-card {
  min-width: 0;
  padding: 13px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(248, 250, 252, 0.78);
}

.scenario-top {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--text);
  font-size: 13px;
  font-weight: 950;
}

.scenario-icon {
  width: 32px;
  height: 32px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  color: var(--primary);
  background: rgba(37, 99, 235, 0.08);
  flex: none;
}

.scenario-card p {
  margin: 9px 0 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
  line-height: 1.55;
}

.scenario-flow {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.scenario-flow span {
  padding: 5px 8px;
  border-radius: 9px;
  color: rgba(29, 78, 216, 1);
  background: rgba(37, 99, 235, 0.08);
  font-size: 11px;
  font-weight: 900;
}

.ops-card {
  min-height: 116px;
  padding: 15px;
  border-radius: 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: inherit;
  text-decoration: none;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.ops-card:hover {
  transform: translateY(-2px);
  border-color: rgba(37, 99, 235, 0.22);
  box-shadow: 0 14px 32px rgba(37, 99, 235, 0.08);
}

.ops-card-icon {
  flex: none;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  color: var(--primary);
  background: rgba(37, 99, 235, 0.08);
}

.ops-card-copy {
  min-width: 0;
  display: grid;
  gap: 6px;
  flex: 1;
}

.ops-card-copy strong {
  color: var(--text);
  font-size: 15px;
  font-weight: 950;
}

.ops-card-copy span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.55;
}

.ops-card-arrow {
  flex: none;
  margin-top: 2px;
  color: rgba(100, 116, 139, 0.78);
}

.ops-plan {
  padding: 16px;
  border-radius: 16px;
}

.ops-plan-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.ops-plan-item {
  display: grid;
  gap: 5px;
  padding: 12px;
  border-radius: 13px;
  background: rgba(248, 250, 252, 0.82);
}

.ops-plan-item strong {
  color: var(--text);
  font-size: 13px;
  font-weight: 950;
}

.ops-plan-item span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.55;
}

.ops-plan-item small {
  color: rgba(29, 78, 216, 1);
  font-size: 11px;
  font-weight: 900;
  line-height: 1.5;
}

@media (max-width: 980px) {
  .ops-grid,
  .overview-grid,
  .scenario-grid,
  .ops-plan-list {
    grid-template-columns: 1fr;
  }

  .ops-hero {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
