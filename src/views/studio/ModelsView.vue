<template>
  <div class="panel">
    <div class="mb-8">
      <h2 class="text-h2">灵感库 (Inspiration Gallery)</h2>
      <!-- <p class="text-lead mt-2">
        整理自开源社区 <a href="https://github.com/YouMind-OpenLab/awesome-gpt-image-2" target="_blank" class="text-primary" style="text-decoration: underline;">awesome-gpt-image-2</a> 的精选提示词。
        点击模板即可直接带入创作台进行修改与生成。
      </p> -->
    </div>

    <!-- Category Filter -->
    <div class="flex gap-2 flex-wrap mb-8">
      <button 
        v-for="cat in categories" 
        :key="cat"
        class="btn"
        :class="activeCategory === cat ? 'btn-primary' : 'btn-ghost'"
        style="height: 36px; padding: 0 16px; border-radius: 100px; font-size: 13px;"
        @click="activeCategory = cat"
      >
        {{ cat }}
      </button>
    </div>
    
    <div class="grid-templates">
      <div v-for="tpl in filteredTemplates" :key="tpl.title" class="template-card flex flex-col h-full">
        <div class="tpl-cover flex flex-col p-4 relative">
          <img :src="tpl.coverImage" alt="cover" class="tpl-cover-img" />
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
          <button class="btn btn-ghost" style="width: 100%; border-color: rgba(99, 102, 241, 0.2); color: var(--primary);" @click="useTemplate(tpl)">带入工作台</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const categories = ["全部", "海报 / 传单", "信息图表 / 地图", "产品 / 商业", "演示 / 幻灯片", "插画 / 风格"]
const activeCategory = ref("全部")

