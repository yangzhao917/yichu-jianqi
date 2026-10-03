import { createTheme } from '@mui/material/styles'

export default createTheme({
  palette: { mode: 'light', background: { default: '#f7f7f5', paper: '#ffffff' }, primary: { main: '#1b1b1d', contrastText: '#f7f7f5' }, secondary: { main: '#626367', contrastText: '#ffffff' }, error: { main: '#a14f49', contrastText: '#ffffff' }, warning: { main: '#6d6b65', contrastText: '#ffffff' }, text: { primary: '#171719', secondary: '#5d5f63' }, divider: '#dededb' },
  typography: { fontFamily: "'Manrope', 'Noto Sans SC', sans-serif", button: { textTransform: 'none', fontWeight: 700 } },
  shape: { borderRadius: 0 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { minHeight: 44, borderRadius: 0 } } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 0, backgroundColor: '#ffffff', '& fieldset': { borderColor: '#d8d8d4' }, '&:hover fieldset': { borderColor: '#9b9b96' }, '&.Mui-focused fieldset': { borderColor: '#1b1b1d' } } } },
    MuiSelect: { styleOverrides: { root: { borderRadius: 0 } } },
    MuiPaper: { styleOverrides: { root: { borderRadius: 0, backgroundImage: 'none' } } },
  },
})
