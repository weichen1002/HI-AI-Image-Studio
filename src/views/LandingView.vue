<template>
  <div class="landing-view">
    <!-- Decorative background elements -->
    <div class="bg-shape shape-1"></div>
    <div class="bg-shape shape-2"></div>
    
    <header class="header bg-transparent">
      <div class="container flex justify-between items-center" style="width: 100%">
        <div class="brand">
          <div class="brand-icon">
            <img :src="logoUrl" alt="Hi AI Image Studio logo" width="20" height="20" loading="eager" fetchpriority="high" />
          </div>
          <span>Hi AI Image Studio</span>
        </div>
        <nav class="flex gap-4">
          <template v-if="!isAuthenticated">
            <LinkButton to="/login" variant="ghost">登录</LinkButton>
            <LinkButton to="/login">开始创作</LinkButton>
          </template>
          <template v-else>
            <LinkButton to="/studio">进入工作台</LinkButton>
          </template>
        </nav>
      </div>
    </header>

    <main>
      <section class="hero container">
        <div class="hero-content">
          <div class="badge-wrapper mb-6">
            <div class="badge-glow"></div>
            <div class="badge-content">
              <SparklesIcon :size="14" class="badge-icon" />
              <span>Professional Design Power v2.0</span>
            </div>
          </div>
          
          <h1 class="text-h2 mb-6 hero-title" style="white-space: normal; line-height: 1.3;">
            把一句想法
            <br/>
            变成可以直接使用的商业图片
          </h1>
          
          <p class="text-lead mb-10 hero-subtitle">
            面向内容创作者、电商卖家和个人品牌，快速生成海报、封面、商品图与灵感视觉，让设计生产更高效。
          </p>
          
          <div class="flex items-center justify-center gap-4 action-buttons">
            <LinkButton :to="isAuthenticated ? '/studio' : '/login'" class="btn-lg">
              免费开始创作
              <ArrowRightIcon :size="18" class="ml-2 hero-cta-icon" />
            </LinkButton>
            <LinkButton to="/studio/models" variant="ghost" class="btn-lg bg-white">
              浏览灵感库
            </LinkButton>
          </div>
        </div>

        <div class="hero-showcase mt-16">
          <div class="showcase-glow"></div>
          <div class="showcase-window">
            <div class="window-header">
              <div class="dots">
                <span></span><span></span><span></span>
              </div>
              <div class="window-title">Hi AI Image Studio - Workspace</div>
            </div>
            <div class="window-body">
              <div class="mock-sidebar">
                <div class="mock-item active"></div>
                <div class="mock-item"></div>
                <div class="mock-item"></div>
              </div>
              <div class="mock-content">
                <div class="mock-header"></div>
                <div class="mock-grid">
                  <div class="mock-panel mock-left">
                    <div class="mock-line" style="width: 40%"></div>
                    <div class="mock-box mt-4"></div>
                    <div class="mock-line mt-4" style="width: 80%"></div>
                    <div class="mock-line mt-2" style="width: 60%"></div>
                    <div class="mock-button mt-6"></div>
                  </div>
                  <div class="mock-panel mock-right">
                    <div class="mock-image-placeholder">
                      <!-- Render an actual example image to make it look better instead of just shimmer -->
                      <div class="example-image-layer"></div>
                      <div class="shimmer"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <!-- Features Section -->
      <section class="features container">
        <div class="feature-grid">
          <div class="feature-card">
            <div class="feature-icon"><ZapIcon :size="28" /></div>
            <h3 class="text-h3 mb-3">极速出图</h3>
            <p class="text-muted">基于最新的 gpt-image-2 模型，仅需几秒即可将您的文字转化为高清晰度商业图像。</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><LayoutIcon :size="28" /></div>
            <h3 class="text-h3 mb-3">多比例适配</h3>
            <p class="text-muted">支持 1:1, 16:9, 9:16 等多种主流比例，完美适配小红书、抖音、公众号等各类平台。</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><LibraryIcon :size="28" /></div>
            <h3 class="text-h3 mb-3">灵感管理</h3>
            <p class="text-muted">自动保存每一次生成的作品与提示词，建立您专属的个人灵感记录库，随时回溯。</p>
          </div>
        </div>
      </section>

      <footer class="footer">
        <div class="container footer-inner">
          <div class="footer-left">
            <div class="brand footer-brand">
              <div class="brand-icon">
                <img :src="logoUrl" alt="Hi AI Image Studio logo" width="18" height="18" loading="lazy" />
              </div>
              <span>Hi AI Image Studio</span>
            </div>
            <div class="footer-meta">© 2026 Hi AI Image Studio. All rights reserved.</div>
          </div>
          <div class="footer-right">
            <div class="footer-title">友情链接</div>
            <a class="footer-link" href="https://hiapis.cloud/" target="_blank" rel="noopener noreferrer">hiapis.cloud - AI 中转站</a>
          </div>
        </div>
      </footer>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { SparklesIcon, ImageIcon, ArrowRightIcon, ZapIcon, LayoutIcon, LibraryIcon } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { LinkButton } from '../components/common'
import logoUrl from '../hi-image-logo.png'

const authStore = useAuthStore()
const isAuthenticated = computed(() => !!authStore.user)
</script>

<style scoped>
.landing-view {
  position: relative;
  overflow: hidden;
  background: var(--bg);
  min-height: 100vh;
}

