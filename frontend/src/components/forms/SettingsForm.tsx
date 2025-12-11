import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, Tab, Tabs, Tooltip, Typography, useMediaQuery, useTheme, MenuItem, Select, FormControl } from '@mui/material';
import React, { SyntheticEvent, useEffect, useMemo, useState } from 'react';
import { CheckboxElement, FormContainer, SelectElement, TextFieldElement, useForm } from 'react-hook-form-mui';
import { useTranslation } from 'react-i18next';
import { FaCog } from 'react-icons/fa';
import { FaClockRotateLeft, FaImage, FaKeyboard, FaTrashCan } from 'react-icons/fa6';
import { useNavigate } from 'react-router-dom';

import { FileInput } from './FileInput';
import { MultiFileInput } from './MultiFileInput';
import { DashApi } from '../../api/dash-api';
import { BACKEND_URL } from '../../constants/constants';
import { useAppContext } from '../../context/useAppContext';
import { COLORS } from '../../theme/styles';
import { Config, SearchProvider } from '../../types';
import { PopupManager } from '../modals/PopupManager';
import { ToastManager } from '../toast/ToastManager';

// Predefined search providers
const SEARCH_PROVIDERS = [
    { id: 'google', label: 'Google', name: 'Google', url: 'https://www.google.com/search?q={query}' },
    { id: 'bing', label: 'Bing', name: 'Bing', url: 'https://www.bing.com/search?q={query}' },
    { id: 'duckduckgo', label: 'DuckDuckGo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={query}' },
    { id: 'searx', label: 'Searx', name: 'Searx', url: 'https://searx.org/search?q={query}' },
    { id: 'custom', label: 'Custom', name: 'Custom', url: '' }
];

type FormValues = {
    backgroundFile: File | null,
    title: string;
    search: boolean;
    searchProviderId: string;
    searchProvider?: SearchProvider;
    showInternetIndicator: boolean;
    configFile?: File | null;
    appIconFiles?: File[] | null;
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role='tabpanel'
            hidden={value !== index}
            id={`vertical-tabpanel-${index}`}
            aria-labelledby={`vertical-tab-${index}`}
            style={{ width: '100%' }}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

function a11yProps(index: number) {
    return {
        id: `vertical-tab-${index}`,
        'aria-controls': `vertical-tabpanel-${index}`,
    };
}

// Separate component for image preview to handle state properly
const ImagePreviewCard = ({ image, onDelete }: {
    image: any;
    onDelete: () => void;
}) => {
    const [imageError, setImageError] = useState(false);
    const { t } = useTranslation();
    
    // Format file size for display
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <Box
            sx={{
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 1,
                pt: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s ease-in-out',
                '&:hover': {
                    transform: 'scale(1.02)',
                    borderColor: 'primary.main'
                }
            }}
        >
            {/* Image Preview */}
            <Box sx={{
                width: '100%',
                height: '100px',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: imageError ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
            }}>
                {imageError ? (
                    <Typography variant='caption' sx={{
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontSize: '12px'
                    }}>
                        {t('settings.appearance.previewUnavailable')}
                    </Typography>
                ) : (
                    <img
                        src={`${BACKEND_URL}${image.path}`}
                        alt={image.name}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            objectPosition: 'center'
                        }}
                        onError={() => setImageError(true)}
                    />
                )}
            </Box>

            {/* Image Info */}
            <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5, flexGrow: 1 }}>
                <Typography variant='caption' sx={{
                    fontWeight: 'bold',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: '0.75rem',
                    mb: 0.5
                }}>
                    {image.name}
                </Typography>

                {/* Two-column layout for details */}
                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 0.5,
                    fontSize: '0.7rem'
                }}>
                    <Typography variant='caption' sx={{ fontSize: '0.7rem' }}>
                        {t('settings.appearance.details.size')}
                    </Typography>
                    <Typography variant='caption' sx={{ fontSize: '0.7rem' }}>
                        {formatFileSize(image.size)}
                    </Typography>

                    <Typography variant='caption' sx={{ fontSize: '0.7rem' }}>
                        {t('settings.appearance.details.uploaded')}
                    </Typography>
                    <Typography variant='caption' sx={{ fontSize: '0.7rem' }}>
                        {new Date(image.uploadDate).toLocaleDateString()}
                    </Typography>

                    <Typography variant='caption' sx={{ fontSize: '0.7rem' }}>
                        {t('settings.appearance.details.type')}
                    </Typography>
                    <Typography variant='caption' sx={{
                        fontSize: '0.7rem',
                        textTransform: 'capitalize'
                    }}>
                        {image.type.replace('-', ' ')}
                    </Typography>
                </Box>

                <Button
                    variant='contained'
                    color='error'
                    size='small'
                    startIcon={<FaTrashCan style={{ fontSize: '0.8rem' }} />}
                    onClick={onDelete}
                    sx={{
                        mt: 1,
                        fontSize: '0.7rem',
                        py: 0.5,
                        minHeight: 'unset'
                    }}
                >
                    {t('settings.appearance.delete')}
                </Button>
            </Box>
        </Box>
    );
};

