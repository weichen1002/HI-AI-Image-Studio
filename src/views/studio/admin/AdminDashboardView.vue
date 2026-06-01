<template>
  <TablePageLayout title="" subtitle="" density="compact" variant="plain">
    <div class="dashboard-shell">
      <div class="dashboard-toolbar">
        <div>
          <div class="dashboard-kicker">{{ currentRangeLabel }} 运营快照</div>
          <div class="dashboard-title">指标总览</div>
        </div>
        <div class="toolbar-actions">
          <div class="range-tabs" aria-label="统计范围">
            <button
              v-for="item in rangeOptions"
              :key="item.value"
              type="button"
              class="range-tab"
              :class="{ active: range === item.value }"
              @click="setRange(item.value)"
            >
              {{ item.label }}
            </button>
          </div>
          <Button variant="ghost" size="sm" :disabled="loading" @click="load">
            <template #icon><RefreshCcwIcon :size="16" /></template>
            刷新
          </Button>
        </div>
      </div>

      <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

      <div class="metric-grid">
        <article v-for="item in metricCards" :key="item.key" class="metric-card" :class="`metric-${item.tone}`">
          <div class="metric-head">
            <span class="metric-icon"><component :is="item.icon" :size="18" aria-hidden="true" /></span>
            <span class="metric-badge">{{ item.badge }}</span>
          </div>
          <div class="metric-label">{{ item.label }}</div>
          <div class="metric-value">{{ item.value }}</div>
          <div class="metric-sub">{{ item.sub }}</div>
        </article>
      </div>

      <div class="insight-grid">
        <section class="panel panel-job-health">
          <div class="panel-head">
            <div>
              <div class="panel-title">任务健康度</div>
              <div class="panel-sub">生成任务的成功、失败和排队/运行占比 · {{ jobHealthText }}</div>
            </div>
            <div class="score-pill" :class="successTone">{{ dashboard.jobs.successRate }}%</div>
          </div>
          <div class="chart-layout">
            <div ref="jobChartEl" class="chart-box chart-donut" role="img" aria-label="任务状态分布"></div>
            <div class="legend-list">
              <div v-for="item in jobSegments" :key="item.key" class="legend-row">
                <span class="legend-dot" :style="{ background: item.color }"></span>
                <span>{{ item.label }}</span>
                <strong>{{ formatNumber(item.value) }}</strong>
                <em>{{ item.percent }}%</em>
              </div>
            </div>
          </div>
        </section>

        <section class="panel panel-order-health">
          <div class="panel-head">
            <div>
              <div class="panel-title">订单转化</div>
              <div class="panel-sub">支付率、待支付和退款结构</div>
            </div>
            <div class="score-pill score-money">{{ dashboard.orders.payRate }}%</div>
          </div>
          <div ref="orderChartEl" class="chart-box chart-order" role="img" aria-label="订单状态结构"></div>
          <div class="order-stats">
            <div v-for="item in orderStats" :key="item.key" class="order-stat">
              <span class="order-icon"><component :is="item.icon" :size="16" aria-hidden="true" /></span>
              <div>
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="panel-grid">
        <section class="panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">失败原因排行</div>
              <div class="panel-sub">来自生成任务失败信息</div>
            </div>
          </div>
          <div v-if="failureReasonRows.length" ref="failureChartEl" class="chart-box chart-rank" role="img" aria-label="失败原因排行"></div>
          <div v-else class="empty">当前范围暂无失败任务</div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">反馈问题排行</div>
              <div class="panel-sub">来自点踩、问题类型和备注</div>
            </div>
          </div>
          <div v-if="feedbackReasonRows.length" ref="feedbackChartEl" class="chart-box chart-rank" role="img" aria-label="反馈问题排行"></div>
          <div v-else class="empty">当前范围暂无低分反馈</div>
        </section>
      </div>
    </div>
  </TablePageLayout>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import {
  CheckCircleIcon,
  ClockIcon,
  CoinsIcon,
  CreditCardIcon,
  ImageIcon,
  ReceiptTextIcon,
  RefreshCcwIcon,
  UsersIcon,
  WalletIcon
} from 'lucide-vue-next'
import { Button } from '../../../components/common'
import { TablePageLayout } from '../../../components/layout'
import { apiFetch } from '../../../utils/api'