/* Background Elements */
.bg-shape {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  z-index: 0;
  opacity: 0.5;
  pointer-events: none;
}
.shape-1 {
  top: -10%;
  left: -10%;
  width: 50vw;
  height: 50vw;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%);
}
.shape-2 {
  bottom: -20%;
  right: -10%;
  width: 60vw;
  height: 60vw;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, transparent 70%);
}

.header.bg-transparent {
  background: rgba(248, 250, 252, 0.5);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

main {
  position: relative;
  z-index: 1;
}

.hero {
  padding: 120px 0 80px;
  text-align: center;
}

.hero-content {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Badge */
.badge-wrapper {
  position: relative;
  display: inline-block;
  margin-bottom: 32px;
}
.badge-glow {
  position: absolute;
  inset: -2px;
  background: var(--gradient-primary);
  filter: blur(8px);
  opacity: 0.3;
  border-radius: 100px;
}
.badge-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  background: #ffffff;
  border: 1px solid rgba(99, 102, 241, 0.2);
  color: var(--primary);
  border-radius: 100px;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1);
}

.hero-title {
  background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1.25;
}

.hero-subtitle {
  max-width: 640px;
  font-size: 20px;
  color: var(--muted);
  line-height: 1.6;
  margin-bottom: 48px;
}

.btn-lg {
  height: 56px;
  padding: 0 36px;
  font-size: 16px;
  border-radius: 14px;
}

.hero-cta-icon {
  color: #fff;
}
.bg-white {
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

/* Showcase Window */
.hero-showcase {
  position: relative;
  max-width: 1000px;
  margin: 64px auto 0;
  perspective: 1000px;
}
.showcase-glow {
  position: absolute;
  inset: 10%;
  background: var(--gradient-primary);
  filter: blur(80px);
  opacity: 0.15;
  z-index: 0;
}
.showcase-window {
  position: relative;
  z-index: 1;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 1);
  border-radius: 20px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.08), inset 0 2px 0 rgba(255, 255, 255, 1);
  overflow: hidden;
  transform: rotateX(2deg) translateY(0);
  transition: transform 0.5s ease;
}
.showcase-window:hover {
  transform: rotateX(0deg) translateY(-10px);
}

.window-header {
  height: 48px;
  background: rgba(248, 250, 252, 0.8);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  padding: 0 20px;
  position: relative;
}
.dots {
  display: flex;
  gap: 8px;
}
.dots span {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #e2e8f0;
}
.dots span:nth-child(1) { background: #ff5f56; }
.dots span:nth-child(2) { background: #ffbd2e; }
.dots span:nth-child(3) { background: #27c93f; }

.window-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}

.window-body {
  display: flex;
  height: 500px;
  background: rgba(255, 255, 255, 0.5);
}
.mock-sidebar {
  width: 200px;
  border-right: 1px solid rgba(0,0,0,0.05);
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mock-item {
  height: 36px;
  border-radius: 8px;
  background: rgba(0,0,0,0.03);
}
.mock-item.active {
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.mock-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.mock-header {
  height: 60px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}
.mock-grid {
  flex: 1;
  padding: 24px;
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 24px;
}
.mock-panel {
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.05);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.02);
}
.mock-left {
  display: flex;
  flex-direction: column;
}
.mock-line {
  height: 12px;
  border-radius: 6px;
  background: rgba(0,0,0,0.05);
}
.mock-box {
  height: 120px;
  border-radius: 12px;
  background: rgba(0,0,0,0.03);
  border: 1px solid rgba(0,0,0,0.05);
}
.mock-button {
  height: 48px;
  border-radius: 12px;
  background: var(--gradient-primary);
  opacity: 0.8;
  margin-top: auto;
}
.mock-image-placeholder {
  width: 100%;
  height: 100%;
  background: var(--gradient-subtle);
  border-radius: 12px;
  border: 1px solid rgba(99, 102, 241, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  position: relative;
  overflow: hidden;
}
.example-image-layer {
  position: absolute;
  inset: 0;
  background-image: url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop');
  background-size: cover;
  background-position: center;
  opacity: 0.8;
  mix-blend-mode: overlay;
}
.shimmer {
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(to right, transparent, rgba(255,255,255,0.6), transparent);
  animation: shimmer 2.5s infinite ease-in-out;
}
@keyframes shimmer {
  100% { left: 200%; }
}

/* Features */
.features {
  padding: 80px 0 120px;
}
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
}
.feature-card {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 1);
  padding: 32px;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.03);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.feature-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 20px 40px rgba(0,0,0,0.06);
}
.feature-icon {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: var(--gradient-subtle);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 28px;
}
.feature-card p {
  line-height: 1.6;
}

@media (max-width: 900px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }
  .mock-grid {
    grid-template-columns: 1fr;
  }
  .mock-sidebar {
    display: none;
  }
}

.footer {
  padding: 28px 0;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(18px);
}
.footer-inner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}
.footer-brand .brand-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  font-size: 13px;
}
.footer-meta {
  margin-top: 10px;
  font-size: 12px;
  color: var(--muted);
}
.footer-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 10px;
}
.footer-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary);
}
.footer-link:hover {
  text-decoration: underline;
}
@media (max-width: 900px) {
  .footer-inner {
    flex-direction: column;
  }
}
</style>
