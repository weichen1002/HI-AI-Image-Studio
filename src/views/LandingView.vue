<template>
  <div class="landing-view light-theme cyber-grid-bg">
    <!-- Hero Background -->
    <div class="hero-bg">
      <div class="hero-bg-image"></div>
      <div class="hero-bg-overlay"></div>
      <div class="cyber-grid-overlay"></div>
      
      <!-- High-end Aurora / Orb Background -->
      <div class="aurora-container">
        <div class="aurora-orb orb-1"></div>
        <div class="aurora-orb orb-2"></div>
        <div class="aurora-orb orb-3"></div>
      </div>
      <div class="noise-overlay"></div>
    </div>

    <!-- Enhanced Sticky Header -->
    <header class="header cyber-header" :class="{ 'scrolled': isScrolled }">
      <div class="container flex justify-between items-center" style="width: 100%">
        <div class="flex items-center gap-12">
          <div class="brand light-brand cursor-pointer" @click="scrollToTop">
            <div class="brand-icon">
              <img :src="logoUrl" alt="Hi AI Image Studio logo" width="28" height="28" loading="eager" fetchpriority="high" />
            </div>
            <span>{{ siteSettings.siteName }}</span>
          </div>
          <!-- Optimized Nav Links -->
          <nav class="hidden md:flex gap-8 items-center text-sm font-medium">
            <a href="#capabilities" class="nav-link-subtle">AI 视觉引擎</a>
            <a href="#showcase" class="nav-link-subtle">灵感画廊</a>
            <a href="#advantages" class="nav-link-subtle">企业级优势</a>
            <a href="#testimonials" class="nav-link-subtle">创作者之声</a>
            <a href="#pricing" class="nav-link-subtle">订阅方案</a>
          </nav>
        </div>

        <nav class="flex gap-4 items-center">
          <template v-if="!isAuthenticated">
            <LinkButton to="/login" variant="ghost" class="nav-link">登录</LinkButton>
            <LinkButton to="/login" class="nav-btn cyber-glow">开始创作 <ArrowRightIcon :size="16" class="ml-1 landing-button-arrow" /></LinkButton>
          </template>
          <template v-else>
            <LinkButton to="/studio" class="nav-btn cyber-glow">进入工作台 <ArrowRightIcon :size="16" class="ml-1 landing-button-arrow" /></LinkButton>
          </template>
        </nav>
      </div>
    </header>

    <main>
      <!-- Hero Section -->
      <section class="hero full-height flex flex-col justify-center relative z-10">
        <div class="container">
          <div class="hero-content">
            <div class="badge-wrapper animate-fade-up">
              <div class="badge-content">
                <SparklesIcon :size="14" class="badge-icon" />
                <span>全新一代 AI 图像生成引擎</span>
              </div>
            </div>

            <h1 class="hero-title animate-fade-up-delay-1">
              把无限的想象力<br/>
              <span class="text-gradient">变成可见的真实</span>
            </h1>
            
            <p class="hero-subtitle animate-fade-up-delay-2">
              专为设计师、摄影师与创意团队打造的高性能 AI 绘图平台。只需输入简单的描述，几秒钟内即可生成惊艳的高清写实摄影、艺术插画与 3D 渲染图。
            </p>
            
            <div class="hero-search-wrapper animate-fade-up-delay-3">
              <div class="hero-search-bar cyber-search" @click="handleSearch">
                <SearchIcon :size="24" class="icon-search" />
                <div class="typewriter-text">{{ currentPlaceholder }}<span class="cursor"></span></div>
                <button class="btn-generate">
                  <SparklesIcon :size="16" class="mr-2" />
                  立即生成
                </button>
              </div>
              <div class="trending-tags">
                <span class="tag-label">探索趋势:</span>
                <a href="javascript:void(0)" @click="handleSearch" class="tag"># 极简产品摄影</a>
                <a href="javascript:void(0)" @click="handleSearch" class="tag"># 赛博朋克城市</a>
                <a href="javascript:void(0)" @click="handleSearch" class="tag"># 潮玩盲盒 3D</a>
                <a href="javascript:void(0)" @click="handleSearch" class="tag"># 电影级光影</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Trusted By (Logo Cloud) -->
      <section class="trusted-section relative z-10">
        <div class="container text-center">
          <p class="trusted-label">全球 10,000+ 先锋创作者与团队的共同选择</p>
          <div class="logo-cloud">
            <div class="mock-logo-wrapper"><GlobeIcon :size="28" class="mock-logo" /><span class="mock-logo-text">GlobalVision</span></div>
            <div class="mock-logo-wrapper"><CpuIcon :size="28" class="mock-logo" /><span class="mock-logo-text">TechCore</span></div>
            <div class="mock-logo-wrapper"><LayersIcon :size="28" class="mock-logo" /><span class="mock-logo-text">DesignStack</span></div>
            <div class="mock-logo-wrapper"><HexagonIcon :size="28" class="mock-logo" /><span class="mock-logo-text">NovaTech</span></div>
            <div class="mock-logo-wrapper"><ImageIcon :size="28" class="mock-logo" /><span class="mock-logo-text">PixelPro</span></div>
          </div>
        </div>
      </section>
      
      <!-- Core Capabilities Section (New Module) -->
      <section id="capabilities" class="capabilities-section relative z-10">
        <div class="container">
          <div class="section-header reveal-on-scroll">
            <h2 class="section-title">全能 AI 图像创作矩阵</h2>
            <p class="section-subtitle">不仅是强大的文字生成图片，我们提供覆盖您所有作图需求的完整工具链</p>
          </div>
          
          <div class="cap-grid reveal-on-scroll" style="transition-delay: 0.1s">
            <div class="cap-card group" @mousemove="handleMouseMove">
              <div class="cap-content-wrap">
                <div class="cap-icon-wrap"><Wand2Icon :size="32" /></div>
                <h3 class="cap-title">文生图 <span class="cap-subtitle">Text to Image</span></h3>
                <p class="cap-desc">搭载百亿参数自研模型，具备惊人的语义理解力，只需简短的自然语言即可渲染出充满细节的写实图像与艺术插画。</p>
              </div>
            </div>
            
            <div class="cap-card group" @mousemove="handleMouseMove">
              <div class="cap-content-wrap">
                <div class="cap-icon-wrap"><ImagePlusIcon :size="32" /></div>
                <h3 class="cap-title">图生图 <span class="cap-subtitle">Image to Image</span></h3>
                <p class="cap-desc">基于原图的构图与色彩分布进行深度重绘，支持风格迁移与线稿上色，完美保留核心特征的同时注入全新视觉灵魂。</p>
              </div>
            </div>

            <div class="cap-card group" @mousemove="handleMouseMove">
              <div class="cap-content-wrap">
                <div class="cap-icon-wrap"><CropIcon :size="32" /></div>
                <h3 class="cap-title">局部重绘 <span class="cap-subtitle">Inpainting</span></h3>
                <p class="cap-desc">精准控制画面细节。圈选指定区域并输入提示词，即可实现元素的无痕替换、添加或消除，光影过渡自然真实。</p>
              </div>
            </div>

            <div class="cap-card group" @mousemove="handleMouseMove">
              <div class="cap-content-wrap">
                <div class="cap-icon-wrap"><MaximizeIcon :size="32" /></div>
                <h3 class="cap-title">高清放大 <span class="cap-subtitle">AI Upscaler</span></h3>
                <p class="cap-desc">突破分辨率极限。利用 AI 算法智能推断并补充图像细节，最高支持无损放大至 8K 电影级画质，满足大屏与印刷需求。</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Infinite Marquee Showcase (Artlist Style) -->
      <section id="showcase" class="marquee-section relative z-10">
        <div class="section-header container reveal-on-scroll">
          <h2 class="section-title">无限灵感画廊</h2>
          <p class="section-subtitle">浏览并一键克隆由社区用户生成的绝美 AI 图像</p>
        </div>

        <!-- Track 1: Moving Left -->
        <div class="marquee-container mb-6 reveal-on-scroll" style="transition-delay: 0.1s" @mouseenter="isPaused1 = true" @mouseleave="isPaused1 = false">
          <div class="marquee-track track-left" :style="{ animationPlayState: isPaused1 ? 'paused' : 'running' }">
            <div class="marquee-group">
              <div class="marquee-item" v-for="img in marqueeImages1" :key="img.id" @click="handleSearch">
                <img :src="img.url" alt="AI Generated Image" loading="lazy" />
                <div class="item-overlay">
                  <p class="item-prompt">{{ img.prompt }}</p>
                  <button class="btn-try">做同款 <ArrowRightIcon :size="16" class="landing-button-arrow" /></button>
                </div>
              </div>
            </div>
            <div class="marquee-group" aria-hidden="true">
              <div class="marquee-item" v-for="img in marqueeImages1" :key="'dup-'+img.id" @click="handleSearch">
                <img :src="img.url" alt="AI Generated Image" loading="lazy" />
                <div class="item-overlay">
                  <p class="item-prompt">{{ img.prompt }}</p>
                  <button class="btn-try">做同款 <ArrowRightIcon :size="16" class="landing-button-arrow" /></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Track 2: Moving Right -->
        <div class="marquee-container" @mouseenter="isPaused2 = true" @mouseleave="isPaused2 = false">
          <div class="marquee-track track-right" :style="{ animationPlayState: isPaused2 ? 'paused' : 'running' }">
            <div class="marquee-group">
              <div class="marquee-item" v-for="img in marqueeImages2" :key="img.id" @click="handleSearch">
                <img :src="img.url" alt="AI Generated Image" loading="lazy" />
                <div class="item-overlay">
                  <p class="item-prompt">{{ img.prompt }}</p>
                  <button class="btn-try">做同款 <ArrowRightIcon :size="16" class="landing-button-arrow" /></button>
                </div>
              </div>
            </div>
            <div class="marquee-group" aria-hidden="true">
              <div class="marquee-item" v-for="img in marqueeImages2" :key="'dup-'+img.id" @click="handleSearch">
                <img :src="img.url" alt="AI Generated Image" loading="lazy" />
                <div class="item-overlay">
                  <p class="item-prompt">{{ img.prompt }}</p>
                  <button class="btn-try">做同款 <ArrowRightIcon :size="16" class="landing-button-arrow" /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Bento Box Features (Platform Advantages) -->
      <section id="advantages" class="bento-section relative z-10">
        <div class="container">
          <div class="section-header reveal-on-scroll">
            <h2 class="section-title">平台核心优势</h2>
            <p class="section-subtitle">专为高强度商业交付打造的底层架构与交互体验</p>
          </div>
          
          <div class="bento-grid reveal-on-scroll" style="transition-delay: 0.1s">
            <!-- Large Card -->
            <div class="bento-card bento-large group" @mousemove="handleMouseMove">
              <div class="bento-glow"></div>
              <div class="bento-content-wrap flex flex-row items-center w-full h-full">
                <div class="bento-content">
                  <div class="bento-icon-wrap"><ZapIcon :size="28" /></div>
                  <h3 class="bento-title">超脑级推理速度</h3>
                  <p class="bento-desc">搭载行业顶尖的分布式 AI 推理集群，百亿参数模型毫秒级响应。支持多图并发渲染，告别漫长等待，让灵感与成片之间只差一个点击。</p>
                </div>
                <div class="bento-image-wrapper">
                  <div class="bento-mock-ui">
                    <div class="mock-header"></div>
                    <div class="mock-body">
                      <div class="mock-img-placeholder skeleton-anim"></div>
                      <div class="mock-img-placeholder skeleton-anim delay-1"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Small Card 1 -->
            <div class="bento-card group" @mousemove="handleMouseMove">
              <div class="bento-glow"></div>
              <div class="bento-content-wrap">
                <div class="bento-content">
                  <div class="bento-icon-wrap"><LayoutIcon :size="28" /></div>
                  <h3 class="bento-title">多维画幅自适应</h3>
                  <p class="bento-desc">原生支持 16:9 电影宽幅、9:16 竖屏海报或任意自定义比例。AI 智能重构构图元素，完美适配所有终端投放场景。</p>
                </div>
              </div>
            </div>

            <!-- Small Card 2 -->
            <div class="bento-card group" @mousemove="handleMouseMove">
              <div class="bento-glow"></div>
              <div class="bento-content-wrap">
                <div class="bento-content">
                  <div class="bento-icon-wrap"><LibraryIcon :size="28" /></div>
                  <h3 class="bento-title">团队级资产中台</h3>
                  <p class="bento-desc">全自动记录每一次提示词调优与种子参数。支持团队共享灵感金库，构建企业专属的私有视觉资产壁垒。</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Scenarios Section -->
      <section id="scenarios" class="scenarios-section relative z-10">
        <div class="container">
          <div class="section-header reveal-on-scroll">
            <h2 class="section-title">行业级解决方案</h2>
            <p class="section-subtitle">无论深耕何种领域，都能在这里找到颠覆性的视觉突破口</p>
          </div>
          
          <div class="scenarios-grid reveal-on-scroll" style="transition-delay: 0.1s">
            <div class="scenario-card" v-for="scene in scenarios" :key="scene.id" @click="handleSearch">
              <img :src="scene.image" :alt="scene.title" class="scenario-img" loading="lazy" />
              <div class="scenario-overlay">
                <h3 class="scenario-title">{{ scene.title }}</h3>
                <p class="scenario-desc">{{ scene.desc }}</p>
                <div class="scenario-action">
                  <span>查看案例</span>
                  <ArrowRightIcon :size="16" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Workflow Section -->
      <section id="workflow" class="workflow-section relative z-10">
        <div class="container">
          <div class="section-header reveal-on-scroll">
            <h2 class="section-title">三步重塑工作流</h2>
            <p class="section-subtitle">化繁为简，让创意想法以最快的路径落地为高品质资产</p>
          </div>
          
          <div class="workflow-grid reveal-on-scroll" style="transition-delay: 0.1s">
            <div class="step-card">
              <div class="step-icon-container">
                <div class="step-number">01</div>
                <div class="step-icon-glow"></div>
              </div>
              <h3 class="step-title">定义灵感边界</h3>
              <p class="step-desc">用自然语言描述你的构想，或上传风格参考图、线稿，为 AI 设定精确的视觉坐标。</p>
            </div>
            <div class="step-connector">
              <div class="connector-line"></div>
              <div class="connector-dot"></div>
            </div>
            <div class="step-card">
              <div class="step-icon-container">
                <div class="step-number">02</div>
                <div class="step-icon-glow"></div>
              </div>
              <h3 class="step-title">引擎极速推演</h3>
              <p class="step-desc">底层模型自动补全光影、材质与物理细节，数秒内并行输出多套高品质视觉方案。</p>
            </div>
            <div class="step-connector">
              <div class="connector-line"></div>
              <div class="connector-dot"></div>
            </div>
            <div class="step-card">
              <div class="step-icon-container">
                <div class="step-number">03</div>
                <div class="step-icon-glow"></div>
              </div>
              <h3 class="step-title">一键交付商用</h3>
              <p class="step-desc">精选最佳方案进行 AI 高清放大或局部微调，直接导出无水印原图，无缝接入营销阵地。</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Testimonials Section (Artlist Style) -->
      <section id="testimonials" class="testimonials-section relative z-10">
        <div class="container">
          <div class="section-header reveal-on-scroll">
            <h2 class="section-title">创作者之声</h2>
            <p class="section-subtitle">来自全球先锋设计师、商业摄影师与创意总监的真实反馈</p>
          </div>
        </div>
        
        <div class="testimonials-container reveal-on-scroll" style="transition-delay: 0.1s">
          <div class="testimonials-track">
            <div class="testimonials-group">
              <div class="testimonial-card" v-for="t in testimonials" :key="t.id">
                <div class="quote-icon">"</div>
                <p class="t-content">{{ t.content }}</p>
                <div class="t-author">
                  <div class="t-avatar"><img :src="t.avatar" :alt="t.name" loading="lazy"/></div>
                  <div class="t-info">
                    <h4 class="t-name">{{ t.name }}</h4>
                    <span class="t-role">{{ t.role }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="testimonials-group" aria-hidden="true">
              <div class="testimonial-card" v-for="t in testimonials" :key="'dup-'+t.id">
                <div class="quote-icon">"</div>
                <p class="t-content">{{ t.content }}</p>
                <div class="t-author">
                  <div class="t-avatar"><img :src="t.avatar" :alt="t.name" loading="lazy"/></div>
                  <div class="t-info">
                    <h4 class="t-name">{{ t.name }}</h4>
                    <span class="t-role">{{ t.role }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Pricing Section -->
      <section id="pricing" class="pricing-section relative z-10">
        <div class="container">
          <div class="section-header reveal-on-scroll">
            <h2 class="section-title">灵活的订阅方案</h2>
            <p class="section-subtitle">提供阶梯化算力支持，伴随您的个人创作与团队业务共同成长</p>
          </div>
          
          <div class="pricing-grid reveal-on-scroll" style="transition-delay: 0.1s">
            <div class="pricing-card">
              <h3 class="plan-name">探索版</h3>
              <div class="plan-price">免费<span>/永久</span></div>
              <p class="plan-desc">适合初次体验 AI 创作与轻度爱好者</p>
              <ul class="plan-features">
                <li><SparklesIcon :size="16" class="check-icon" /> 每日 10 次基础算力生成</li>
                <li><SparklesIcon :size="16" class="check-icon" /> 标准分辨率图像输出</li>
                <li><SparklesIcon :size="16" class="check-icon" /> 社区灵感库完全访问</li>
                <li><SparklesIcon :size="16" class="check-icon" /> 基础工具链支持</li>
              </ul>
              <LinkButton to="/login" variant="outline" class="btn-plan w-full mt-auto">免费开启</LinkButton>
            </div>
            
            <div class="pricing-card popular">
              <div class="popular-badge">创作者首选</div>
              <h3 class="plan-name">专业版</h3>
              <div class="plan-price">¥99<span>/月</span></div>
              <p class="plan-desc">为专业设计师与视觉工作者提供无尽火力</p>
              <ul class="plan-features">
                <li><SparklesIcon :size="16" class="check-icon" /> 尊享无限次极速生成队列</li>
                <li><SparklesIcon :size="16" class="check-icon" /> 4K 电影级高清放大权益</li>
                <li><SparklesIcon :size="16" class="check-icon" /> 生成资产 100% 商用授权</li>
                <li><SparklesIcon :size="16" class="check-icon" /> 优先体验前沿实验性模型</li>
              </ul>
              <LinkButton to="/login" class="btn-plan cyber-glow w-full mt-auto">升级专业版</LinkButton>
            </div>
            
            <div class="pricing-card">
              <h3 class="plan-name">企业版</h3>
              <div class="plan-price">定制方案</div>
              <p class="plan-desc">为企业级团队提供私有化与高并发解决方案</p>
              <ul class="plan-features">
                <li><SparklesIcon :size="16" class="check-icon" /> 专属独立算力节点与 SLA 保证</li>
                <li><SparklesIcon :size="16" class="check-icon" /> 团队多席位与资产协同管理</li>
                <li><SparklesIcon :size="16" class="check-icon" /> 高并发 RESTful API 接入</li>
                <li><SparklesIcon :size="16" class="check-icon" /> 专属客户成功经理 1v1 支持</li>
              </ul>
              <LinkButton to="/login" variant="outline" class="btn-plan w-full mt-auto">联系销售</LinkButton>
            </div>
          </div>
        </div>
      </section>

      <!-- FAQ Section (New Module) -->
      <section id="faq" class="faq-section relative z-10">
        <div class="container max-w-4xl">
          <div class="section-header reveal-on-scroll">
            <h2 class="section-title">常见问题</h2>
            <p class="section-subtitle">解决您在使用过程中的所有疑问</p>
          </div>
          
          <div class="faq-list reveal-on-scroll" style="transition-delay: 0.1s">
            <div 
              v-for="(item, i) in faqs" 
              :key="i" 
              class="faq-item" 
              :class="{ active: activeFaq === i }"
              @click="toggleFaq(i)"
            >
              <div class="faq-q">
                <span>{{ item.q }}</span>
                <ChevronDownIcon class="faq-icon" :class="{ 'rotate-180': activeFaq === i }" />
              </div>
              <div class="faq-a-wrapper" :style="{ maxHeight: activeFaq === i ? '200px' : '0' }">
                <div class="faq-a">{{ item.a }}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Bottom CTA -->
      <section class="cta-section relative z-10">
        <div class="cta-bg-glow"></div>
        <div class="container text-center relative z-10 reveal-on-scroll">
          <h2 class="cta-title">现在开始您的 AI 绘画之旅</h2>
          <p class="cta-subtitle">加入数万名创作者，即刻获取您的专属图像生成额度。</p>
          <LinkButton :to="isAuthenticated ? '/studio' : '/login'" class="btn-mega cyber-glow mt-10 inline-flex items-center">
            免费体验作图
            <ArrowRightIcon :size="20" class="ml-2 landing-button-arrow" />
          </LinkButton>
        </div>
      </section>

      <footer class="footer rich-footer relative z-10">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-col brand-col">
              <div class="brand light-brand mb-6">
                <div class="brand-icon">
                  <img :src="logoUrl" alt="Hi AI Image Studio logo" width="24" height="24" loading="lazy" />
                </div>
                <span>{{ siteSettings.siteName }}</span>
              </div>
              <p class="footer-desc">面向先锋团队与个人的下一代 AI 图像生成平台。融合最前沿模型，降低创作门槛，让每个人都能轻松输出高品质视觉大片。</p>
            </div>
            <div class="footer-col">
              <h4 class="footer-heading">核心功能</h4>
              <a href="#" class="footer-link">文字生成图片</a>
              <a href="#" class="footer-link">图片重绘与扩图</a>
              <a href="#" class="footer-link">AI 高清无损放大</a>
              <a href="#" class="footer-link">海量灵感提示词库</a>
            </div>
            <div class="footer-col">
              <h4 class="footer-heading">资源支持</h4>
              <a href="#" class="footer-link">官方使用文档</a>
              <a href="#" class="footer-link">Prompt 编写指南</a>
              <a href="#" class="footer-link">创作者社区</a>
              <a href="#" class="footer-link">系统更新日志</a>
            </div>
            <div class="footer-col">
              <h4 class="footer-heading">生态伙伴</h4>
              <a href="https://hiapis.cloud/" target="_blank" rel="noopener noreferrer" class="footer-link">HiAPIs 云服务</a>
              <a href="#" class="footer-link">加入合伙人计划</a>
            </div>
          </div>
          <div class="footer-bottom">
            <div class="footer-meta">{{ siteSettings.footerCopyright }} · All rights reserved.</div>
            <div class="footer-legal">
              <a href="#" class="footer-link-small">隐私政策</a>
              <a href="#" class="footer-link-small">服务条款</a>
              <a href="#" class="footer-link-small">Cookie 政策</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { SparklesIcon, ArrowRightIcon, ZapIcon, LayoutIcon, LibraryIcon, SearchIcon, GlobeIcon, CpuIcon, LayersIcon, Wand2Icon, ImageIcon, HexagonIcon, ImagePlusIcon, CropIcon, MaximizeIcon, ChevronDownIcon } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useSiteStore } from '../stores/site'
import { LinkButton } from '../components/common'
import logoUrl from '../hi-image-logo.png'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const siteStore = useSiteStore()
const router = useRouter()

const isAuthenticated = computed(() => !!authStore.user)
const siteSettings = computed(() => siteStore.settings)

const isScrolled = ref(false)
const isPaused1 = ref(false)
const isPaused2 = ref(false)
const observer = ref(null)

const placeholders = [
  "输入提示词，例如：一杯放在霓虹灯下的赛博朋克风咖啡...",
  "尝试输入：极简风格的白色陶瓷产品展示，高级光影...",
  "或者输入：3D 盲盒公仔，可爱风格，Octane 渲染...",
  "也可以输入：电影感街景，雨夜，霓虹反射，8k 分辨率..."
]
const currentPlaceholder = ref("")
let placeholderIndex = 0
let charIndex = 0
let isDeleting = false
let typingTimeout

const typeEffect = () => {
  const fullText = placeholders[placeholderIndex]
  
  if (isDeleting) {
    currentPlaceholder.value = fullText.substring(0, charIndex - 1)
    charIndex--
  } else {
    currentPlaceholder.value = fullText.substring(0, charIndex + 1)
    charIndex++
  }

  let typeSpeed = isDeleting ? 30 : 80

  if (!isDeleting && charIndex === fullText.length) {
    typeSpeed = 2000 // Pause at end
    isDeleting = true
  } else if (isDeleting && charIndex === 0) {
    isDeleting = false
    placeholderIndex = (placeholderIndex + 1) % placeholders.length
    typeSpeed = 500 // Pause before starting new word
  }

  typingTimeout = setTimeout(typeEffect, typeSpeed)
}

const handleScroll = () => {
  isScrolled.value = window.scrollY > 50
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const handleMouseMove = (e) => {
  const rect = e.currentTarget.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  e.currentTarget.style.setProperty('--mouse-x', `${x}px`)
  e.currentTarget.style.setProperty('--mouse-y', `${y}px`)
}

const handleSearch = () => {
  if (!isAuthenticated.value) {
    router.push('/login')
  } else {
    router.push('/studio')
  }
}

// FAQ Logic
const activeFaq = ref(0)
const toggleFaq = (index) => {
  activeFaq.value = activeFaq.value === index ? -1 : index
}

const faqs = [
  { q: '生成的图片可以用于商业用途吗？', a: '可以。专业版及企业版用户生成的所有图片均包含完整的商业使用授权，您可将其直接用于产品设计、广告投放、商品包装、社交媒体等各类商业场景，无需额外支付版权费用。' },
  { q: '平台是否支持团队协作与资产共享？', a: '支持。我们为企业版用户提供完善的团队工作区功能，支持多人实时协作、提示词（Prompt）与种子参数资产库共享，以及统一的算力额度与成员权限管理。' },
  { q: '如何保证生成的图像质量与人物一致性？', a: '我们的核心引擎内置了先进的风格控制与特征保持技术（包含 ControlNet 结构控制与 Reference Only 风格迁移）。您可以通过上传参考图来精准锁定生成结果的光影、构图、风格甚至特定人物特征。' },
  { q: '平台提供 API 接入能力吗？', a: '提供。我们为开发者与企业客户开放高并发、低延迟的 RESTful API 服务，方便您将业界顶尖的图像生成、重绘与超分能力无缝集成到自有产品矩阵或内部工作流中。' }
]

onMounted(() => {
  siteStore.fetchSettings()
  window.addEventListener('scroll', handleScroll)
  typeEffect()
  
  // Setup Intersection Observer for scroll animations
  observer.value = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed')
        // Optional: stop observing once revealed
        observer.value.unobserve(entry.target)
      }
    })
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  })

  // Observe elements
  document.querySelectorAll('.reveal-on-scroll').forEach(el => {
    observer.value.observe(el)
  })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  clearTimeout(typingTimeout)
  if (observer.value) observer.value.disconnect()
})

