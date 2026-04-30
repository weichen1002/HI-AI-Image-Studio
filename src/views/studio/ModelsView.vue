<template>
  <div class="models-view">
    <!-- Category Filter -->
    <div class="flex gap-2 flex-wrap mb-8">
      <Button
        v-for="cat in categories"
        :key="cat"
        class="btn-pill"
        :variant="activeCategory === cat ? 'primary' : 'ghost'"
        @click="activeCategory = cat"
      >
        {{ cat }}
      </Button>
    </div>
    
    <div class="grid-templates">
      <div v-for="tpl in filteredTemplates" :key="tpl.id || tpl.title" class="template-card flex flex-col h-full">
        <div class="tpl-cover flex flex-col p-4 relative">
          <img v-if="tpl.coverImage" :src="tpl.coverImage" alt="cover" class="tpl-cover-img" />
          <div v-else class="tpl-cover-fallback">无封面</div>
          <div class="tpl-cover-overlay"></div>
          <span class="text-eyebrow mt-auto" style="position: relative; z-index: 1; background: rgba(255,255,255,0.9); padding: 4px 8px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); align-self: flex-start;">
            {{ tpl.category }}
          </span>
        </div>
        <div class="tpl-body p-4 flex flex-col flex-1 justify-between" style="padding: 20px;">
          <div class="flex flex-col gap-2 mb-4">
            <h3 class="text-h3">{{ tpl.title }}</h3>
            <p class="text-muted" style="font-size: 14px; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 8px;">
              {{ tpl.desc }}
            </p>
            <div class="prompt-preview">
              <code style="display: block; white-space: pre-wrap; word-break: break-word; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; line-height: 1.5;">{{ tpl.prompt }}</code>
            </div>
          </div>
          <Button
            variant="ghost"
            class="w-full"
            style="border-color: rgba(99, 102, 241, 0.2); color: var(--primary);"
            @click="useTemplate(tpl)"
          >
            带入工作台
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '../../components/common'
import templatesData from '../../data/inspiration-templates.json'

const router = useRouter()

const activeCategory = ref("全部")

const templates = Array.isArray(templatesData) ? templatesData : []

const categories = computed(() => {
  const set = new Set()
  for (const item of templates) {
    if (item?.category) set.add(String(item.category))
  }
  return ["全部", ...Array.from(set)]
})

const filteredTemplates = computed(() => {
  if (activeCategory.value === "全部") return templates
  return templates.filter(t => t.category === activeCategory.value)
})

function useTemplate(tpl) {
  // Pass the prompt via query params and navigate to the create view
  router.push({ path: '/studio', query: { prompt: tpl.prompt } })
}
</script>

<style scoped>
.models-view {
  min-width: 0;
}

.grid-templates {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.template-card {
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  background: var(--bg-card);
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.template-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-hover);
}

.tpl-cover {
  height: 180px;
  position: relative;
  overflow: hidden;
}

.tpl-cover-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.tpl-cover-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 900;
  background: radial-gradient(700px 240px at 20% 0%, rgba(99, 102, 241, 0.45), transparent 55%),
    radial-gradient(680px 260px at 85% 20%, rgba(236, 72, 153, 0.35), transparent 55%),
    rgba(15, 23, 42, 0.65);
}

.template-card:hover .tpl-cover-img {
  transform: scale(1.05);
}

.tpl-cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 100%);
  pointer-events: none;
}

.prompt-preview {
  background: var(--bg-subtle);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  min-height: 76px;
}

.prompt-preview code {
  display: -webkit-box;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted);
  white-space: pre-wrap;
  word-break: break-word;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.tpl-body {
  min-height: 300px;
}

.tpl-body .btn {
  margin-top: auto;
}

@media (max-width: 760px) {
  .grid-templates {
    grid-template-columns: 1fr;
  }
}
</style>
