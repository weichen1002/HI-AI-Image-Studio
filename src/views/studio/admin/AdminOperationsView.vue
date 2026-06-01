<template>
  <TablePageLayout title="" subtitle="" density="compact" variant="plain">
    <div class="ops-shell">
      <section class="ops-hero">
        <div>
          <div class="ops-kicker">运营中心</div>
          <h2>运营投放与增长动作</h2>
          <p>把公告、弹窗、活动码和反馈样本集中管理，先用轻量入口承接运营动作，后续再升级为完整投放活动系统。</p>
        </div>
        <div class="ops-hero-mark">
          <TargetIcon :size="30" />
        </div>
      </section>

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

      <section class="ops-plan">
        <div class="ops-plan-head">
          <ChartNoAxesCombinedIcon :size="18" />
          <span>后续投放能力建议</span>
        </div>
        <div class="ops-plan-list">
          <div v-for="item in nextSteps" :key="item.title" class="ops-plan-item">
            <strong>{{ item.title }}</strong>
            <span>{{ item.desc }}</span>
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
  MegaphoneIcon,
  TargetIcon
} from 'lucide-vue-next'
import { TablePageLayout } from '../../../components/layout'

const operationCards = [
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

const nextSteps = [
  {
    title: '投放活动',
    desc: '统一活动名称、投放时间、目标用户、展示位置和优先级。'
  },
  {
    title: '触达数据',
    desc: '统计展示、点击、关闭、兑换和转化，形成活动复盘。'
  },
  {
    title: '分群策略',
    desc: '按新用户、沉默用户、付费用户和管理员角色做差异化运营。'
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
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

.ops-plan-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-size: 14px;
  font-weight: 950;
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

@media (max-width: 980px) {
  .ops-grid,
  .ops-plan-list {
    grid-template-columns: 1fr;
  }

  .ops-hero {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