echarts.use([BarChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const rangeOptions = [
  { label: '24 小时', value: '24h' },
  { label: '7 天', value: '7d' },
  { label: '30 天', value: '30d' }
]

const dashboard = ref(normalizeDashboard())
const range = ref('7d')
const loading = ref(false)
const errorMsg = ref('')
const jobChartEl = ref(null)
const orderChartEl = ref(null)
const failureChartEl = ref(null)
const feedbackChartEl = ref(null)
let jobChart
let orderChart
let failureChart
let feedbackChart

const currentRangeLabel = computed(() => rangeOptions.find((item) => item.value === range.value)?.label || '当前')

const metricCards = computed(() => [
  {
    key: 'dau',
    label: range.value === '24h' ? '活跃用户' : '范围活跃',
    value: formatNumber(dashboard.value.users.activeInRange),
    sub: `总用户 ${formatNumber(dashboard.value.users.total)} · 新增 ${formatNumber(dashboard.value.users.newInRange)}`,
    badge: '用户',
    tone: 'blue',
    icon: UsersIcon
  },
  {
    key: 'jobs',
    label: '生成任务',
    value: formatNumber(dashboard.value.jobs.total),
    sub: `成功 ${formatNumber(dashboard.value.jobs.succeeded)} · 失败 ${formatNumber(dashboard.value.jobs.failed)}`,
    badge: `${dashboard.value.jobs.successRate}% 成功`,
    tone: 'green',
    icon: ImageIcon
  },
  {
    key: 'credits',
    label: '积分消耗',
    value: formatNumber(dashboard.value.credits.consumed),
    sub: `发放 ${formatNumber(dashboard.value.credits.credited)} · 流水 ${formatNumber(dashboard.value.credits.ledgerCount)}`,
    badge: '积分',
    tone: 'amber',
    icon: CoinsIcon
  },
  {
    key: 'revenue',
    label: '订单收入',
    value: formatCurrency(dashboard.value.orders.revenueCents),
    sub: `已支付 ${formatNumber(dashboard.value.orders.paid)} · 支付率 ${dashboard.value.orders.payRate}%`,
    badge: '商业化',
    tone: 'rose',
    icon: ReceiptTextIcon
  }
])

const jobSegments = computed(() => percentageRows([
  { key: 'succeeded', label: '成功', value: dashboard.value.jobs.succeeded, color: '#16a34a' },
  { key: 'failed', label: '失败', value: dashboard.value.jobs.failed, color: '#e11d48' },
  { key: 'active', label: '排队/运行', value: dashboard.value.jobs.active, color: '#f59e0b' }
]))

const successTone = computed(() => {
  const rate = Number(dashboard.value.jobs.successRate || 0)
  if (rate >= 90) return 'score-good'
  if (rate >= 70) return 'score-warn'
  return 'score-risk'
})

const jobHealthText = computed(() => {
  const rate = Number(dashboard.value.jobs.successRate || 0)
  if (rate >= 90) return '运行健康'
  if (rate >= 70) return '需要关注'
  return '优先排查'
})

const orderSegments = computed(() => percentageRows([
  { key: 'paid', label: '已支付', value: dashboard.value.orders.paid },
  { key: 'pending', label: '待支付', value: dashboard.value.orders.pending },
  { key: 'refunded', label: '已退款', value: dashboard.value.orders.refunded }
]))

const orderStats = computed(() => [
  { key: 'total', label: '订单总数', value: formatNumber(dashboard.value.orders.total), icon: CreditCardIcon },
  { key: 'paid', label: '已支付', value: formatNumber(dashboard.value.orders.paid), icon: CheckCircleIcon },
  { key: 'pending', label: '待支付', value: formatNumber(dashboard.value.orders.pending), icon: ClockIcon },
  { key: 'refunded', label: '已退款', value: formatNumber(dashboard.value.orders.refunded), icon: WalletIcon }
])

const failureReasonRows = computed(() => rankRows(dashboard.value.failureReasons))
const feedbackReasonRows = computed(() => rankRows(dashboard.value.feedbackReasons))

function percentageRows(rows) {
  const total = rows.reduce((sum, item) => sum + Number(item.value || 0), 0)
  if (!total) {
    return rows.map((item) => ({
      ...item,
      percent: 0
    }))
  }

  return rows.map((item) => ({
    ...item,
    percent: clampPercent((Number(item.value || 0) / total) * 100)
  }))
}

function rankRows(rows) {
  const safeRows = Array.isArray(rows) ? rows : []
  const max = Math.max(1, ...safeRows.map((item) => Number(item.count || 0)))
  return safeRows.slice(0, 5).map((item) => ({
    ...item,
    count: Number(item.count || 0),
    percent: clampPercent((Number(item.count || 0) / max) * 100)
  }))
}

function clampPercent(value) {
  const rounded = Math.round(Number(value || 0))
  if (rounded <= 0) return 0
  return Math.min(100, Math.max(4, rounded))
}

function initChart(chart, el) {
  if (!el) return null
  if (chart && !chart.isDisposed()) return chart
  return echarts.init(el)
}

function disposeChart(chart) {
  if (chart && !chart.isDisposed()) {
    chart.dispose()
  }
}

function refreshCharts() {
  nextTick(() => {
    jobChart = initChart(jobChart, jobChartEl.value)
    orderChart = initChart(orderChart, orderChartEl.value)

    if (failureReasonRows.value.length) {
      failureChart = initChart(failureChart, failureChartEl.value)
    } else {
      disposeChart(failureChart)
      failureChart = null
    }

    if (feedbackReasonRows.value.length) {
      feedbackChart = initChart(feedbackChart, feedbackChartEl.value)
    } else {
      disposeChart(feedbackChart)
      feedbackChart = null
    }

    jobChart?.setOption(createJobChartOption(), true)
    orderChart?.setOption(createOrderChartOption(), true)
    failureChart?.setOption(createRankChartOption(failureReasonRows.value, '#e11d48'), true)
    feedbackChart?.setOption(createRankChartOption(
      feedbackReasonRows.value.map((item) => ({ ...item, reason: feedbackReasonLabel(item.reason) })),
      '#2563eb'
    ), true)
    resizeCharts()
  })
}

function resizeCharts() {
  ;[jobChart, orderChart, failureChart, feedbackChart].forEach((chart) => {
    if (chart && !chart.isDisposed()) chart.resize()
  })
}

function createJobChartOption() {
  const data = jobSegments.value.filter((item) => item.value > 0)
  const seriesData = data.length
    ? data.map((item) => ({
        name: item.label,
        value: item.value,
        itemStyle: { color: item.color }
      }))
    : [{ name: '暂无数据', value: 1, itemStyle: { color: '#e2e8f0' } }]

  return {
    animationDuration: 550,
    tooltip: {
      trigger: 'item',
      formatter: ({ name, value, percent }) => `${name}<br/>${formatNumber(value)} · ${percent}%`
    },
    series: [
      {
        type: 'pie',
        radius: ['64%', '86%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        label: {
          show: true,
          position: 'center',
          formatter: `{rate|${dashboard.value.jobs.successRate}%}\n{name|成功率}`,
          rich: {
            rate: {
              color: '#0f172a',
              fontSize: 24,
              fontWeight: 900,
              lineHeight: 28
            },
            name: {
              color: '#64748b',
              fontSize: 12,
              fontWeight: 800,
              lineHeight: 18
            }
          }
        },
        emphasis: { scale: true, scaleSize: 4 },
        labelLine: { show: false },
        data: seriesData
      }
    ]
  }
}

function createOrderChartOption() {
  const rows = orderSegments.value.map((item) => ({
    ...item,
    color: item.key === 'paid' ? '#2563eb' : item.key === 'pending' ? '#f59e0b' : '#64748b'
  }))

  return {
    animationDuration: 550,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => params
        .filter((item) => item.value > 0)
        .map((item) => `${item.marker}${item.seriesName}: ${formatNumber(item.value)}`)
        .join('<br/>') || '暂无订单'
    },
    grid: { left: 0, right: 0, top: 12, bottom: 8, containLabel: false },
    xAxis: { type: 'value', show: false },
    yAxis: { type: 'category', show: false, data: ['订单'] },
    series: rows.map((item) => ({
      name: item.label,
      type: 'bar',
      stack: 'orders',
      barWidth: 22,
      data: [Number(item.value || 0)],
      itemStyle: { color: item.color, borderRadius: item.key === 'paid' ? [11, 0, 0, 11] : item.key === 'refunded' ? [0, 11, 11, 0] : 0 }
    }))
  }
}

function createRankChartOption(rows, color) {
  const data = rows.slice().reverse()
  const values = data.map((item) => item.count)
  const labels = data.map((item) => item.reason || '未知')

  return {
    animationDuration: 550,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: ([item]) => `${item.name}<br/>${formatNumber(item.value)} 次`
    },
    grid: { left: 8, right: 36, top: 4, bottom: 4, containLabel: true },
    xAxis: {
      type: 'value',
      show: false
    },
    yAxis: {
      type: 'category',
      data: labels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: 700,
        width: 96,
        overflow: 'truncate'
      }
    },
    series: [
      {
        type: 'bar',
        data: values,
        barWidth: 10,
        itemStyle: {
          color,
          borderRadius: [999, 999, 999, 999]
        },
        label: {
          show: true,
          position: 'right',
          color: '#0f172a',
          fontSize: 12,
          fontWeight: 900,
          formatter: ({ value }) => formatNumber(value)
        }
      }
    ]
  }
}

