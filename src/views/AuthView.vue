<template>
  <div class="auth-layout relative">
    <div class="bg-shape shape-1"></div>
    <div class="bg-shape shape-2"></div>

    <div class="auth-container relative z-10">
      
      <!-- Left side visual area -->
      <div class="auth-left">
        <!-- Abstract Illustration Background -->
        <div class="abstract-visual">
          <div class="glow-orb orb-1"></div>
          <div class="glow-orb orb-2"></div>
          <div class="glow-orb orb-3"></div>
          <div class="grid-overlay"></div>
        </div>

        <div class="brand auth-brand relative z-10 text-white">
          <div class="brand-icon">
            <img :src="logoUrl" alt="Hi AI Image Studio logo" width="20" height="20" loading="eager" fetchpriority="high" />
          </div>
          <span class="text-h3" style="font-weight: 800; font-size: 22px; letter-spacing: -0.5px; color: #fff;">{{ siteSettings.siteName }}</span>
        </div>
        
        <div class="auth-hero-copy relative z-10" style="max-width: 440px;">
          <div class="badge-wrapper auth-badge-space">
            <div class="badge-content" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: #fff;">
              <SparklesIcon :size="14" class="badge-icon" />
              <span>Professional Design Power</span>
            </div>
          </div>
          <h2 class="text-h1 auth-hero-title" style="font-size: 38px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; line-height: 1.3;">
            把一句想法，<br/>变成可以直接使用的<br/>商业图片。
          </h2>
          <div style="width: 40px; height: 4px; background: var(--gradient-primary); margin-bottom: 24px; border-radius: 2px;"></div>
          <p style="line-height: 1.7; font-size: 16px; color: rgba(255,255,255,0.7);">
            面向内容创作者、电商卖家和个人品牌，快速生成海报、封面、商品图与灵感视觉，让设计生产更高效。
          </p>
        </div>

        <div class="features-row auth-features relative z-10">
          <div class="f-item">
            <div class="f-icon"><ZapIcon :size="16" aria-hidden="true" /></div>
            <div>
              <div class="f-title">极速出图</div>
              <div class="f-desc">gpt-image-2模型支持</div>
            </div>
          </div>
          <div class="f-item">
            <div class="f-icon"><LayoutIcon :size="16" aria-hidden="true" /></div>
            <div>
              <div class="f-title">多比例适配</div>
              <div class="f-desc">主流社交平台尺寸</div>
            </div>
          </div>
          <div class="f-item">
            <div class="f-icon"><LibraryIcon :size="16" aria-hidden="true" /></div>
            <div>
              <div class="f-title">灵感管理</div>
              <div class="f-desc">自动保存随时回溯</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right side form area -->
      <div class="auth-right auth-form-panel">
        <div class="auth-title-block">
          <h2 class="text-h3 mb-3" style="font-size: 28px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
            {{ mode === 'login' ? '欢迎回来 👋' : '创建账户 ✨' }}
          </h2>
          <p class="text-muted" style="font-size: 14px;">
            {{ mode === 'login' ? `登录你的 ${siteSettings.siteName} 账户，继续你的 AI 创造之旅` : '加入我们，开启智能设计新体验' }}
          </p>
          <div v-if="verifyBanner" class="verify-banner">
            <AlertCircleIcon :size="16" aria-hidden="true" />
            <span>{{ verifyBanner }}</span>
          </div>
        </div>

        <form @submit.prevent="submitAuth" class="auth-form flex-col" style="flex: 1; display: flex;">
          <div class="auth-field">
            <label for="username" class="label" style="font-size: 13px; font-weight: 700; color: #334155;">{{ mode === 'login' ? '邮箱 / 用户名' : '邮箱' }}</label>
            <div class="input-wrapper">
              <MailIcon class="input-icon" :size="18" aria-hidden="true" />
              <Input
                id="username"
                name="username"
                :autocomplete="mode === 'register' ? 'email' : 'username'"
                spellcheck="false"
                v-model="form.username"
                :type="mode === 'register' ? 'email' : 'text'"
                class="with-icon custom-input"
                required
                maxlength="254"
                :placeholder="mode === 'register' ? '请输入邮箱' : '请输入邮箱或用户名'"
              />
            </div>
            <div v-if="fieldErrors.username" class="field-error">{{ fieldErrors.username }}</div>
          </div>
          <div class="auth-field">
            <label for="password" class="label flex justify-between" style="font-size: 13px; font-weight: 700; color: #334155;">
              密码
            </label>
            <div class="input-wrapper">
              <LockIcon class="input-icon" :size="18" aria-hidden="true" />
              <Input
                id="password"
                name="password"
                autocomplete="current-password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                class="with-icon custom-input"
                required
                minlength="6"
                placeholder="请输入密码"
              />
              <button type="button" class="eye-btn" @click="showPassword = !showPassword" :aria-label="showPassword ? '隐藏密码' : '显示密码'">
                <EyeIcon v-if="!showPassword" :size="18" aria-hidden="true" />
                <EyeOffIcon v-else :size="18" aria-hidden="true" />
              </button>
            </div>
            <div v-if="fieldErrors.password" class="field-error">{{ fieldErrors.password }}</div>
          </div>

          <div class="auth-field" v-if="mode === 'register'">
            <label for="captcha" class="label" style="font-size: 13px; font-weight: 700; color: #334155;">验证码</label>
            <div class="captcha-row">
              <div class="input-wrapper captcha-input">
                <ShieldIcon class="input-icon" :size="18" aria-hidden="true" />
                <Input
                  id="captcha"
                  name="captcha"
                  autocomplete="off"
                  spellcheck="false"
                  v-model="form.captcha"
                  class="with-icon custom-input"
                  required
                  maxlength="8"
                  placeholder="请输入验证码"
                />
              </div>
              <button type="button" class="captcha-image" :disabled="loading" aria-label="刷新验证码" @click="refreshCaptcha">
                <img v-if="captchaSrc" class="captcha-img" :src="captchaSrc" alt="验证码" />
                <span v-else>刷新</span>
              </button>
            </div>
            <div v-if="fieldErrors.captcha" class="field-error">{{ fieldErrors.captcha }}</div>
          </div>

          <div class="auth-field" v-if="mode === 'register'">
            <label for="redeemCode" class="label" style="font-size: 13px; font-weight: 700; color: #334155;">兑换码（选填）</label>
            <div class="input-wrapper">
              <GiftIcon class="input-icon" :size="18" aria-hidden="true" />
              <Input
                id="redeemCode"
                name="redeemCode"
                autocomplete="off"
                spellcheck="false"
                v-model="form.redeemCode"
                class="with-icon custom-input"
                maxlength="32"
                placeholder="有兑换码可直接填写"
              />
            </div>
          </div>

          <div class="auth-options flex justify-between items-center" style="font-size: 13px;" v-if="mode === 'login'">
            <label for="remember" class="flex items-center gap-2 cursor-pointer" style="color: #475569; font-weight: 500;">
              <input id="remember" name="remember" type="checkbox" class="custom-checkbox" /> 记住我
            </label>
            <button type="button" class="btn-link text-primary hover-underline" style="font-weight: 600;">忘记密码?</button>
          </div>

          <Button class="submit-btn" type="submit" :disabled="loading">
            <span v-if="loading" class="spinner" aria-hidden="true"></span>
            {{ loading ? '处理中...' : (mode === 'login' ? '登 录' : '注 册') }}
          </Button>
          
          <div class="divider auth-divider">
            <span>或通过以下方式</span>
          </div>

          <div class="social-login flex gap-4">
            <button type="button" class="social-btn flex-1" aria-label="使用 Google 登录">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            </button>
            <button type="button" class="social-btn flex-1" aria-label="使用 GitHub 登录">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
            </button>
          </div>

          <div v-if="siteSettings.allowRegistration" class="auth-switch text-center" style="font-size: 13px; color: #64748b;">
            {{ mode === 'login' ? '还没有账户？' : '已有账户？' }}
            <button type="button" class="btn-link text-primary hover-underline" style="font-weight: 600;" @click="mode = mode === 'login' ? 'register' : 'login'">
              {{ mode === 'login' ? '立即注册' : '立即登录' }}
            </button>
          </div>
          <div v-else class="auth-switch text-center" style="font-size: 13px; color: #64748b;">
            当前已关闭新用户注册，如需开通请联系 {{ siteSettings.supportContact }}
          </div>
        </form>
      </div>

    </div>
    
    <div class="absolute bottom-6 text-center w-full" style="font-size: 12px; color: rgba(255,255,255,0.6);">
      {{ siteSettings.footerCopyright }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useSiteStore } from '../stores/site'