export const SettingsForm = () => {
    const { t, i18n } = useTranslation();
    const [userLanguage, setUserLanguage] = useState(i18n.language);
    const [isCustomProvider, setIsCustomProvider] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const { config, updateConfig, refreshDashboard, pages } = useAppContext();
    const [tabValue, setTabValue] = useState(0);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const navigate = useNavigate();
    const [uploadedImages, setUploadedImages] = useState<any[]>([]);
    const [loadingImages, setLoadingImages] = useState(false);

    const handleLanguageChange = async (newLang: string) => {
        setUserLanguage(newLang);
    };

    // Detect user's OS for appropriate command key display
    const isMac = useMemo(() => {
        return typeof navigator !== 'undefined' &&
               (navigator.platform.indexOf('Mac') > -1 || navigator.userAgent.indexOf('Mac') > -1);
    }, []);

    const commandKey = isMac ? '⌘' : 'Ctrl';

    // Reusable key badge component
    const KeyBadge = ({ children }: { children: React.ReactNode }) => (
        <Box sx={{
            px: 1,
            py: 0.5,
            bgcolor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 0.5,
            fontSize: children === '⌘' ? { xs: '1.125rem', sm: '1.25rem' } : { xs: '0.875rem', sm: '1rem' },
            fontFamily: 'monospace',
            minWidth: '24px',
            height: '28px',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            {children}
        </Box>
    );

    // Add custom styling for menu items
    useEffect(() => {
        // Create a style element
        const style = document.createElement('style');

        // Add specific styling for menu items in the settings form
        style.innerHTML = `
            .MuiPopover-root .MuiPaper-root .MuiMenuItem-root:hover {
                background-color: ${COLORS.LIGHT_GRAY_HOVER} !important;
            }
            .MuiPopover-root .MuiPaper-root .MuiMenuItem-root.Mui-selected {
                background-color: ${theme.palette.primary.main} !important;
            }
            .MuiPopover-root .MuiPaper-root .MuiMenuItem-root.Mui-selected:hover {
                background-color: ${COLORS.LIGHT_GRAY_HOVER} !important;
            }
        `;

        // Append the style to the document head
        document.head.appendChild(style);

        // Clean up function to remove style when component unmounts
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    // Determine initial search provider ID and properly handle custom provider
    const getInitialSearchProviderId = (): string => {
        if (!config?.search || !config?.searchProvider) return 'google';

        const { name, url } = config.searchProvider;

        // Check if it matches any predefined provider
        for (const provider of SEARCH_PROVIDERS) {
            if (provider.id !== 'custom' && url === provider.url) {
                return provider.id;
            }
        }

        // If no match found, it's a custom provider
        return 'custom';
    };

    // Get the initial provider ID before setting up the form
    const initialProviderId = getInitialSearchProviderId();

    const formContext = useForm<FormValues>({
        defaultValues: {
            backgroundFile: null as File | null,
            title: config?.title || '',
            search: config?.search || false,
            searchProviderId: initialProviderId,
            searchProvider: {
                name: initialProviderId === 'custom' && config?.searchProvider?.name
                    ? config.searchProvider.name
                    : initialProviderId !== 'custom'
                        ? SEARCH_PROVIDERS.find(p => p.id === initialProviderId)?.name || ''
                        : '',
                url: initialProviderId === 'custom' && config?.searchProvider?.url
                    ? config.searchProvider.url
                    : initialProviderId !== 'custom'
                        ? SEARCH_PROVIDERS.find(p => p.id === initialProviderId)?.url || ''
                        : ''
            },
            showInternetIndicator: config?.showInternetIndicator !== false,  // Default to true
            configFile: null,
            appIconFiles: null
        }
    });

    const backgroundFile = formContext.watch('backgroundFile', null);
    const searchProviderId = formContext.watch('searchProviderId', 'google');
    const searchEnabled = formContext.watch('search', false);
    const title = formContext.watch('title', '');
    const searchProviderName = formContext.watch('searchProvider.name', '');
    const searchProviderUrl = formContext.watch('searchProvider.url', '');
    const showInternetIndicator = formContext.watch('showInternetIndicator', true);
    const configFile = formContext.watch('configFile', null);
    const appIconFiles = formContext.watch('appIconFiles', null);

    // Initialize custom provider flag properly on component mount
    useEffect(() => {
        const providerId = getInitialSearchProviderId();
        setIsCustomProvider(providerId === 'custom');

        // Make sure custom provider fields are populated when provider is custom
        if (providerId === 'custom' && config?.searchProvider) {
            formContext.setValue('searchProvider.name', config.searchProvider.name || '');
            formContext.setValue('searchProvider.url', config.searchProvider.url || '');
        }
    }, [config]);

    // Update custom provider state when search provider ID changes
    useEffect(() => {
        setIsCustomProvider(searchProviderId === 'custom');

        // When a non-custom provider is selected, update the search provider values
        if (searchProviderId !== 'custom') {
            const selectedProvider = SEARCH_PROVIDERS.find(p => p.id === searchProviderId);
            if (selectedProvider) {
                formContext.setValue('searchProvider.name', selectedProvider.name);
                formContext.setValue('searchProvider.url', selectedProvider.url);
            }
        } else if (config?.searchProvider && searchProviderId === 'custom') {
            // Ensure custom provider fields are populated when switching to custom
            formContext.setValue('searchProvider.name', config.searchProvider.name || '');
            formContext.setValue('searchProvider.url', config.searchProvider.url || '');
        }
    }, [searchProviderId, formContext, config]);

    // Check if form values differ from current config
    useEffect(() => {
        // Check if there are changes that would be saved
        const checkForChanges = () => {
            // Language change
            if (userLanguage !== i18n.language) return true;

            // Title change
            if (title !== (config?.title || 'Lab Dash')) return true;

            // Background image change
            if (backgroundFile) return true;

            // App icon files change
            if (appIconFiles && appIconFiles.length > 0) return true;

            // Search enabled change
            if (searchEnabled !== (config?.search || false)) return true;

            // Internet indicator change
            if (showInternetIndicator !== (config?.showInternetIndicator !== false)) return true;

            // Search provider changes
            if (searchEnabled) {
                if (searchProviderId === 'custom') {
                    // Check custom provider
                    if (searchProviderName !== (config?.searchProvider?.name || '')) return true;
                    if (searchProviderUrl !== (config?.searchProvider?.url || '')) return true;
                } else {
                    // Check predefined provider
                    const selectedProvider = SEARCH_PROVIDERS.find(p => p.id === searchProviderId);
                    if (!selectedProvider) return false;
                    // Compare with current config
                    if (config?.searchProvider) {
                        if (selectedProvider.url !== config.searchProvider.url) return true;
                        if (selectedProvider.name !== config.searchProvider.name) return true;
                    } else if (config?.search) {
                        // Search is enabled but no provider is set
                        return true;
                    }
                }
            } else if (config?.search) {
                // Currently has search enabled, but form has it disabled
                return true;
            }
            // Config file is handled separately and doesn't affect this button

            // No changes detected
            return false;
        };
        setHasChanges(checkForChanges());
    }, [
        userLanguage,
        i18n.language,
        title,
        backgroundFile,
        appIconFiles,
        searchEnabled,
        searchProviderId,
        searchProviderName,
        searchProviderUrl,
        showInternetIndicator,
        config
    ]);

    const handleTabChange = (event: SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const handleSubmit = async (data: any) => {
        try {
            // Checking if the user selected a different language than the current one
            if (userLanguage !== i18n.language) {
                // First, change the language in i18next (this re-renders the application)
                await i18n.changeLanguage(userLanguage);
                // Update the profile in the database
                await DashApi.updateProfile({ language: userLanguage });
            }

            const updatedConfig: Partial<Config> = {};

            if (data.backgroundFile instanceof File) {
                updatedConfig.backgroundImage = data.backgroundFile;
            }

            if (data.title.trim()) {
                updatedConfig.title = data.title;
            } else {
                updatedConfig.title = 'Lab Dash';
            }

            if (data.search !== undefined) {
                updatedConfig.search = data.search;
            }

            if (data.showInternetIndicator !== undefined) {
                updatedConfig.showInternetIndicator = data.showInternetIndicator;
            }

            // Handle search provider if search is enabled
            if (data.search && data.searchProviderId) {
                // Use custom provider settings
                if (data.searchProviderId === 'custom' && data.searchProvider) {
                    const { name, url } = data.searchProvider;
                    if (name && url) {
                        updatedConfig.searchProvider = { name, url };
                    }
                } else {
                    // Use predefined provider
                    const selectedProvider = SEARCH_PROVIDERS.find(p => p.id === data.searchProviderId);
                    if (selectedProvider && selectedProvider.id !== 'custom') {
                        updatedConfig.searchProvider = {
                            name: selectedProvider.name,
                            url: selectedProvider.url
                        };
                    }
                }
            } else if (data.search === false) {
                // If search is disabled, remove search provider
                updatedConfig.searchProvider = undefined;
            }

            // Handle config file import
            if (data.configFile instanceof File) {
                try {
                    const fileReader = new FileReader();

                    fileReader.onload = async (e) => {
                        try {
                            const fileContent = e.target?.result;
                            if (typeof fileContent === 'string') {
                                const importedConfig = JSON.parse(fileContent) as Config;

                                // Validate imported config has required structure
                                if (importedConfig && typeof importedConfig === 'object') {
                                    // Use the new import endpoint instead of updateConfig
                                    await DashApi.importConfig(importedConfig);
                                    await refreshDashboard();
                                    // Show success message
                                    PopupManager.success(
                                        t('common.successTitle'),
                                        t('settings.backup.restoreSuccess'),
                                        () => navigate('/')
                                    );
                                    // Reset the file input
                                    formContext.resetField('configFile');
                                }
                            }
                        } catch (error) {
                            PopupManager.failure(
                                t('common.errorTitle'),
                                t('settings.backup.restoreError')
                            );
                            console.error('Error restoring configuration:', error);
                        }
                    };
                    fileReader.readAsText(data.configFile);
                    return; // Skip other updates when importing config
                } catch (error) {
                    PopupManager.failure(
                        t('common.errorTitle'),
                        t('settings.backup.restoreError')
                    );
                    console.error('Error restoring configuration:', error);
                }
            }

            // Handle app icon uploads
            if (data.appIconFiles && data.appIconFiles.length > 0) {
                try {
                    const uploadedIcons = await DashApi.uploadAppIconsBatch(data.appIconFiles);
                    if (uploadedIcons.length > 0) {

                        PopupManager.success(
                            t('common.successTitle'),
                            t('settings.appearance.uploadSuccess', { count: uploadedIcons.length })
                        );
                        // Reset the app icon files field
                        formContext.resetField('appIconFiles');
                        // Refresh uploaded images list
                        await loadUploadedImages();
                    } else {
                        PopupManager.failure(
                            t('common.errorTitle'),
                            t('settings.appearance.uploadError')
                        );
                    }
                } catch (error) {
                    PopupManager.failure(
                        t('common.errorTitle'),
                        t('settings.appearance.uploadError')
                    );
                    console.error('Error uploading app icons:', error);
                }
            }

            if (Object.keys(updatedConfig).length > 0) {
                const hasBackgroundImage = data.backgroundFile instanceof File;
                await updateConfig(updatedConfig); // Update only the provided fields

                // If a background image was uploaded, refresh the uploaded images list
                if (hasBackgroundImage) {
                    await loadUploadedImages();
                }

                // Show success message (only if no app icons were uploaded, to avoid duplicate messages)
                if (!data.appIconFiles || data.appIconFiles.length === 0) {
                    PopupManager.success(
                        i18n.t('common.successTitle', { lng: userLanguage }),
                        i18n.t('settings.general.saveSuccess', { lng: userLanguage })
                    );
                }

                // Refresh the form with new config values (optional)
                const refreshedConfig = await DashApi.getConfig();
                // Get the correct provider ID based on the saved config
                const savedSearchProviderId = refreshedConfig?.searchProvider
                    ? (() => {
                        const { url } = refreshedConfig.searchProvider;
                        // Check if it matches any predefined provider
                        for (const provider of SEARCH_PROVIDERS) {
                            if (provider.id !== 'custom' && url === provider.url) {
                                return provider.id;
                            }
                        }
                        // If no match found, it's a custom provider
                        return 'custom';
                    })()
                    : 'google';

                formContext.reset({
                    backgroundFile: null,
                    title: refreshedConfig?.title || '',
                    search: refreshedConfig?.search || false,
                    searchProviderId: savedSearchProviderId,
                    searchProvider: {
                        name: refreshedConfig?.searchProvider?.name || '',
                        url: refreshedConfig?.searchProvider?.url || ''
                    },
                    showInternetIndicator: refreshedConfig?.showInternetIndicator !== false,
                    appIconFiles: null
                });
            }
        } catch (error) {
            // Show error message
            PopupManager.failure(
                t('common.errorTitle'),
                t('settings.general.saveError')
            );
            console.error('Error updating settings:', error);
        }
    };

    const resetBackground = async () => {
        PopupManager.deleteConfirmation({
            title: t('settings.appearance.resetBackgroundConfirmTitle'),
            text: t('settings.appearance.resetBackgroundConfirmText'),
            confirmText: t('settings.appearance.resetBackgroundConfirmButton'),
            denyText: t('common.deny'),
            confirmAction: async () => {
                try {
                    // First clean up all background images in the root directory
                    await DashApi.cleanBackgroundImages();

                    // Then update the config to use the default background
                    await updateConfig({ backgroundImage: '' });
                    PopupManager.success(
                        t('common.successTitle'),
                        t('settings.appearance.resetBackgroundSuccess')
                    );
                } catch (error) {
                    PopupManager.failure(
                        t('common.errorTitle'),
                        t('settings.appearance.resetBackgroundError')
                    );
                    console.error('Error resetting background:', error);
                }
            }
        });
    };

    // Load uploaded images
    const loadUploadedImages = async () => {
        setLoadingImages(true);
        try {
            const images = await DashApi.getUploadedImages();
            setUploadedImages(images);
        } catch (error) {
            console.error('Error loading uploaded images:', error);
            PopupManager.failure(
                t('common.errorTitle'),
                t('settings.appearance.loadImagesError')
            );
        } finally {
            setLoadingImages(false);
        }
    };

    // Delete uploaded image
    const deleteUploadedImage = async (imagePath: string, imageName: string, imageType: string) => {
        PopupManager.deleteConfirmation({
            title: t('settings.appearance.deleteImageConfirmTitle'),
            text: t('settings.appearance.deleteImageConfirmText', { name: imageName }),
            confirmText: t('common.yesDelete'),
            denyText: t('common.deny'),
            confirmAction: async () => {
                try {
                    const success = await DashApi.deleteUploadedImage(imagePath);
                    if (success) {
                        // If a background image is deleted, reset config to default
                        if (imageType === 'background') {
                            try {
                                await updateConfig({ backgroundImage: '' });
                                ToastManager.success(t('settings.appearance.deleteBackgroundSuccess'));
                            } catch (configError) {
                                console.error('Error resetting background config:', configError);
                                ToastManager.success(t('settings.appearance.deleteBackgroundConfigError'));
                            }
                        } else {
                            ToastManager.success(t('settings.appearance.deleteSuccess', { name: imageName }));
                        }
                        await loadUploadedImages();  // Refresh the list
                    } else {
                        PopupManager.failure(
                            t('common.errorTitle'),
                            t('settings.appearance.deleteError')
                        );
                    }
                } catch (error) {
                    console.error('Error deleting image:', error);
                    PopupManager.failure(
                        t('common.errorTitle'),
                        t('settings.appearance.deleteError')
                    );
                }
            }
        });
    };

    // Load images when component mounts or when appearance tab is selected
    useEffect(() => {
        if (tabValue === 1) { 
            loadUploadedImages();
        }
    }, [tabValue]);

    return (
        <FormContainer onSuccess={handleSubmit} formContext={formContext}>
            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant='h4' sx={{ p: 2 }}>{t('settings.title')}</Typography>
                    <Box sx={{ p: 2 }}>
                        <Button
                            variant='contained'
                            type='submit'
                            disabled={!hasChanges && !configFile && (!appIconFiles || appIconFiles.length === 0)}
                            sx={{
                                '&.Mui-disabled': {
                                    color: 'rgba(255, 255, 255, 0.5)'
                                }
                            }}
                        >
                            {t('settings.save')}
                        </Button>
                    </Box>
                </Box>
                <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    minHeight: { xs: 'auto', md: '550px', lg: '700px' },
                    width: '100%'
                }}>
                    <Tabs
                        orientation={isMobile ? 'horizontal' : 'vertical'}
                        variant='scrollable'
                        value={tabValue}
                        onChange={handleTabChange}
                        aria-label='Settings tabs'
                        sx={{
                            borderRight: {
                                xs: 'none',
                                md: '1px solid rgba(0, 0, 0, 0.12)'
                            },
                            borderBottom: {
                                xs: '1px solid rgba(0, 0, 0, 0.12)',
                                md: 'none'
                            },
                            minWidth: { xs: '100%', md: '160px' },
                            mb: { xs: 2, md: 0 },
                            '& .MuiTab-root': {
                                alignItems: 'center',
                                textAlign: 'left',
                                justifyContent: { xs: 'center', md: 'flex-start' },
                                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                                color: 'text.primary',
                                '&.Mui-selected': {
                                    color: 'primary.main'
                                },
                                flexDirection: 'row',
                                gap: 1.5
                            }
                        }}
                    >
                        <Tab icon={<FaCog style={{ fontSize: '1.2rem' }} />} label={t('settings.tabs.general')} {...a11yProps(0)} />
                        <Tab icon={<FaImage style={{ fontSize: '1.2rem' }} />} label={t('settings.tabs.appearance')} {...a11yProps(1)} />
                        <Tab icon={<FaClockRotateLeft style={{ fontSize: '1.2rem' }} />} label={t('settings.tabs.backup')} {...a11yProps(2)} />
                        <Tab icon={<FaKeyboard style={{ fontSize: '1.2rem' }} />} label={t('settings.tabs.hotkeys')} {...a11yProps(3)} />
                    </Tabs>

                    <TabPanel value={tabValue} index={0}>
                        <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3
                        }}>
                            <Typography variant='h6'>{t('settings.general.title')}</Typography>

                            <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '120px 1fr', sm: '180px 1fr' },
                                gap: { xs: 1, sm: 2 },
                                alignItems: 'center'
                            }}>
                                <Typography variant='body1' sx={{
                                    alignSelf: 'center',
                                    fontSize: { xs: '0.875rem', sm: '1rem' }
                                }}>
                                    {t('settings.language')}
                                </Typography>
                                <Box>
                                    <FormControl fullWidth size="small" sx={{ width: '95%' }}>
                                        <Select
                                            value={userLanguage}
                                            onChange={(e) => handleLanguageChange(e.target.value)}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    '& fieldset': { borderColor: theme.palette.text.primary },
                                                },
                                                color: 'text.primary'
                                            }}
                                        >
                                            <MenuItem value="en">English</MenuItem>
                                            <MenuItem value="pl">Polski</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Box>

                                <Typography variant='body1' sx={{
                                    alignSelf: 'center',
                                    fontSize: { xs: '0.875rem', sm: '1rem' }
                                }}>{t('settings.general.customTitle')}</Typography>
                                <Box>
                                    <TextFieldElement
                                        name='title'
                                        variant='outlined'
                                        sx={{ width: '95%' }}
                                    />
                                </Box>

                                <Typography variant='body1' sx={{
                                    alignSelf: 'center',
                                    fontSize: { xs: '0.875rem', sm: '1rem' }
                                }}>{t('settings.general.enableSearch')}</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <CheckboxElement
                                        name='search'
                                        sx={{ color: 'text.primary' }}
                                    />
                                </Box>

                                <Typography variant='body1' sx={{
                                    alignSelf: 'center',
                                    fontSize: { xs: '0.875rem', sm: '1rem' }
                                }}>{t('settings.general.showInternet')}</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <CheckboxElement
                                        name='showInternetIndicator'
                                        sx={{ color: 'text.primary' }}
                                    />
                                </Box>

                                {searchEnabled && (
                                    <>
                                        <Typography variant='body1' sx={{
                                            alignSelf: 'center',
                                            fontSize: { xs: '0.875rem', sm: '1rem' }
                                        }}>{t('settings.general.searchProvider')}</Typography>
                                        <Box>
                                            <SelectElement
                                                name='searchProviderId'
                                                options={[
                                                    { id: 'google', label: 'Google' },
                                                    { id: 'bing', label: 'Bing' },
                                                    { id: 'duckduckgo', label: 'DuckDuckGo' },
                                                    { id: 'searx', label: 'Searx' },
                                                    { id: 'custom', label: 'Custom' }
                                                ]}
                                                valueKey='id'
                                                labelKey='label'
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        '& fieldset': { borderColor: theme.palette.text.primary },
                                                        '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                        '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
                                                    },
                                                    '.MuiSvgIcon-root ': { fill: theme.palette.text.primary },
                                                    width: '95%'
                                                }}
                                            />
                                        </Box>

                                        {isCustomProvider && (
                                            <>
                                                <Typography variant='body1' sx={{
                                                    alignSelf: 'center',
                                                    fontSize: { xs: '0.875rem', sm: '1rem' }
                                                }}>{t('settings.general.providerName')}</Typography>
                                                <Box>
                                                    <TextFieldElement
                                                        name='searchProvider.name'
                                                        sx={{
                                                            width: '95%',
                                                            '& .MuiInputBase-root': {
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap'
                                                            },
                                                            '& .MuiInputBase-input': {
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            }
                                                        }}
                                                    />
                                                </Box>

                                                <Box sx={{
                                                    alignSelf: 'center'
                                                }}>
                                                    <Typography variant='body1' sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>{t('settings.general.searchUrl')}</Typography>
                                                    <Typography variant='caption' sx={{
                                                        display: 'block',
                                                        fontSize: { xs: '0.7rem', sm: '0.75rem' }
                                                    }}>
                                                        {t('settings.general.searchUrlPlaceholder')}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <TextFieldElement
                                                        name='searchProvider.url'
                                                        helperText={isMobile
                                                            ? t('settings.general.searchUrlHelperMobile')
                                                            : t('settings.general.searchUrlHelperDesktop')
                                                        }
                                                        sx={{
                                                            width: '95%',
                                                            '& .MuiInputBase-root': {
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap'
                                                            },
                                                            '& .MuiInputBase-input': {
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            },
                                                            '& .MuiFormHelperText-root': {
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                                maxWidth: '100%',
                                                                fontSize: { xs: '0.65rem', sm: '0.75rem' }
                                                            }
                                                        }}
                                                    />
                                                </Box>
                                            </>
                                        )}
                                    </>
                                )}
                            </Box>
                            <Box sx={{
                                gridColumn: { xs: '1', sm: '1 / -1' },
                                justifySelf: 'start',
                                mt: 2,
                                display: 'flex',
                                gap: 2,
                                flexDirection: { xs: 'column', sm: 'row' }
                            }}>
                                <Button
                                    variant='contained'
                                    color='error'
                                    onClick={() => {
                                        PopupManager.deleteConfirmation({
                                            title: t('settings.general.resetConfirmTitle'),
                                            text: t('settings.general.resetConfirmText'),
                                            confirmText: t('common.yesDelete'),
                                            denyText: t('common.deny'),
                                            confirmAction: async () => {
                                                await updateConfig({
                                                    title: 'Lab Dash',
                                                    backgroundImage: '',
                                                    search: false,
                                                    searchProvider: undefined,
                                                    showInternetIndicator: true
                                                });
                                                await refreshDashboard();
                                                PopupManager.success(
                                                    t('common.successTitle'),
                                                    t('settings.general.resetSuccess'),
                                                    () => navigate('/')
                                                );
                                            }
                                        });
                                    }}
                                    sx={{ minWidth: { xs: 'auto', sm: '200px' } }}
                                >
                                    {t('settings.general.reset')}
                                </Button>
                            </Box>

                        </Box>
                    </TabPanel>

                    <TabPanel value={tabValue} index={1}>
                        <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3
                        }}>
                            <Typography variant='h6'>{t('settings.appearance.title')}</Typography>

                            <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '120px 1fr', sm: '150px 1fr' },
                                gap: { xs: 1, sm: 2 },
                                alignItems: 'center'
                            }}>
                                <Typography variant='body1' sx={{
                                    alignSelf: 'center',
                                    fontSize: { xs: '0.875rem', sm: '1rem' }
                                }}>{t('settings.appearance.background')}</Typography>
                                <Box sx={{ position: 'relative' }}>
                                    <FileInput
                                        name='backgroundFile'
                                        sx={{ width: '95%' }}
                                    />
                                    {backgroundFile && (
                                        <Tooltip title={t('settings.appearance.clearIcons')}>
                                            <CloseIcon
                                                onClick={() => formContext.resetField('backgroundFile')}
                                                sx={{
                                                    position: 'absolute',
                                                    right: '10px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    cursor: 'pointer',
                                                    fontSize: 22,
                                                    color: 'rgba(255, 255, 255, 0.7)'
                                                }}
                                            />
                                        </Tooltip>
                                    )}
                                </Box>

                                <Typography variant='body1' sx={{
                                    alignSelf: 'center',
                                    fontSize: { xs: '0.875rem', sm: '1rem' }
                                }}>{t('settings.appearance.uploadIcons')}</Typography>
                                <Box sx={{ position: 'relative' }}>
                                    <MultiFileInput
                                        name='appIconFiles'
                                        maxFiles={20}
                                        sx={{ width: '95%' }}
                                    />
                                    {appIconFiles && appIconFiles.length > 0 && (
                                        <Tooltip title={t('settings.appearance.clearIcons')}>
                                            <CloseIcon
                                                onClick={() => formContext.resetField('appIconFiles')}
                                                sx={{
                                                    position: 'absolute',
                                                    right: '10px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    cursor: 'pointer',
                                                    fontSize: 22,
                                                    color: 'rgba(255, 255, 255, 0.7)'
                                                }}
                                            />
                                        </Tooltip>
                                    )}
                                </Box>

                            </Box>
                            <Box sx={{
                                gridColumn: { xs: '1', sm: '1 / -1' },
                                justifySelf: 'start',
                                mt: 2,
                                display: 'flex',
                                gap: 2,
                                flexDirection: { xs: 'column', sm: 'row' }
                            }}>
                                <Button
                                    variant='contained'
                                    color='error'
                                    onClick={async () => {
                                        try {
                                            const response = await DashApi.clearIconCache();
                                            ToastManager.success(t('settings.appearance.cacheCleared'));
                                        } catch (error) {
                                            console.error('Error clearing icon cache:', error);
                                            ToastManager.error(t('settings.appearance.clearCacheError'));
                                        }
                                    }}
                                >
                                    {t('settings.appearance.clearCache')}
                                </Button>
                                <Button variant='contained' onClick={resetBackground} color='error'>
                                    {t('settings.appearance.resetBackground')}
                                </Button>
                            </Box>

                            {/* Image Management Section */}
                            <Box>
                                <Typography variant='h6' sx={{ mb: 2 }}>{t('settings.appearance.uploadedImages')}</Typography>

                                {loadingImages ? (
                                    <Typography>{t('settings.appearance.loadingImages')}</Typography>
                                ) : uploadedImages.length === 0 ? (
                                    <Typography variant='body2' sx={{ fontStyle: 'italic' }}>
                                        {t('settings.appearance.noImages')}
                                    </Typography>
                                ) : (
                                    <Box sx={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                        gap: 2,
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        borderRadius: 1,
                                        p: 2
                                    }}>
                                        {uploadedImages.map((image, index) => (
                                            <ImagePreviewCard
                                                key={index}
                                                image={image}
                                                onDelete={() => deleteUploadedImage(image.path, image.name, image.type)}
                                            />
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        </Box>
                    </TabPanel>

                    <TabPanel value={tabValue} index={2}>
                        <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3
                        }}>
                            <Typography variant='h6'>{t('settings.backup.title')}</Typography>

                            <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '120px 1fr', sm: '150px 1fr' },
                                gap: { xs: 1, sm: 2 },
                                alignItems: 'center'
                            }}>
                                <Typography variant='body1' sx={{
                                    alignSelf: 'center',
                                    fontSize: { xs: '0.875rem', sm: '1rem' },
                                    width: '10rem'

                                }}>{t('settings.backup.export')}</Typography>
                                <Box ml={2}>
                                    <Button
                                        variant='contained'
                                        size={isMobile ? 'small' : 'medium'}
                                        onClick={async () => {
                                            try {
                                                // Use the server-side export API instead of client-side JSON generation
                                                await DashApi.exportConfig();
                                                PopupManager.success(
                                                    t('common.successTitle'),
                                                    t('settings.backup.exportSuccess')
                                                );
                                            } catch (error) {
                                                PopupManager.failure(
                                                    t('common.errorTitle'),
                                                    t('settings.backup.exportError')
                                                );
                                                console.error('Error exporting configuration:', error);
                                            }
                                        }}
                                    >
                                        {t('settings.backup.exportBtn')}
                                    </Button>
                                </Box>

                                <Typography variant='body1' sx={{
                                    alignSelf: 'center',
                                    fontSize: { xs: '0.875rem', sm: '1rem' },
                                    width: '10rem'
                                }}>{t('settings.backup.restore')}</Typography>
                                <Box ml={2}>
                                    <FileInput
                                        name='configFile'
                                        accept='.json'
                                        sx={{ width: '95%' }}
                                    />
                                </Box>
                            </Box>

                            {/* Desktop to Mobile Layout Sync */}
                            <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '120px 1fr', sm: '150px 1fr' },
                                gap: { xs: 1, sm: 2 },
                                alignItems: 'center',
                            }}>
                                <Typography variant='body1' sx={{
                                    alignSelf: 'center',
                                    fontSize: { xs: '0.875rem', sm: '1rem' },
                                    width: '10rem'
                                }}>{t('settings.backup.layoutSync')}</Typography>
                                <Box ml={2}>
                                    <Button
                                        variant='contained'
                                        size={isMobile ? 'small' : 'medium'}
                                        onClick={async () => {
                                            try {
                                                PopupManager.deleteConfirmation({
                                                    title: t('settings.backup.copyLayoutConfirmTitle'),
                                                    text: t('settings.backup.copyLayoutConfirmText'),
                                                    confirmText: t('settings.backup.copyLayoutConfirmButton'),
                                                    confirmAction: async () => {
                                                        if (!config?.layout?.desktop) {
                                                            PopupManager.failure(
                                                                t('common.errorTitle'),
                                                                t('settings.backup.noLayoutError')
                                                            );
                                                            return;
                                                        }

                                                        // Create updated config with desktop layout copied to mobile
                                                        const updatedLayout = {
                                                            layout: {
                                                                desktop: config.layout.desktop,
                                                                mobile: [...config.layout.desktop]
                                                            }
                                                        };
                                                        
                                                        // Save the updated layout
                                                        await updateConfig(updatedLayout);
                                                        await refreshDashboard();

                                                        PopupManager.success(
                                                            t('common.successTitle'),
                                                            t('settings.backup.copyLayoutSuccess')
                                                        );
                                                    }
                                                });
                                            } catch (error) {
                                                PopupManager.failure(
                                                    t('common.errorTitle'),
                                                    t('settings.backup.copyLayoutError')
                                                );
                                                console.error('Error copying layout:', error);
                                            }
                                        }}
                                    >
                                        {t('settings.backup.copyLayout')}
                                    </Button>
                                </Box>
                            </Box>
                        </Box>
                    </TabPanel>

                    <TabPanel value={tabValue} index={3}>
                        <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3
                        }}>
                            <Typography variant='h6'>{t('settings.hotkeys.title')}</Typography>
                            <Typography variant='body1' sx={{ mb: 2 }}>
                                {t('settings.hotkeys.description')}
                            </Typography>

                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2
                            }}>
                                {/* Search Hotkeys */}
                                <Box>
                                    <Typography variant='subtitle1' sx={{ mb: 1, fontWeight: 600 }}>
                                        {t('settings.hotkeys.search')}
                                    </Typography>
                                    <Box sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 1
                                    }}>
                                        <Box sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            p: 1.5,
                                            bgcolor: 'background.paper',
                                            borderRadius: 1,
                                            border: '1px solid rgba(255, 255, 255, 0.12)'
                                        }}>
                                            <Typography variant='body1'>{t('settings.hotkeys.focusSearch')}</Typography>
                                            <Box sx={{
                                                display: 'flex',
                                                gap: 0.5,
                                                alignItems: 'center'
                                            }}>
                                                <KeyBadge>{commandKey}</KeyBadge>
                                                <Typography variant='body1'>+</Typography>
                                                <KeyBadge>K</KeyBadge>
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>

                                {/* Page Navigation Hotkeys */}
                                <Box>
                                    <Typography variant='subtitle1' sx={{ mb: 1, fontWeight: 600 }}>
                                        {t('settings.hotkeys.navigation')}
                                    </Typography>
                                    <Box sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 1
                                    }}>
                                        {/* Home page shortcut */}
                                        <Box sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            p: 1.5,
                                            bgcolor: 'background.paper',
                                            borderRadius: 1,
                                            border: '1px solid rgba(255, 255, 255, 0.12)'
                                        }}>
                                            <Typography variant='body1'>{t('settings.hotkeys.goHome')}</Typography>
                                            <Box sx={{
                                                display: 'flex',
                                                gap: 0.5,
                                                alignItems: 'center'
                                            }}>
                                                <KeyBadge>{commandKey}</KeyBadge>
                                                <Typography variant='body1'>+</Typography>
                                                <KeyBadge>1</KeyBadge>
                                            </Box>
                                        </Box>

                                        {/* Custom pages shortcuts */}
                                        {pages && pages.length > 0 && pages.map((page, index) => (
                                            <Box key={page.id} sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                p: 1.5,
                                                bgcolor: 'background.paper',
                                                borderRadius: 1,
                                                border: '1px solid rgba(255, 255, 255, 0.12)'
                                            }}>
                                                <Typography variant='body1'>{t('settings.hotkeys.goTo', { name: page.name })}</Typography>
                                                <Box sx={{
                                                    display: 'flex',
                                                    gap: 0.5,
                                                    alignItems: 'center'
                                                }}>
                                                    <KeyBadge>{commandKey}</KeyBadge>
                                                    <Typography variant='body1'>+</Typography>
                                                    <KeyBadge>{index + 2}</KeyBadge>
                                                </Box>
                                            </Box>
                                        ))}
                                        {/* Settings page shortcut */}
                                        <Box sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            p: 1.5,
                                            bgcolor: 'background.paper',
                                            borderRadius: 1,
                                            border: '1px solid rgba(255, 255, 255, 0.12)'
                                        }}>
                                            <Typography variant='body1'>{t('settings.hotkeys.goSettings')}</Typography>
                                            <Box sx={{
                                                display: 'flex',
                                                gap: 0.5,
                                                alignItems: 'center'
                                            }}>
                                                <KeyBadge>{commandKey}</KeyBadge>
                                                <Typography variant='body1'>+</Typography>
                                                <KeyBadge>9</KeyBadge>
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    </TabPanel>
                </Box>
            </Box>
        </FormContainer>
    );
};