import { Box, CircularProgress, Typography } from '@mui/material';

// Dictionary mapping language codes to localized "Loading Resources..." strings.
// Add new languages here as needed.
const LOADER_TRANSLATIONS: Record<string, string> = {
    de: 'Ressourcen werden geladen...',
    en: 'Loading Resources...',
    es: 'Cargando recursos...',
    fr: 'Chargement des ressources...',
    ja: 'リソースを読み込んでいます...',
    nl: 'Resources laden...',
    pl: 'Ładowanie zasobów...',
    ru: 'Загрузка ресурсов...',
    uk: 'Завантаження ресурсів...',
    zh: '正在加载资源...'
};

export const LoadingScreen = () => {
    // Detect browser language (e.g., 'pl-PL' -> 'pl') to show immediate localized feedback
    // before the i18next translation files are fetched.
    const browserLang = navigator.language.split('-')[0];

    // Select translation based on browser language, fallback to English if not found.
    const text = LOADER_TRANSLATIONS[browserLang] || LOADER_TRANSLATIONS['en'];

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                width: '100vw',
                position: 'fixed',
                top: 0,
                left: 0,
                zIndex: 9999,
                bgcolor: 'background.default', // Uses theme background color
                color: 'text.primary'          // Uses theme text color
            }}
        >
            <CircularProgress size={60} thickness={4} color="primary" />
            <Typography variant="h6" sx={{ mt: 2, fontWeight: 300, opacity: 0.8 }}>
                {text}
            </Typography>
        </Box>
    );
};