import { AlertCircleIcon, ZapIcon, LayoutIcon, ShieldIcon, MailIcon, LockIcon, EyeIcon, EyeOffIcon, SparklesIcon, LibraryIcon, GiftIcon } from 'lucide-vue-next'
import { Button, Input, toastError, toastSuccess } from '../components/common'
import { apiFetch } from '../utils/api'
import logoUrl from '../hi-image-logo.png'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const siteStore = useSiteStore()
const siteSettings = computed(() => siteStore.settings)

const mode = ref('login')
const loading = ref(false)
const showPassword = ref(false)
const captchaId = ref('')
const captchaSvg = ref('')
const captchaSrc = computed(() => {
  if (!captchaSvg.value) return ''
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(captchaSvg.value)}`
})
const fieldErrors = reactive({
  username: '',
  password: '',
  captcha: ''
})
const verifyBanner = ref('')

const form = reactive({
  username: '',
  password: '',
  captcha: '',
  redeemCode: ''
})

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function refreshCaptcha() {
  try {
    const data = await apiFetch('/api/captcha', undefined, { toast: false, redirectOn401: false })
    captchaId.value = String(data?.captchaId || '')
    captchaSvg.value = String(data?.svg || '')
    form.captcha = ''
    fieldErrors.captcha = ''
  } catch (e) {
    captchaId.value = ''
    captchaSvg.value = ''
    toastError(e.message || '获取验证码失败')
  }
}

watch(mode, async (next) => {
  fieldErrors.username = ''
  fieldErrors.password = ''
  fieldErrors.captcha = ''

  if (next === 'register') {
    await refreshCaptcha()
  } else {
    captchaId.value = ''
    captchaSvg.value = ''
    form.captcha = ''
  }
})

watch(
  () => siteSettings.value.allowRegistration,
  (allowed) => {
    if (!allowed && mode.value === 'register') {
      mode.value = 'login'
    }
  },
  { immediate: true }
)

function validateForm() {
  fieldErrors.username = ''
  fieldErrors.password = ''
  fieldErrors.captcha = ''
  const username = String(form.username || '').trim()
  const password = String(form.password || '')

  if (!username) {
    fieldErrors.username = mode.value === 'register' ? '请输入邮箱' : '请输入邮箱或用户名'
  }
  if (!fieldErrors.username && mode.value === 'register' && !isValidEmail(username)) {
    fieldErrors.username = '请输入有效邮箱'
  }
  if (!password) fieldErrors.password = '请输入密码'
  if (!fieldErrors.password && password.length < 6) fieldErrors.password = '密码至少 6 位'

  if (mode.value === 'register') {
    const captcha = String(form.captcha || '').trim()
    if (!captcha) fieldErrors.captcha = '请输入验证码'
    if (!fieldErrors.captcha && !captchaId.value) fieldErrors.captcha = '验证码已失效，请刷新'
  }

  return !fieldErrors.username && !fieldErrors.password && !fieldErrors.captcha
}

async function submitAuth() {
  if (!validateForm()) return
  loading.value = true
  try {
    if (mode.value === 'login') {
      await authStore.login(form.username, form.password)
    } else {
      const result = await authStore.register(
        String(form.username || '').trim().toLowerCase(),
        form.password,
        captchaId.value,
        form.captcha,
        form.redeemCode
      )
      if (result?.pendingVerification) {
        toastSuccess(`注册成功，请前往 ${result.email} 查收验证邮件`)
        mode.value = 'login'
        form.password = ''
        form.captcha = ''
        form.redeemCode = ''
        verifyBanner.value = `注册成功，请前往 ${result.email} 查收验证邮件并完成激活。`
        return
      }
      const redeemCodeResult = result?.redeemCodeResult
      if (redeemCodeResult?.attempted && redeemCodeResult?.success) {
        toastSuccess(`注册成功，兑换码已到账 ${redeemCodeResult.amount || 0} 余额`)
      } else if (redeemCodeResult?.attempted && redeemCodeResult?.message) {
        toastError(`注册成功，兑换码未生效：${redeemCodeResult.message}`)
      }
    }
    router.push(safeRedirectTarget(route.query.redirect))
  } catch (e) {
    toastError(e.message || '操作失败')
    if (mode.value === 'register' && String(e.message || '').includes('验证码')) {
      await refreshCaptcha()
    }
  } finally {
    loading.value = false
  }
}

function safeRedirectTarget(value) {
  const target = String(value || '').trim()
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/login')) {
    return '/studio'
  }
  return target
}

onMounted(() => {
  siteStore.fetchSettings()
  if (route.query.verify === 'success') {
    verifyBanner.value = '邮箱验证成功，现在可以登录了。'
    mode.value = 'login'
  } else if (route.query.verify === 'invalid') {
    verifyBanner.value = '验证链接无效或已过期，请重新注册或联系管理员。'
    mode.value = 'login'
  }
})
</script>

<style scoped>
.custom-input {
  background: #f8fafc !important;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  height: 52px;
  color: #334155;
  transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
}

.auth-container {
  height: min(640px, calc(100vh - 48px));
  overflow: hidden;
}

.auth-left {
  padding: 52px 46px;
}

.auth-right {
  padding: 52px 44px;
  overflow-y: auto;
}
.custom-input:focus {
  background: #ffffff !important;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}
.input-icon {
  position: absolute;
  left: 16px;
  color: #94a3b8;
  pointer-events: none;
  transition: color 0.2s;
}
.input-wrapper:focus-within .input-icon {
  color: var(--primary);
}
.input.with-icon {
  padding-left: 46px;
}
.eye-btn {
  position: absolute;
  right: 16px;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.eye-btn:hover {
  color: #64748b;
}
.custom-checkbox {
  appearance: none;
  width: 16px;
  height: 16px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #ffffff;
  cursor: pointer;
  position: relative;
  transition: background-color 0.2s, border-color 0.2s;
}
.custom-checkbox:checked {
  background: var(--primary);
  border-color: var(--primary);
}
.custom-checkbox:checked::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 5px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.error-container {
  background: rgba(236, 72, 153, 0.1);
  border: 1px solid rgba(236, 72, 153, 0.2);
}

.field-error {
  margin-top: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
}

.auth-form-panel {
  gap: 0;
}

.auth-form {
  min-height: 0;
}

.auth-brand {
  margin-bottom: 28px;
}

.auth-hero-copy {
  margin-top: auto;
  margin-bottom: 34px;
}

.auth-badge-space {
  margin-bottom: 18px;
}

.auth-hero-title {
  margin-bottom: 18px;
}

.auth-features {
  margin-top: 0;
}

.auth-title-block {
  margin-bottom: 28px;
}

.auth-field {
  margin-bottom: 18px;
}

.verify-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(79, 70, 229, 0.16);
  background: rgba(79, 70, 229, 0.08);
  color: #4338ca;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.6;
}

.auth-options {
  margin-bottom: 22px;
}

.auth-divider {
  margin: 22px 0 18px;
}

.auth-switch {
  margin-top: 18px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
  transition: color 0.2s;
}

.back-link:hover {
  color: var(--text);
}

/* Input with Icons */
.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 52px;
}

.captcha-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.captcha-input {
  flex: 1;
}

.captcha-image {
  width: 120px;
  height: 52px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  padding: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.captcha-image:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.captcha-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.abstract-visual {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}
.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.6;
  animation: float 10s ease-in-out infinite alternate;
}
.orb-1 {
  top: -10%; left: -10%;
  width: 300px; height: 300px;
  background: radial-gradient(circle, #6366f1, transparent 70%);
}
.orb-2 {
  bottom: -10%; right: -10%;
  width: 400px; height: 400px;
  background: radial-gradient(circle, #ec4899, transparent 70%);
  animation-delay: -5s;
}
.orb-3 {
  top: 40%; left: 50%;
  width: 250px; height: 250px;
  background: radial-gradient(circle, #8b5cf6, transparent 70%);
  animation-duration: 15s;
}
.grid-overlay {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 30px 30px;
  mask-image: radial-gradient(circle at center, black, transparent 80%);
  -webkit-mask-image: radial-gradient(circle at center, black, transparent 80%);
}

@keyframes float {
  0% { transform: translate(0, 0); }
  100% { transform: translate(30px, -30px); }
}

/* Features Row */
.features-row {
  display: flex;
  gap: 16px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  padding: 20px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.2);
  flex-wrap: wrap;
}
.f-item {
  flex: 1 1 140px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.f-icon {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.f-title {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.5px;
}
.f-desc {
  font-size: 12px;
  color: rgba(255,255,255,0.6);
  margin-top: 4px;
}

/* Auth Right Refinements */
.submit-btn {
  width: 100%;
  height: 54px;
  font-size: 16px;
  border-radius: 12px;
  font-weight: 600;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  color: #94a3b8;
  font-size: 12px;
  flex-shrink: 0;
}
.divider::before, .divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #e2e8f0;
}
.divider span {
  padding: 0 10px;
}

.social-login {
  display: flex;
  gap: 16px;
  flex-shrink: 0;
}
.social-btn {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s;
  color: #0f172a;
}
.social-btn:hover {
  background: #ffffff;
  border-color: #cbd5e1;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  transform: translateY(-1px);
}

.hover-underline:hover {
  text-decoration: underline;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.badge-wrapper {
  position: relative;
  display: inline-block;
}
.badge-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border-radius: 100px;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.5px;
  backdrop-filter: blur(8px);
}
.badge-icon {
  display: inline;
  margin-top: -2px;
}
.bg-shape {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  z-index: 0;
  opacity: 0.6;
  pointer-events: none;
}
.shape-1 {
  top: 10%;
  left: 20%;
  width: 40vw;
  height: 40vw;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
}
.shape-2 {
  bottom: 10%;
  right: 20%;
  width: 50vw;
  height: 50vw;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, transparent 70%);
}

@media (max-width: 1100px) {
  .auth-container {
    max-width: 980px;
    min-height: 600px;
  }

  .auth-left {
    padding: 48px 40px;
  }

  .auth-right {
    width: 440px;
    padding: 48px 40px;
  }
}

@media (max-width: 900px) {
  .auth-layout {
    min-height: 100dvh;
    align-items: stretch;
    padding: 16px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .auth-container {
    width: min(480px, 100%);
    height: auto;
    min-height: 0;
    max-height: none;
    margin: auto;
    border-radius: 22px;
  }

  .auth-right {
    width: 100%;
    padding: 30px 24px 26px;
    overflow: visible;
  }

  .auth-title-block {
    margin-bottom: 22px;
  }

  .auth-title-block :deep(.text-h3) {
    font-size: 24px !important;
    line-height: 1.18;
  }

  .auth-field {
    margin-bottom: 14px;
  }

  .custom-input,
  .input-wrapper,
  .captcha-image {
    min-height: 48px;
    height: 48px;
  }

  .submit-btn {
    height: 50px;
  }

  .auth-options {
    margin-bottom: 18px;
    gap: 12px;
    flex-wrap: wrap;
  }

  .auth-divider {
    margin: 18px 0 14px;
  }

  .social-login {
    gap: 12px;
  }

  .social-btn {
    height: 44px;
  }

  .auth-switch {
    margin-top: 16px;
    line-height: 1.6;
  }

  .auth-layout > .absolute {
    display: none;
  }
}

@media (max-width: 480px) {
  .auth-layout {
    padding: 0;
    background: #ffffff;
  }

  .auth-container {
    width: 100%;
    min-height: 100dvh;
    border-radius: 0;
    border: 0;
    box-shadow: none;
    background: #ffffff;
  }

  .auth-right {
    min-height: 100dvh;
    padding: max(22px, env(safe-area-inset-top, 0px)) 18px max(24px, env(safe-area-inset-bottom, 0px));
  }

  .auth-title-block {
    margin-bottom: 18px;
  }

  .auth-title-block :deep(.text-h3) {
    font-size: 23px !important;
  }

  .auth-title-block .text-muted {
    line-height: 1.55;
  }

  .captcha-row {
    gap: 10px;
  }

  .captcha-image {
    width: 108px;
    flex: 0 0 108px;
  }

  .input-icon {
    left: 14px;
  }

  .input.with-icon {
    padding-left: 42px;
  }

  .eye-btn {
    right: 14px;
  }

  .divider span {
    padding: 0 8px;
  }
}
</style>
