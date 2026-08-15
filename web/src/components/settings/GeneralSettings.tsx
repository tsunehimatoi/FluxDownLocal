// 通用：自定义分类与纯局域网设备管理（服务器 config 表）。
// 引擎连接/重试参数归「下载」分区 —— 设置分类以桌面端 settings_page 为基准。
import { useI18n } from '../../lib/i18n'
import type { ConfigMap } from '../../lib/types'
import { CategoriesSettings } from './CategoriesSettings'
import { DirectDevicesSection } from './DirectDevicesSection'

export function GeneralSettings({
  config,
  mutate,
}: {
  config: ConfigMap
  mutate: (entries: ConfigMap) => void
}) {
  const { t } = useI18n()
  return (
    <>
      <h2 className="set-title">{t('set.general')}</h2>
      <p className="set-desc">{t('set.general.desc')}</p>
      <CategoriesSettings config={config} mutate={mutate} />
      <DirectDevicesSection />
    </>
  )
}
