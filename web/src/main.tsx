import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import * as Tooltip from '@radix-ui/react-tooltip'
import './index.css'
import { router } from './router'
import { ConfirmDialog } from './components/dialogs/confirm-dialog'
import { OVERFLOW_TOOLTIP_DELAY } from './components/OverflowTooltip'
import { ThemeProvider } from './lib/theme'
import { ToastHost } from './lib/toast'
import { I18nProvider } from './lib/i18n'
import { connectWs } from './lib/ws'
import { isAuthenticated, saveCredentials } from './lib/auth'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// URL 携带 ?token=（可选 ?base=）时自动登录——用于演示站分享链接，
// 保存凭证后立即从地址栏抹除令牌，避免泄露到历史记录/截图。
const params = new URLSearchParams(window.location.search)
const urlToken = params.get('token')
if (urlToken) {
  saveCredentials(params.get('base') ?? '', urlToken, true)
  params.delete('token')
  params.delete('base')
  const qs = params.toString()
  window.history.replaceState(
    null,
    '',
    window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash,
  )
}

// 已登录会话（刷新页面）直接建立 WS。
if (isAuthenticated()) connectWs(queryClient)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          {/* 全局唯一 Tooltip.Provider：skipDelayDuration 让相邻条目之间连续划过时
              第二个气泡立刻出现，而不是每行都重新等 500ms（见 OverflowTooltip）。 */}
          <Tooltip.Provider delayDuration={OVERFLOW_TOOLTIP_DELAY} skipDelayDuration={300}>
            <RouterProvider router={router} />
          </Tooltip.Provider>
          <ConfirmDialog />
          <ToastHost />
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
)