function normalizeDashboard(data = {}) {
  return {
    range: data.range || '7d',
    since: data.since || '',
    users: {
      total: Number(data.users?.total || 0),
      active: Number(data.users?.active || 0),
      newInRange: Number(data.users?.newInRange || 0),
      activeInRange: Number(data.users?.activeInRange || 0)
    },
    jobs: {
      total: Number(data.jobs?.total || 0),
      succeeded: Number(data.jobs?.succeeded || 0),
      failed: Number(data.jobs?.failed || 0),
      active: Number(data.jobs?.active || 0),
      successRate: Number(data.jobs?.successRate || 0)
    },
    credits: {
      consumed: Number(data.credits?.consumed || 0),
      credited: Number(data.credits?.credited || 0),
      ledgerCount: Number(data.credits?.ledgerCount || 0)
    },
    orders: {
      total: Number(data.orders?.total || 0),
      paid: Number(data.orders?.paid || 0),
      pending: Number(data.orders?.pending || 0),
      refunded: Number(data.orders?.refunded || 0),
      revenueCents: Number(data.orders?.revenueCents || 0),
      payRate: Number(data.orders?.payRate || 0)
    },
    failureReasons: Array.isArray(data.failureReasons) ? data.failureReasons : [],
    feedbackReasons: Array.isArray(data.feedbackReasons) ? data.feedbackReasons : []
  }
}

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await apiFetch(`/api/admin/dashboard?range=${encodeURIComponent(range.value)}`)
    dashboard.value = normalizeDashboard(data)
  } catch (error) {
    errorMsg.value = error.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function setRange(next) {
  if (range.value === next) return
  range.value = next
  load()
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0))
}

