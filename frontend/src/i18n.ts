import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        supportedLngs: ['en', 'pl'],
        
        // Forces language-only resolution (e.g., 'pl' instead of 'pl-PL') to match folder structure
        load: 'languageOnly', 
        
        // Enable debug in development to log missing keys or loading errors
        debug: import.meta.env.DEV, 
        
        interpolation: {
            escapeValue: false,
        },
        
        backend: {
            // Path to translation files. In Vite, 'public/locales' is served at root '/locales'
            loadPath: '/locales/{{lng}}/translation.json',
        },

        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'i18nextLng',
            caches: ['localStorage'],
        },
        
        react: {
            // Ensure Suspense is enabled for async translation loading
            useSuspense: true,
        }
    });

export default i18n;