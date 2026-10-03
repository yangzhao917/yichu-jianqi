import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import '../admin.css'

const theme = {
  token: {
    colorPrimary: '#176b68',
    colorInfo: '#176b68',
    colorSuccess: '#287553',
    colorWarning: '#a56a1d',
    colorError: '#b44641',
    colorText: '#182326',
    colorTextSecondary: '#536267',
    colorBorder: '#d8e0e1',
    colorBgContainer: '#ffffff',
    borderRadius: 6,
    controlHeight: 40,
    fontFamily: "'Manrope', 'Noto Sans SC', sans-serif",
  },
}

export default function AdminTheme({ children }) {
  return <ConfigProvider locale={zhCN} theme={theme}>{children}</ConfigProvider>
}