function formatCurrency(cents) {
  return `¥${(Number(cents || 0) / 100).toFixed(2)}`
}

function feedbackReasonLabel(value) {
  const labels = {
    bad_quality: '画质/细节',
    wrong_subject: '主体不符',
    bad_text: '文字错误',
    composition: '构图问题',
    unsafe: '不合规',
    dislike: '点踩',
    note: '备注反馈',
    other: '其他'
  }
  return labels[value] || value
}

watch(
  [jobSegments, orderSegments, failureReasonRows, feedbackReasonRows, range],
  () => refreshCharts(),
  { deep: true }
)

onMounted(() => {
  load()
  window.addEventListener('resize', resizeCharts)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  disposeChart(jobChart)
  disposeChart(orderChart)
  disposeChart(failureChart)
  disposeChart(feedbackChart)
})
</script>

<style scoped>
.dashboard-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dashboard-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.dashboard-kicker {
  color: var(--muted);
  font-size: 12px;
  font-weight: 850;
}

.dashboard-title {
  margin-top: 4px;
  color: var(--text);
  font-size: 22px;
  line-height: 1.2;
  font-weight: 950;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.range-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.72);
}

.range-tab {
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
}

.range-tab.active {
  color: #0f172a;
  background: rgba(15, 23, 42, 0.07);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.metric-card,
.panel {
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06);
}

.metric-card {
  position: relative;
  overflow: hidden;
  min-width: 0;
  padding: 16px;
}

.metric-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: var(--metric-accent);
}

.metric-blue {
  --metric-accent: #2563eb;
  --metric-bg: rgba(37, 99, 235, 0.1);
  --metric-color: #1d4ed8;
}

.metric-green {
  --metric-accent: #16a34a;
  --metric-bg: rgba(22, 163, 74, 0.1);
  --metric-color: #15803d;
}

