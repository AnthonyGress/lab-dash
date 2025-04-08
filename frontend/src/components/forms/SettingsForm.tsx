import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, MenuItem, Tab, Tabs, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { SyntheticEvent, useEffect, useState } from 'react';
import { CheckboxElement, FormContainer, SelectElement, TextFieldElement, useForm } from 'react-hook-form-mui';
import { FaCog } from 'react-icons/fa';
import { FaClockRotateLeft, FaDatabase, FaImage } from 'react-icons/fa6';
import { useNavigate } from 'react-router-dom';

import { FileInput } from './FileInput';
import { DashApi } from '../../api/dash-api';
import { APP_VERSION } from '../../constants/version';
import { useAppContext } from '../../context/useAppContext';
import { COLORS } from '../../theme/styles';
import { Config, SearchProvider } from '../../types';
import { PopupManager } from '../modals/PopupManager';

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
    configFile?: File | null;
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
            style={{ width: '100%', height: '100%' }}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3, height: '100%' }}>
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

export const SettingsForm = () => {
    const [isCustomProvider, setIsCustomProvider] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const { config, updateConfig, refreshDashboard } = useAppContext();
    const [tabValue, setTabValue] = useState(0);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const navigate = useNavigate();
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

    // Determine initial search provider ID
    const getInitialSearchProviderId = (): string => {
        if (!config?.search || !config?.searchProvider) return 'google';

        const { name, url } = config.searchProvider;
        // Check if it matches any predefined provider
        for (const provider of SEARCH_PROVIDERS) {
            if (provider.id !== 'custom' &&
                url === provider.url &&
                (name === provider.name || !name)) {
                return provider.id;
            }
        }
        return 'custom';
    };

    const formContext = useForm<FormValues>({
        defaultValues: {
            backgroundFile: null as File | null,
            title: config?.title || '',
            search: config?.search || false,
            searchProviderId: getInitialSearchProviderId(),
            searchProvider: {
                name: config?.searchProvider?.name || '',
                url: config?.searchProvider?.url || ''
            },
            configFile: null
        }
    });

    const backgroundFile = formContext.watch('backgroundFile', null);
    const searchProviderId = formContext.watch('searchProviderId', 'google');
    const searchEnabled = formContext.watch('search', false);
    const title = formContext.watch('title', '');
    const searchProviderName = formContext.watch('searchProvider.name', '');
    const searchProviderUrl = formContext.watch('searchProvider.url', '');
    const configFile = formContext.watch('configFile', null);

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
        }
    }, [searchProviderId, formContext]);

    // Check if form values differ from current config
    useEffect(() => {
        // Check if there are changes that would be saved
        const checkForChanges = () => {
            // Title change
            if (title !== (config?.title || 'Lab Dash')) return true;

            // Background image change
            if (backgroundFile) return true;

            // Search enabled change
            if (searchEnabled !== (config?.search || false)) return true;

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
        title,
        backgroundFile,
        searchEnabled,
        searchProviderId,
        searchProviderName,
        searchProviderUrl,
        config
    ]);

    const handleTabChange = (event: SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const handleSubmit = async (data: any) => {
        try {
            console.log('Form data submitted:', data);

            const updatedConfig: Partial<Config> = {};

            if (data.backgroundFile instanceof File) {
                updatedConfig.backgroundImage = data.backgroundFile;
            }

            if (data.title.trim()) {
                updatedConfig.title = data.title;
                console.log('Setting title in updatedConfig:', data.title);
            } else {
                updatedConfig.title = 'Lab Dash';
                console.log('Using default title: Lab Dash');
            }

            if (data.search !== undefined) {
                updatedConfig.search = data.search;
            }

            // Handle search provider if search is enabled
            if (data.search && data.searchProviderId) {
                if (data.searchProviderId === 'custom' && data.searchProvider) {
                    // Use custom provider settings
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
                                    PopupManager.success('Configuration restored successfully!', () => navigate('/'));

                                    // Reset the file input
                                    formContext.resetField('configFile');
                                }
                            }
                        } catch (error) {
                            PopupManager.failure('Failed to restore configuration. The file format may be invalid.');
                            console.error('Error restoring configuration:', error);
                        }
                    };

                    fileReader.readAsText(data.configFile);
                    return; // Skip other updates when importing config
                } catch (error) {
                    PopupManager.failure('Failed to restore configuration. The file format may be invalid.');
                    console.error('Error restoring configuration:', error);
                }
            }

            console.log('Final updatedConfig to be saved:', updatedConfig);

            if (Object.keys(updatedConfig).length > 0) {
                await updateConfig(updatedConfig); // Update only the provided fields

                // Show success message
                PopupManager.success('Settings updated successfully!');
                // Refresh the form with new config values (optional)
                const refreshedConfig = await DashApi.getConfig();
                formContext.reset({
                    backgroundFile: null,
                    title: refreshedConfig?.title || '',
                    search: refreshedConfig?.search || false,
                    searchProviderId: refreshedConfig?.searchProvider ? getInitialSearchProviderId() : 'google',
                    searchProvider: {
                        name: refreshedConfig?.searchProvider?.name || '',
                        url: refreshedConfig?.searchProvider?.url || ''
                    }
                });
            }
        } catch (error) {
            // Show error message
            PopupManager.failure('Failed to update settings. Please try again.');
            console.error('Error updating settings:', error);
        }
    };

    const resetBackground = async () => {
        PopupManager.deleteConfirmation({
            title: 'Reset Background',
            text: 'This will restore the default background and remove all uploaded background images.',
            confirmText: 'Yes, Reset',
            confirmAction: async () => {
                try {
                    // First clean up all background images in the root directory
                    await DashApi.cleanBackgroundImages();

                    // Then update the config to use the default background
                    await updateConfig({ backgroundImage: '' });

                    PopupManager.success('Background has been reset');
                } catch (error) {
                    PopupManager.failure('Failed to reset background. Please try again.');
                    console.error('Error resetting background:', error);
                }
            }
        });
    };

    return (
        <FormContainer onSuccess={handleSubmit} formContext={formContext}>
            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant='h4' sx={{ p: 2 }}>Settings</Typography>
                    <Box sx={{ p: 2 }}>
                        <Button
                            variant='contained'
                            type='submit'
                            disabled={!hasChanges && !configFile}
                            sx={{
                                '&.Mui-disabled': {
                                    color: 'rgba(255, 255, 255, 0.5)'
                                }
                            }}
                        >
                            Save Changes
                        </Button>
                    </Box>
                </Box>
                <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    height: { xs: 'auto', md: '450px' },
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
                            height: { xs: 'auto', md: '100%' },
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
                        <Tab icon={<FaCog style={{ fontSize: '1.2rem' }} />} label='General' {...a11yProps(0)} />
                        <Tab icon={<FaImage style={{ fontSize: '1.2rem' }} />} label='Appearance' {...a11yProps(1)} />
                        <Tab icon={<FaClockRotateLeft style={{ fontSize: '1.2rem' }} />} label='Backup' {...a11yProps(2)} />
                    </Tabs>

                    <TabPanel value={tabValue} index={0}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <Typography variant='h6'>General Settings</Typography>

                            <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '120px 1fr', sm: '150px 1fr' },
                                gap: { xs: 1, sm: 2 },
                                alignItems: 'center'
                            }}>
                                <Typography variant='body1' sx={{
                                    alignSelf: 'center',
                                    fontSize: { xs: '0.875rem', sm: '1rem' }
                                }}>Custom Title</Typography>
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
                                }}>Enable Search</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <CheckboxElement
                                        name='search'
                                        sx={{ color: 'text.primary' }}
                                    />
                                </Box>


                                <>
                                    <Typography variant='body1' sx={{
                                        alignSelf: 'center',
                                        fontSize: { xs: '0.875rem', sm: '1rem' }
                                    }}>Search Provider</Typography>
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
                                            }}>Provider Name</Typography>
                                            <Box>
                                                <TextFieldElement
                                                    name='searchProvider.name'
                                                    sx={{ width: '95%' }}
                                                />
                                            </Box>

                                            <Box sx={{
                                                alignSelf: 'center'
                                            }}>
                                                <Typography variant='body1' sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>Search URL</Typography>
                                                <Typography variant='caption' sx={{
                                                    display: 'block',
                                                    fontSize: { xs: '0.7rem', sm: '0.75rem' }
                                                }}>
                                                        Use {'{query}'} as placeholder
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <TextFieldElement
                                                    name='searchProvider.url'
                                                    helperText='Example: https://www.google.com/search?q={query}'
                                                    sx={{ width: '95%' }}
                                                />
                                            </Box>
                                        </>
                                    )}
                                </>
                            </Box>
                            <Box sx={{
                                gridColumn: { xs: '1', sm: '1 / -1' },
                                justifySelf: 'start',
                                mt: 2
                            }}>
                                <Button
                                    variant='outlined'
                                    color='error'
                                    onClick={() => {
                                        PopupManager.deleteConfirmation({
                                            title: 'Reset All Settings',
                                            text: 'Are you sure you want to reset all settings? This cannot be undone.',
                                            confirmAction: async () => {
                                                await updateConfig({
                                                    title: 'Lab Dash',
                                                    backgroundImage: '',
                                                    search: false,
                                                    searchProvider: undefined
                                                });
                                                await refreshDashboard();
                                                PopupManager.success('All settings have been reset', () => navigate('/'));
                                            }
                                        });
                                    }}
                                >
                                        Reset All Settings
                                </Button>
                            </Box>

                            {/* Version information */}
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                width: '100%',
                                mt: 4,
                                pt: 2,
                                borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                            }}>
                                <Typography variant='body2'>
                                    Version: {APP_VERSION}
                                </Typography>
                            </Box>
                        </Box>
                    </TabPanel>

                    <TabPanel value={tabValue} index={1}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <Typography variant='h6'>Appearance Settings</Typography>

                            <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '120px 1fr', sm: '150px 1fr' },
                                gap: { xs: 1, sm: 2 },
                                alignItems: 'center'
                            }}>
                                <Typography variant='body1' sx={{
                                    alignSelf: 'center',
                                    fontSize: { xs: '0.875rem', sm: '1rem' }
                                }}>Background Image</Typography>
                                <Box sx={{ position: 'relative' }}>
                                    <FileInput
                                        name='backgroundFile'
                                        sx={{ width: '95%' }}
                                    />
                                    {backgroundFile && (
                                        <Tooltip title='Clear'>
                                            <CloseIcon
                                                onClick={() => formContext.resetField('backgroundFile')}
                                                sx={{
                                                    position: 'absolute',
                                                    right: '10px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    cursor: 'pointer',
                                                    fontSize: 22,
                                                    color: 'rgba(255, 255, 255, 0.7)',
                                                }}
                                            />
                                        </Tooltip>
                                    )}
                                </Box>

                            </Box>
                            <Box sx={{
                                gridColumn: { xs: '1', sm: '1 / -1' },
                                justifySelf: 'start',
                                mt: 2
                            }}>
                                <Button variant='outlined' onClick={resetBackground} color='error'>
                                        Reset Background
                                </Button>
                            </Box>
                        </Box>
                    </TabPanel>

                    <TabPanel value={tabValue} index={2}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <Typography variant='h6'>Backup Settings</Typography>

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

                                }}>Export Configuration</Typography>
                                <Box ml={2}>
                                    <Button
                                        variant='contained'
                                        size={isMobile ? 'small' : 'medium'}
                                        onClick={async () => {
                                            try {
                                                // Use the server-side export API instead of client-side JSON generation
                                                await DashApi.exportConfig();
                                                PopupManager.success('Configuration exported successfully!');
                                            } catch (error) {
                                                PopupManager.failure('Failed to export configuration');
                                                console.error('Error exporting configuration:', error);
                                            }
                                        }}
                                    >
                                        Export
                                    </Button>
                                </Box>

                                <Typography variant='body1' sx={{
                                    alignSelf: 'center',
                                    fontSize: { xs: '0.875rem', sm: '1rem' },
                                    width: '10rem'
                                }}>Restore Configuration</Typography>
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
                                }}>Layout Sync</Typography>
                                <Box ml={2}>
                                    <Button
                                        variant='contained'
                                        size={isMobile ? 'small' : 'medium'}
                                        onClick={async () => {
                                            try {
                                                PopupManager.deleteConfirmation({
                                                    title: 'Copy Desktop Layout to Mobile',
                                                    text: 'This will overwrite your current mobile layout with your desktop layout. Continue?',
                                                    confirmText: 'Yes, Copy',
                                                    confirmAction: async () => {
                                                        if (!config?.layout?.desktop) {
                                                            PopupManager.failure('No desktop layout found to copy');
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

                                                        PopupManager.success('Desktop layout successfully copied to mobile');
                                                    }
                                                });
                                            } catch (error) {
                                                PopupManager.failure('Failed to copy desktop layout to mobile');
                                                console.error('Error copying layout:', error);
                                            }
                                        }}
                                    >
                                        Copy Desktop Layout to Mobile
                                    </Button>
                                </Box>
                            </Box>
                        </Box>
                    </TabPanel>
                </Box>
            </Box>
        </FormContainer>
    );
};