const templates = [
  {
    category: "海报 / 传单",
    title: "VR头显爆炸图海报",
    desc: "生成具有科技感的VR头显内部结构爆炸图，带有多层组件的详细标注和宣传文案，适合商业海报设计。",
    coverImage: "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=600&h=400&fit=crop&q=80",
    prompt: `{\n  "type": "exploded view product diagram poster",\n  "subject": "VR headset",\n  "style": "clean high-tech 3D render, studio lighting, glowing accents",\n  "background": "soft purple and blue gradient",\n  "header": {\n    "logo": "∞ Meta Quest 3",\n    "subtitle": "まったく新しい現実を、まったく新しい構造から。"\n  },\n  "layout": {\n    "centerpiece": "vertically stacked exploded view of a VR headset showing 9 distinct layers of internal components..."\n  }\n}`
  },
  {
    category: "信息图表 / 地图",
    title: "手绘风城市美食地图",
    desc: "生成一张手绘水彩风格的旅游地图，包含当地特色美食的编号标注、地标建筑和图例说明，极具设计感。",
    coverImage: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=600&h=400&fit=crop&q=80",
    prompt: `{\n  "type": "illustrated map infographic",\n  "style": "watercolor and ink hand-drawn illustration on vintage parchment",\n  "title_section": {\n    "text": "成都 吃货暴走地图",\n    "mascot": "cartoon red chili pepper wearing sunglasses and giving a thumbs up"\n  },\n  "border": "vine of green leaves and red chili peppers",\n  "layout": {\n    "background": "textured beige parchment paper with yellow roads, blue rivers, and green park areas",\n    "sections": [\n      {\n        "title": "landmarks",\n        "count": 6,\n        "illustrations": ["traditional pavilion", "traditional monastery", "modern skyscraper with climbing panda", "tall TV tower", "traditional gate", "industrial buildings"],\n        "labels": ["人民公园", "文殊院", "IFS", "339电视塔", "宽窄巷子", "东郊记忆"]\n      }\n    ]\n  }\n}`
  },
  {
    category: "演示 / 幻灯片",
    title: "桃太郎解说幻灯片",
    desc: "融合了温馨可爱的日式插画风格与高信息密度的政府简报风格，用来解释复杂故事或流程的示意图。",
    coverImage: "https://images.unsplash.com/photo-1580130379624-3a069ad3851d?w=600&h=400&fit=crop&q=80",
    prompt: `Create an explanatory slide (ponchi-e diagram) for Momotaro that fuses the gentle atmosphere of "Irasutoya" with the overwhelming information density of "Kasumigaseki slides".`
  },
  {
    category: "产品 / 商业",
    title: "高级质感商品主图",
    desc: "适合香氛、护肤、数码配件等产品，强调材质、光影和留白，可直接用作电商商品展示图。",
    coverImage: "https://images.unsplash.com/photo-1608528577891-eb055944f2e7?w=600&h=400&fit=crop&q=80",
    prompt: "为一款高端香氛产品生成电商商品主图，纯白科技感背景，产品位于画面中心，柔和侧光，精致反射，保留干净中文标题区域，商业摄影质感，1:1 构图。"
  },
  {
    category: "插画 / 风格",
    title: "赛博极简风格探索",
    desc: "适合需要更强风格化、更未来感的视觉方向，通过克制的构图展现科技品牌的极简感。",
    coverImage: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&h=400&fit=crop&q=80",
    prompt: "生成一张赛博极简风格视觉海报，白色和深黑对比，蓝色发光线条，抽象图片生成符号，构图克制，高级科技品牌感，适合 AI 产品宣传。"
  },
  {
    category: "产品 / 商业",
    title: "小红书爆款封面模板",
    desc: "适合生活方式、咖啡、穿搭、课程和个人品牌内容封面，自带高级排版。",
    coverImage: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=600&h=400&fit=crop&q=80",
    prompt: "生成一张适合小红书封面的生活方式视觉，白色科技感排版，主体清晰，背景干净，预留中文大标题和副标题位置，高级杂志封面构图，明亮自然光。"
  },
  {
    category: "海报 / 传单",
    title: "复古爵士音乐节海报",
    desc: "生成一张具有1920年代复古风格的爵士音乐节海报，包含铜管乐器剪影、粗犷的排版和颗粒质感。",
    coverImage: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&h=400&fit=crop&q=80",
    prompt: "Vintage 1920s style jazz music festival poster, silhouette of a saxophone player, bold retro typography, grainy texture, sepia tone background with burnt orange accents, art deco borders."
  },
  {
    category: "插画 / 风格",
    title: "吉卜力风格自然风景",
    desc: "生成带有浓厚吉卜力工作室风格的动画风景插画，茂密的森林、蓝天白云和柔和的阳光，非常适合做壁纸。",
    coverImage: "https://images.unsplash.com/photo-1501862700950-18382cd41497?w=600&h=400&fit=crop&q=80",
    prompt: "A lush green forest with a small clear stream, bright blue sky with fluffy cumulus clouds, gentle sunlight filtering through leaves, Studio Ghibli anime style, highly detailed background, vibrant colors."
  },
  {
    category: "产品 / 商业",
    title: "极简科技电子产品渲染图",
    desc: "生成苹果风格的极简科技产品渲染图，纯白背景，完美的金属光泽和倒影，体现极致工业设计美学。",
    coverImage: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&h=400&fit=crop&q=80",
    prompt: "Minimalist product render of a sleek silver laptop floating above a white surface, soft studio lighting, sharp reflections, brushed aluminum texture, clean white background, Apple style aesthetic."
  },
  {
    category: "信息图表 / 地图",
    title: "现代科技数据大屏",
    desc: "生成一张充满科技感和未来感的数据可视化大屏背景，包含蓝色发光图表、折线图和全息地球元素。",
    coverImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop&q=80",
    prompt: "Futuristic data dashboard UI, glowing blue and cyan charts, holographic earth in the center, line graphs and bar charts floating in dark space, cyber security analytics screen, highly detailed."
  }
]

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
.grid-templates {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
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
}

.prompt-preview code {
  font-family: monospace;
  font-size: 12px;
  color: var(--muted);
  white-space: pre-wrap;
  word-break: break-all;
}

.text-primary {
  color: var(--primary);
}
</style>