// High-end Showcase Data
const marqueeImages1 = [
  { id: 1, url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop', prompt: 'Abstract 3D liquid shapes, neon lighting, cinematic...' },
  { id: 2, url: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?q=80&w=600&auto=format&fit=crop', prompt: 'Cyberpunk city street, rain, neon signs, 8k resolution...' },
  { id: 3, url: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=600&auto=format&fit=crop', prompt: 'Vaporwave aesthetic, glowing grids, retro synthwave...' },
  { id: 4, url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=600&auto=format&fit=crop', prompt: 'Tech startup desk, aesthetic lighting, shallow depth...' },
  { id: 5, url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop', prompt: 'Fashion editorial, studio lighting, vivid colors...' },
]

const marqueeImages2 = [
  { id: 6, url: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?q=80&w=600&auto=format&fit=crop', prompt: 'Anime style, glowing Tokyo street, highly detailed...' },
  { id: 7, url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=600&auto=format&fit=crop', prompt: 'Product photography, floating headphones, minimal...' },
  { id: 8, url: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=600&auto=format&fit=crop', prompt: '3D geometric abstract background, metallic texture...' },
  { id: 9, url: 'https://images.unsplash.com/photo-1581822261290-991b38693d1b?q=80&w=600&auto=format&fit=crop', prompt: 'Futuristic vehicle concept, studio render, dramatic...' },
  { id: 10, url: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?q=80&w=600&auto=format&fit=crop', prompt: 'Neon portrait photography, cyber aesthetic...' },
]

const scenarios = [
  { id: 1, title: '电商产品视觉', desc: '上传白底图，一键生成契合品牌调性的高级产品主图与营销海报', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=800&auto=format&fit=crop' },
  { id: 2, title: '游戏资产构建', desc: '以极高效率产出原画概念、角色设定、场景气氛图与 3D 资产参考', image: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?q=80&w=800&auto=format&fit=crop' },
  { id: 3, title: '建筑与空间设计', desc: '将线稿或体块草图迅速转化为超写实的室内外效果图与漫游基底', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=800&auto=format&fit=crop' },
  { id: 4, title: '影视分镜创意', desc: '精准控制电影级光影与构图，为导演与策划团队快速呈现视觉脚本', image: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?q=80&w=800&auto=format&fit=crop' },
]

const testimonials = [
  { id: 1, name: 'Alex Chen', role: 'Art Director @NovaDesign', content: '这是我用过最具商业生产力的 AI 视觉工具。它的光影控制和材质推断能力达到了惊人的高度，直接将我们的前期视觉探索时间缩短了 80%。', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=100&auto=format&fit=crop' },
  { id: 2, name: 'Sarah Jenkins', role: 'Senior Concept Artist', content: '模型对复杂提示词的语义理解非常精准。我特别喜欢它的局部重绘功能，过渡极其自然，这在处理高精度的游戏资产时是不可或缺的。', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=100&auto=format&fit=crop' },
  { id: 3, name: 'David Kim', role: 'Founder @Lumina Studio', content: '放弃了其他繁琐的本地部署方案，团队全面迁移到了这里。不仅推理速度极快，而且生成的图像默认具备极高的审美下限，出片率极高。', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop' },
  { id: 4, name: 'Elena Rostova', role: 'Commercial Photographer', content: '作为摄影师，我最初对 AI 是持怀疑态度的。但这里的图生图和光影重构功能彻底改变了我的工作流，它成为了我最好的视觉扩展助手。', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=format&fit=crop' },
  { id: 5, name: 'Michael Chang', role: 'Product Designer', content: 'API 接入非常丝滑，我们已经将它的生成能力深度集成到了内部系统中。稳定、高并发，且每次输出的视觉质量都远超预期。', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=100&auto=format&fit=crop' }
]
</script>

<style scoped>
.landing-view {
  position: relative;
  background:
    radial-gradient(circle at top center, rgba(99, 102, 241, 0.08), transparent 28%),
    linear-gradient(180deg, #fcfdff 0%, #f8fafc 38%, #ffffff 100%);
  min-height: 100vh;
  color: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  overflow-x: hidden;
}

/* Global Cyber/Tech Grid Background */
.cyber-grid-bg {
  background-image: 
    linear-gradient(rgba(15, 23, 42, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 23, 42, 0.025) 1px, transparent 1px);
  background-size: 80px 80px;
  background-position: center center;
}

/* Hero Elements - Aurora High End */
.hero-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 110vh;
  z-index: 0;
  overflow: hidden;
  background: #f8fafc;
}

.hero-bg-image {
  position: absolute;
  inset: 0;
  background-image: url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2560&auto=format&fit=crop');
  background-size: cover;
  background-position: center;
  opacity: 0.08;
  mix-blend-mode: soft-light;
  z-index: 1;
}

.aurora-container {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
  filter: blur(100px);
  opacity: 0.55;
  z-index: 1;
}

.aurora-orb {
  position: absolute;
  border-radius: 50%;
  animation: floatOrb 20s infinite alternate ease-in-out;
}

.orb-1 {
  width: 60vw;
  height: 60vw;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.28) 0%, transparent 70%);
  top: -20%;
  left: -10%;
  animation-delay: 0s;
}

.orb-2 {
  width: 50vw;
  height: 50vw;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.22) 0%, transparent 70%);
  bottom: -10%;
  right: -10%;
  animation-delay: -5s;
}

.orb-3 {
  width: 40vw;
  height: 40vw;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, transparent 70%);
  top: 40%;
  left: 30%;
  animation-delay: -10s;
}

@keyframes floatOrb {
  0% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(5%, 10%) scale(1.1); }
  66% { transform: translate(-5%, 5%) scale(0.9); }
  100% { transform: translate(10%, -5%) scale(1); }
}

.noise-overlay {
  position: absolute;
  inset: 0;
  background-image: url('data:image/svg+xml,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E');
  opacity: 0.04;
  mix-blend-mode: overlay;
  pointer-events: none;
  z-index: 2;
}

.hero-bg-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top center, rgba(255, 255, 255, 0.35) 0%, transparent 30%),
    radial-gradient(circle at center, transparent 0%, rgba(248, 250, 252, 0.96) 100%),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.12) 0%, rgba(248, 250, 252, 0.74) 62%, #f8fafc 100%);
  z-index: 2;
}

.cyber-grid-overlay {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 23, 42, 0.03) 1px, transparent 1px);
  background-size: 100px 100px;
  z-index: 3;
  mask-image: radial-gradient(ellipse at center, black 20%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 20%, transparent 70%);
  pointer-events: none;
  transform: perspective(500px) rotateX(60deg) scale(2);
  transform-origin: bottom;
  bottom: -50%;
}

/* Header */
.cyber-header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 100;
  padding: 24px 0;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  background: transparent;
  border-bottom: 1px solid transparent;
}

.cyber-header.scrolled {
  padding: 16px 0;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.06);
}

.light-brand {
  color: #0f172a;
  font-weight: 800;
  font-size: 20px;
  letter-spacing: -0.5px;
}

.light-brand .brand-icon {
  background: transparent;
  box-shadow: none;
  padding: 0;
}

.nav-link-subtle {
  color: rgba(15, 23, 42, 0.6);
  transition: all 0.3s ease;
  text-decoration: none;
  font-size: 15px;
  position: relative;
}
.nav-link-subtle:hover {
  color: #0f172a;
}
.nav-link-subtle::after {
  content: '';
  position: absolute;
  width: 0;
  height: 2px;
  bottom: -4px;
  left: 0;
  background: var(--gradient-primary);
  transition: width 0.3s ease;
  border-radius: 2px;
}
.nav-link-subtle:hover::after {
  width: 100%;
}

.nav-link {
  color: rgba(15, 23, 42, 0.8);
  font-weight: 500;
  transition: color 0.2s;
}
.nav-link:hover {
  color: #0f172a;
  background: transparent;
}

.nav-btn {
  height: 44px;
  border-radius: 8px;
  font-weight: 600;
  padding: 0 24px;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
}

.landing-button-arrow {
  color: #fff;
  stroke: #fff;
  flex-shrink: 0;
}

.cyber-glow {
  background: var(--gradient-primary, linear-gradient(135deg, #6366f1 0%, #4338ca 100%));
  color: #fff;
  border: none;
  box-shadow: 0 12px 28px rgba(99, 102, 241, 0.24);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.cyber-glow:hover {
  box-shadow: 0 18px 36px rgba(99, 102, 241, 0.3);
  transform: translateY(-2px);
}

/* Hero Section */
.full-height {
  min-height: 100vh;
  padding-top: 100px; 
}

.hero-content {
  max-width: 1000px;
  margin: 0 auto;
  text-align: center;
}

/* Badge */
.badge-wrapper {
  display: inline-block;
  margin-bottom: 32px;
  padding: 1px;
  background: linear-gradient(90deg, rgba(15,23,42,0.05), rgba(15,23,42,0.15), rgba(15,23,42,0.05));
  border-radius: 100px;
}

.badge-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-radius: 100px;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: 0.05em;
  border: 1px solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
}
.badge-icon {
  color: #6366f1;
}

.hero-title {
  font-size: clamp(48px, 8vw, 110px);
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: -0.04em;
  color: #0f172a;
  margin-bottom: 32px;
}

.text-gradient {
  background: linear-gradient(135deg, #0f172a 0%, #4338ca 50%, #6366f1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: inline-block;
}

.hero-subtitle {
  font-size: clamp(18px, 2.5vw, 24px);
  color: rgba(15,23,42,0.64);
  line-height: 1.6;
  max-width: 780px;
  margin: 0 auto 64px;
  font-weight: 400;
}

/* Advanced Search Bar with Typewriter */
.hero-search-wrapper {
  max-width: 860px;
  margin: 0 auto;
}

.cyber-search {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 100px;
  padding: 8px 8px 8px 32px;
  width: 100%;
  margin-bottom: 24px;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: text;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
}

.cyber-search:hover {
  background: rgba(255, 255, 255, 0.96);
  border-color: rgba(99, 102, 241, 0.28);
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.1), 0 12px 32px rgba(99, 102, 241, 0.08);
}

.icon-search {
  color: rgba(15, 23, 42, 0.5);
  margin-right: 16px;
}

.typewriter-text {
  flex: 1;
  text-align: left;
  font-size: 18px;
  color: rgba(15, 23, 42, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cursor {
  display: inline-block;
  width: 2px;
  height: 20px;
  background-color: #6366f1;
  vertical-align: middle;
  margin-left: 2px;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.btn-generate {
  height: 64px;
  border-radius: 100px;
  padding: 0 48px;
  font-size: 18px;
  font-weight: 700;
  background: var(--gradient-primary, linear-gradient(135deg, #6366f1 0%, #a855f7 100%));
  color: #fff;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
}

.btn-generate:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 30px rgba(99, 102, 241, 0.5);
}

/* Trending Tags */
.trending-tags {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 14px;
}

.tag-label {
  color: rgba(15, 23, 42, 0.5);
  font-weight: 500;
}

.tag {
  color: rgba(15, 23, 42, 0.8);
  background: rgba(255, 255, 255, 0.72);
  padding: 8px 16px;
  border-radius: 100px;
  text-decoration: none;
  transition: all 0.2s ease;
  border: 1px solid rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(10px);
}

.tag:hover {
  background: #ffffff;
  border-color: rgba(99, 102, 241, 0.18);
  color: #0f172a;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
}

/* Trusted Section */
.trusted-section {
  padding: 80px 0;
  border-top: 1px solid rgba(15,23,42,0.04);
  border-bottom: 1px solid rgba(15,23,42,0.05);
  background: linear-gradient(to bottom, rgba(255,255,255,0.55), rgba(248,250,252,0.85));
}
.trusted-label {
  color: rgba(15,23,42,0.4);
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 40px;
  font-weight: 600;
}
.logo-cloud {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 80px;
  flex-wrap: wrap;
  opacity: 0.62;
  transition: opacity 0.3s;
}
.logo-cloud:hover {
  opacity: 0.9;
}
.mock-logo-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(15,23,42,0.6);
}
.mock-logo-text {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* Animations */
.animate-fade-up {
  animation: fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.animate-fade-up-delay-1 {
  animation: fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
}
.animate-fade-up-delay-2 {
  animation: fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
}
.animate-fade-up-delay-3 {
  animation: fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Scroll Reveal */
.reveal-on-scroll {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal-on-scroll.is-revealed {
  opacity: 1;
  transform: translateY(0);
}

/* Core Capabilities Section */
.capabilities-section {
  padding: 140px 0 60px;
}

.cap-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
  margin-top: 60px;
}

.cap-card {
  position: relative;
  background: linear-gradient(145deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.72) 100%);
  border: 1px solid rgba(15,23,42,0.07);
  border-radius: 24px;
  padding: 40px 32px;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  backdrop-filter: blur(20px);
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.04);
}

/* Spotlight Effect */
.cap-card::before,
.bento-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(600px circle at var(--mouse-x, 0) var(--mouse-y, 0), rgba(99, 102, 241, 0.05), transparent 40%);
  z-index: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s;
}

.cap-card:hover::before,
.bento-card:hover::before {
  opacity: 1;
}

.cap-content-wrap,
.bento-content-wrap {
  position: relative;
  z-index: 1;
}

.cap-card:hover {
  transform: translateY(-8px);
  border-color: rgba(99, 102, 241, 0.2);
  box-shadow: 0 24px 52px rgba(15, 23, 42, 0.08);
  background: linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.82) 100%);
}

.cap-icon-wrap {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: rgba(15,23,42,0.03);
  border: 1px solid rgba(15,23,42,0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  color: #0f172a;
  transition: all 0.3s;
}

.cap-card:hover .cap-icon-wrap {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
  color: #6366f1;
  box-shadow: 0 0 30px rgba(99, 102, 241, 0.1);
  transform: scale(1.05);
}

.cap-title {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cap-subtitle {
  font-size: 13px;
  color: #6366f1;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.cap-desc {
  font-size: 15px;
  line-height: 1.7;
  color: rgba(15,23,42,0.6);
}

/* Marquee Section */
.marquee-section {
  padding: 120px 0;
  overflow: hidden;
}

.marquee-container {
  display: flex;
  width: 100vw;
  overflow: hidden;
  position: relative;
}

/* Gradient fade masks for marquee */
.marquee-container::before,
.marquee-container::after {
  content: "";
  position: absolute;
  top: 0;
  width: 20vw;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}
.marquee-container::before {
  left: 0;
  background: linear-gradient(to right, #f8fafc, transparent);
}
.marquee-container::after {
  right: 0;
  background: linear-gradient(to left, #f8fafc, transparent);
}

.marquee-track {
  display: flex;
  width: max-content;
  gap: 24px;
  padding: 0 12px;
}

.track-left {
  animation: scrollLeft 70s linear infinite;
}
.track-right {
  animation: scrollRight 70s linear infinite;
}

.marquee-group {
  display: flex;
  gap: 24px;
}

.marquee-item {
  position: relative;
  width: 450px;
  height: 300px;
  border-radius: 24px;
  overflow: hidden;
  cursor: pointer;
  background: #f1f5f9;
  flex-shrink: 0;
  border: 1px solid rgba(15,23,42,0.05);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.08);
}

.marquee-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

.marquee-item:hover img {
  transform: scale(1.08);
}

.item-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.28) 52%, rgba(15,23,42,0.06) 100%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-start;
  padding: 40px 32px;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.marquee-item:hover .item-overlay {
  opacity: 1;
}

.item-prompt {
  color: #fff;
  font-size: 16px;
  line-height: 1.6;
  margin-bottom: 24px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-shadow: 0 2px 4px rgba(0,0,0,0.8);
}

.btn-try {
  background: rgba(255,255,255,0.18);
  backdrop-filter: blur(10px);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.28);
  padding: 12px 28px;
  border-radius: 100px;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-try:hover {
  background: var(--gradient-primary, linear-gradient(135deg, #6366f1 0%, #a855f7 100%));
  color: #fff;
  border-color: transparent;
  box-shadow: 0 10px 20px rgba(99, 102, 241, 0.4);
}

@keyframes scrollLeft {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes scrollRight {
  0% { transform: translateX(-50%); }
  100% { transform: translateX(0); }
}

/* Bento Box Section */
.bento-section {
  padding: 120px 0;
}

.section-header {
  text-align: center;
  margin-bottom: 80px;
}

.section-title {
  font-size: clamp(36px, 5vw, 56px);
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 20px;
  letter-spacing: -0.03em;
}

.section-subtitle {
  font-size: 20px;
  color: rgba(15,23,42,0.6);
  max-width: 700px;
  margin: 0 auto;
}

.bento-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: 440px;
  gap: 24px;
}

.bento-card {
  position: relative;
  background: linear-gradient(145deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.72) 100%);
  border: 1px solid rgba(15,23,42,0.07);
  border-radius: 32px;
  padding: 48px;
  overflow: hidden;
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  backdrop-filter: blur(20px);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.04);
}

.bento-large {
  grid-column: span 2;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 0 48px;
}

.bento-card:hover {
  border-color: rgba(99, 102, 241, 0.18);
  transform: translateY(-4px);
  box-shadow: 0 28px 64px rgba(15, 23, 42, 0.08);
}

.bento-glow {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.05), transparent 50%);
  opacity: 0;
  transition: opacity 0.5s ease;
  pointer-events: none;
}

.bento-card:hover .bento-glow {
  opacity: 1;
}

.bento-content {
  position: relative;
  z-index: 2;
  max-width: 320px;
}
.bento-large .bento-content {
  max-width: 380px;
  padding-right: 40px;
}

.bento-icon-wrap {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: rgba(15,23,42,0.03);
  border: 1px solid rgba(15,23,42,0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32px;
  color: #0f172a;
  transition: all 0.3s;
}

.bento-card:hover .bento-icon-wrap {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
  color: #6366f1;
  box-shadow: 0 0 30px rgba(99, 102, 241, 0.1);
}

.bento-title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 16px;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.bento-desc {
  font-size: 16px;
  line-height: 1.7;
  color: rgba(15,23,42,0.6);
}

.bento-image-wrapper {
  flex: 1;
  height: 100%;
  position: relative;
  overflow: hidden;
  border-radius: 0 32px 32px 0;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bento-mock-ui {
  width: 80%;
  height: 70%;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid rgba(15,23,42,0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0,0,0,0.05);
}

.mock-header {
  height: 40px;
  border-bottom: 1px solid rgba(15,23,42,0.1);
  background: rgba(15,23,42,0.02);
}

.mock-body {
  flex: 1;
  padding: 20px;
  display: flex;
  gap: 16px;
}

.mock-img-placeholder {
  flex: 1;
  border-radius: 8px;
  background: rgba(15,23,42,0.05);
}

.skeleton-anim {
  position: relative;
  overflow: hidden;
}
.skeleton-anim::after {
  content: '';
  position: absolute;
  top: 0; left: -100%; width: 50%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(15,23,42,0.05), transparent);
  animation: skeleton 2s infinite;
}
.delay-1::after { animation-delay: 0.5s; }

@keyframes skeleton {
  100% { left: 200%; }
}

/* Scenarios Section */
.scenarios-section {
  padding: 120px 0;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
}

.scenarios-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  height: 500px;
}

.scenario-card {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid rgba(15,23,42,0.06);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
}

.scenario-card:hover {
  transform: translateY(-10px);
  border-color: rgba(99, 102, 241, 0.22);
  box-shadow: 0 26px 56px rgba(15, 23, 42, 0.1);
}

.scenario-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  filter: saturate(0.92) contrast(1.02);
}

.scenario-card:hover .scenario-img {
  transform: scale(1.1);
  filter: saturate(1.02) contrast(1.04);
}

.scenario-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.32) 55%, rgba(15,23,42,0.08) 100%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 40px 30px;
  transition: all 0.4s ease;
}

.scenario-title {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 12px;
  transform: translateY(20px);
  transition: transform 0.4s ease;
}

.scenario-desc {
  font-size: 15px;
  color: rgba(255,255,255,0.74);
  line-height: 1.6;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.4s ease;
  margin-bottom: 20px;
}

.scenario-action {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #c7d2fe;
  font-weight: 600;
  font-size: 15px;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.4s ease 0.1s;
}

.scenario-card:hover .scenario-title,
.scenario-card:hover .scenario-desc,
.scenario-card:hover .scenario-action {
  transform: translateY(0);
  opacity: 1;
}

/* Workflow Section */
.workflow-section {
  padding: 160px 0;
  background: linear-gradient(to bottom, #f8fafc, #ffffff, #f8fafc);
}

.workflow-grid {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  max-width: 1100px;
  margin: 0 auto;
}

.step-card {
  flex: 1;
  text-align: center;
  padding: 0 20px;
  position: relative;
}

.step-icon-container {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15,23,42,0.03);
  border-radius: 50%;
  border: 1px solid rgba(15,23,42,0.05);
}

.step-number {
  font-size: 48px;
  font-weight: 900;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
  position: relative;
  z-index: 2;
}

.step-icon-glow {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s;
}

.step-card:hover .step-icon-glow {
  opacity: 1;
}

.step-title {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 16px;
}

.step-desc {
  font-size: 16px;
  color: rgba(15,23,42,0.6);
  line-height: 1.6;
}

.step-connector {
  width: 140px;
  display: flex;
  align-items: center;
  margin-top: 60px;
  position: relative;
}

.connector-line {
  flex: 1;
  height: 2px;
  background: linear-gradient(90deg, rgba(15,23,42,0.1), rgba(99, 102, 241, 0.5), rgba(15,23,42,0.1));
}

.connector-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6366f1;
  box-shadow: 0 0 10px #6366f1;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

/* Testimonials Section */
.testimonials-section {
  padding: 140px 0;
  background: linear-gradient(to bottom, #f8fafc, #ffffff, #f8fafc);
  overflow: hidden;
}

.testimonials-container {
  display: flex;
  width: 100vw;
  overflow: hidden;
  position: relative;
  padding: 40px 0;
}

.testimonials-container::before,
.testimonials-container::after {
  content: "";
  position: absolute;
  top: 0;
  width: 15vw;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}
.testimonials-container::before {
  left: 0;
  background: linear-gradient(to right, #ffffff, transparent);
}
.testimonials-container::after {
  right: 0;
  background: linear-gradient(to left, #ffffff, transparent);
}

.testimonials-track {
  display: flex;
  width: max-content;
  gap: 32px;
  padding: 0 16px;
  animation: scrollLeft 60s linear infinite;
}

.testimonials-track:hover {
  animation-play-state: paused;
}

.testimonials-group {
  display: flex;
  gap: 32px;
}

.testimonial-card {
  position: relative;
  width: 400px;
  background: linear-gradient(145deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.74) 100%);
  border: 1px solid rgba(15,23,42,0.07);
  border-radius: 24px;
  padding: 40px;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(20px);
  transition: all 0.4s ease;
  cursor: default;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.04);
}

.testimonial-card:hover {
  transform: translateY(-8px);
  background: rgba(255, 255, 255, 1);
  border-color: rgba(99, 102, 241, 0.2);
  box-shadow: 0 24px 52px rgba(15, 23, 42, 0.08);
}

.quote-icon {
  font-size: 64px;
  line-height: 1;
  color: rgba(99, 102, 241, 0.1);
  font-family: Georgia, serif;
  position: absolute;
  top: 20px;
  left: 30px;
}

.t-content {
  font-size: 16px;
  line-height: 1.8;
  color: rgba(15, 23, 42, 0.8);
  margin-top: 20px;
  margin-bottom: 32px;
  flex: 1;
  position: relative;
  z-index: 1;
}

.t-author {
  display: flex;
  align-items: center;
  gap: 16px;
}

.t-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid rgba(99, 102, 241, 0.4);
}

.t-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.t-name {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 4px;
}

.t-role {
  font-size: 13px;
  color: rgba(15, 23, 42, 0.5);
}

/* Pricing Section */
.pricing-section {
  padding: 120px 0;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  max-width: 1100px;
  margin: 0 auto;
}

.pricing-card {
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(15,23,42,0.07);
  border-radius: 32px;
  padding: 48px;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: all 0.4s ease;
  backdrop-filter: blur(20px);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.04);
}

.pricing-card:hover {
  border-color: rgba(15,23,42,0.15);
  transform: translateY(-8px);
  box-shadow: 0 24px 52px rgba(15, 23, 42, 0.08);
}

.pricing-card.popular {
  background: linear-gradient(180deg, #ffffff 0%, rgba(246, 247, 255, 0.96) 100%);
  border-color: rgba(99, 102, 241, 0.22);
  box-shadow: 0 28px 64px rgba(15, 23, 42, 0.1), 0 12px 36px rgba(99, 102, 241, 0.08);
}

.popular-badge {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: #fff;
  padding: 6px 16px;
  border-radius: 100px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.plan-name {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 16px;
}

.plan-price {
  font-size: 48px;
  font-weight: 900;
  color: #0f172a;
  margin-bottom: 16px;
}

.plan-price span {
  font-size: 18px;
  color: rgba(15,23,42,0.4);
  font-weight: 500;
}

.plan-desc {
  font-size: 15px;
  color: rgba(15,23,42,0.6);
  margin-bottom: 32px;
  line-height: 1.6;
}

.plan-features {
  list-style: none;
  padding: 0;
  margin: 0 0 40px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.plan-features li {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  color: rgba(15,23,42,0.8);
}

.check-icon {
  color: #6366f1;
}

.btn-plan {
  height: 56px;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* FAQ Section */
.faq-section {
  padding: 120px 0;
  background: #f8fafc;
}

.faq-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.faq-item {
  background: #ffffff;
  border: 1px solid rgba(15,23,42,0.07);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.03);
}

.faq-item:hover {
  background: #f8fafc;
}

.faq-item.active {
  background: #f8fafc;
  border-color: rgba(99, 102, 241, 0.3);
}

.faq-q {
  padding: 24px 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
  user-select: none;
}

.faq-icon {
  color: rgba(15,23,42,0.5);
  transition: transform 0.3s ease;
}

.rotate-180 {
  transform: rotate(180deg);
  color: #6366f1;
}

.faq-a-wrapper {
  overflow: hidden;
  transition: max-height 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.faq-a {
  padding: 0 32px 32px;
  font-size: 16px;
  color: rgba(15,23,42,0.6);
  line-height: 1.7;
}

/* CTA Section */
.cta-section {
  padding: 180px 0;
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
}

.cta-bg-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80vw;
  height: 80vw;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 60%);
  pointer-events: none;
}

.cta-section .container {
  max-width: 1100px;
  padding: 72px 48px;
  border-radius: 36px;
  border: 1px solid rgba(15,23,42,0.06);
  background: linear-gradient(145deg, rgba(255,255,255,0.88) 0%, rgba(248,250,252,0.96) 100%);
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(20px);
}

.cta-title {
  font-size: clamp(36px, 5vw, 64px);
  font-weight: 900;
  color: #0f172a;
  letter-spacing: -0.03em;
  margin-bottom: 24px;
}

.cta-subtitle {
  font-size: 24px;
  color: rgba(15,23,42,0.6);
}

.btn-mega {
  height: 68px;
  padding: 0 56px;
  font-size: 18px;
  border-radius: 100px;
}

/* Rich Footer */
.rich-footer {
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border-top: 1px solid rgba(15,23,42,0.05);
  padding: 100px 0 40px;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 60px;
  margin-bottom: 80px;
}

.brand-col {
  padding-right: 40px;
}

.footer-desc {
  color: rgba(15,23,42,0.4);
  font-size: 15px;
  line-height: 1.6;
}

.footer-heading {
  color: #0f172a;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 24px;
  letter-spacing: 0.05em;
}

.footer-link {
  display: block;
  color: rgba(15,23,42,0.5);
  margin-bottom: 16px;
  font-size: 15px;
  transition: color 0.2s;
  text-decoration: none;
}
.footer-link:hover {
  color: #0f172a;
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 40px;
  border-top: 1px solid rgba(15,23,42,0.05);
}

.footer-meta {
  color: rgba(15,23,42,0.4);
  font-size: 14px;
}

.footer-legal {
  display: flex;
  gap: 24px;
}

.footer-link-small {
  color: rgba(15,23,42,0.4);
  font-size: 14px;
  text-decoration: none;
  transition: color 0.2s;
}
.footer-link-small:hover {
  color: #0f172a;
}

@media (max-width: 1024px) {
  .cap-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .bento-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }
  .bento-large {
    grid-column: span 1;
    flex-direction: column;
    padding: 40px;
  }
  .bento-large .bento-content-wrap {
    flex-direction: column;
  }
  .bento-large .bento-content {
    max-width: 100%;
    padding-right: 0;
    margin-bottom: 40px;
  }
  .bento-image-wrapper {
    width: 100%;
    height: 300px;
    border-radius: 20px;
  }
  .scenarios-grid {
    grid-template-columns: repeat(2, 1fr);
    height: auto;
  }
  .scenario-card {
    height: 300px;
  }
  .workflow-grid {
    flex-direction: column;
    align-items: center;
    gap: 60px;
  }
  .step-connector {
    width: 1px;
    height: 60px;
    background: linear-gradient(180deg, transparent, rgba(15,23,42,0.1), transparent);
    margin: 0;
  }
  .connector-dot {
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  .pricing-grid {
    grid-template-columns: 1fr;
    max-width: 500px;
  }
  .footer-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 768px) {
  .hero-search-bar {
    flex-direction: column;
    padding: 16px;
    border-radius: 24px;
    gap: 16px;
  }
  .icon-search {
    display: none;
  }
  .typewriter-text {
    width: 100%;
    text-align: center;
    white-space: normal;
  }
  .btn-generate {
    width: 100%;
    justify-content: center;
  }
  .cap-grid {
    grid-template-columns: 1fr;
  }
  .scenarios-grid {
    grid-template-columns: 1fr;
  }
  .footer-grid {
    grid-template-columns: 1fr;
    gap: 40px;
  }
  .footer-bottom {
    flex-direction: column;
    gap: 20px;
    text-align: center;
  }
}
</style>