.metric-amber {
  --metric-accent: #d97706;
  --metric-bg: rgba(217, 119, 6, 0.12);
  --metric-color: #b45309;
}

.metric-rose {
  --metric-accent: #e11d48;
  --metric-bg: rgba(225, 29, 72, 0.1);
  --metric-color: #be123c;
}

.metric-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.metric-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--metric-color);
  background: var(--metric-bg);
}

.metric-badge {
  min-width: 0;
  padding: 5px 8px;
  border-radius: 999px;
  color: var(--metric-color);
  background: var(--metric-bg);
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.metric-label,
.panel-sub {
  color: var(--muted);
  font-size: 12px;
  font-weight: 850;
}

.metric-value {
  margin-top: 8px;
  color: var(--text);
  font-size: 28px;
  line-height: 1.05;
  font-weight: 950;
  font-variant-numeric: tabular-nums;
}

.metric-sub {
  margin-top: 9px;
  color: rgba(100, 116, 139, 0.9);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.45;
}

.insight-grid,
.panel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.panel {
  min-width: 0;
  padding: 16px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-title {
  color: var(--text);
  font-size: 15px;
  font-weight: 950;
}

.panel-sub {
  margin-top: 3px;
  line-height: 1.4;
}

.score-pill {
  flex: 0 0 auto;
  padding: 7px 10px;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 950;
  font-variant-numeric: tabular-nums;
}

.score-good {
  color: #15803d;
  background: rgba(22, 163, 74, 0.1);
}

.score-warn {
  color: #b45309;
  background: rgba(245, 158, 11, 0.14);
}

.score-risk {
  color: #be123c;
  background: rgba(225, 29, 72, 0.1);
}

.score-money {
  color: #1d4ed8;
  background: rgba(37, 99, 235, 0.1);
}

.chart-layout {
  display: grid;
  grid-template-columns: 176px minmax(0, 1fr);
  gap: 22px;
  align-items: center;
}

.chart-box {
  min-width: 0;
}

.chart-donut {
  width: 176px;
  aspect-ratio: 1;
}

.chart-order {
  height: 54px;
}

.chart-rank {
  height: 168px;
}

.legend-list {
  display: grid;
  gap: 10px;
}

.legend-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 850;
}

.legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
}

.legend-row span:nth-child(2) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-row strong {
  color: var(--text);
  font-weight: 950;
  font-variant-numeric: tabular-nums;
}

.legend-row em {
  color: rgba(100, 116, 139, 0.86);
  font-style: normal;
  font-variant-numeric: tabular-nums;
}

.order-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.order-stat {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
  padding: 11px;
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.78);
  border: 1px solid rgba(15, 23, 42, 0.05);
}

.order-icon {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: #1d4ed8;
  background: rgba(37, 99, 235, 0.09);
}

.order-stat div {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.order-stat span:last-child,
.rank-meta span {
  min-width: 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 850;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-stat strong {
  color: var(--text);
  font-size: 15px;
  font-weight: 950;
  font-variant-numeric: tabular-nums;
}

.rank-row {
  display: grid;
  gap: 7px;
}

.rank-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.rank-meta strong {
  color: var(--text);
  font-size: 13px;
  font-weight: 950;
  font-variant-numeric: tabular-nums;
}

.rank-track {
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
}

.rank-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #e11d48, #fb7185);
}

.rank-list-feedback .rank-track span {
  background: linear-gradient(90deg, #2563eb, #38bdf8);
}

.empty {
  min-height: 120px;
  display: grid;
  place-items: center;
  color: var(--muted);
  font-size: 13px;
  font-weight: 850;
}

.error {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(220, 38, 38, 0.18);
  background: rgba(220, 38, 38, 0.06);
  color: var(--accent);
  font-weight: 800;
}

@media (max-width: 1080px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .insight-grid,
  .panel-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .dashboard-toolbar,
  .toolbar-actions,
  .range-tabs {
    width: 100%;
  }

  .toolbar-actions {
    justify-content: space-between;
  }

  .range-tabs {
    justify-content: space-between;
  }

  .range-tab {
    flex: 1;
    padding: 0 8px;
  }

  .metric-grid,
  .order-stats {
    grid-template-columns: 1fr;
  }

  .chart-layout {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .chart-donut {
    width: min(176px, 68vw);
  }

  .legend-list {
    width: 100%;
  }
}
</style>
