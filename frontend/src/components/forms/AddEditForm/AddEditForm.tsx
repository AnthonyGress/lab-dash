import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import { Box, Button, Grid2 as Grid, Paper, Typography, useMediaQuery } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CheckboxElement, FormContainer, SelectElement, TextFieldElement } from 'react-hook-form-mui';
import { useNavigate } from 'react-router-dom';

import { createWidgetConfig } from './createWidgetConfig';
import { ItemTypeSelector } from './ItemSelector';
import { useExistingItem } from './useExistingItem';
import { DashApi } from '../../../api/dash-api';
import { useAppContext } from '../../../context/useAppContext';
import { COLORS, styles } from '../../../theme/styles';
import { theme } from '../../../theme/theme';
import { DashboardItem, DOWNLOAD_CLIENT_TYPE, ITEM_TYPE, NewItem, Page, TORRENT_CLIENT_TYPE } from '../../../types';
import { isEncrypted } from '../../../utils/utils';
import { AppShortcutConfig, PlaceholderConfig, WidgetConfig } from '../configs';
import { ITEM_TYPE_OPTIONS, WIDGET_OPTIONS } from './constants';
import { FormValues } from './types';
import { WidgetSelector } from './WidgetSelector';

type Props = {
    handleClose: () => void
    existingItem?: DashboardItem | null;
    onSubmit?: (item: DashboardItem) => void;
}

export const AddEditForm = ({ handleClose, existingItem, onSubmit }: Props) => {
    const { formState: { errors } } = useForm();
    const { dashboardLayout, addItem, updateItem, addPage, refreshDashboard, pageNameToSlug, pages } = useAppContext();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const navigate = useNavigate();
    const [customIconFile, setCustomIconFile] = useState<File | null>(null);
    const [currentStep, setCurrentStep] = useState<'select' | 'widget-select' | 'configure'>(() => {
        if (existingItem) {
            return 'configure';
        }
        return 'select';
    });

    const formContext = useForm<FormValues>();

    // Initialize form with existing item data using custom hook
    useExistingItem({ existingItem, formContext, setCustomIconFile });

    const selectedItemType = formContext.watch('itemType');
    const selectedWidgetType = formContext.watch('widgetType');

    // Set default showLabel based on widget type
    useEffect(() => {
        if (selectedItemType === 'widget') {
            // Only set the default if there's no existing value (to avoid overriding user choice)
            if (formContext.getValues('showLabel') === undefined || (!existingItem && (
                selectedWidgetType === ITEM_TYPE.PIHOLE_WIDGET ||
                selectedWidgetType === ITEM_TYPE.ADGUARD_WIDGET ||
                selectedWidgetType === ITEM_TYPE.DOWNLOAD_CLIENT ||
                selectedWidgetType === ITEM_TYPE.MEDIA_SERVER_WIDGET ||
                selectedWidgetType === ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET ||
                selectedWidgetType === ITEM_TYPE.NOTES_WIDGET ||
                selectedWidgetType === ITEM_TYPE.SONARR_WIDGET ||
                selectedWidgetType === ITEM_TYPE.RADARR_WIDGET ||
                selectedWidgetType === ITEM_TYPE.DUAL_WIDGET
            ))) {
                if (selectedWidgetType === ITEM_TYPE.PIHOLE_WIDGET ||
                    selectedWidgetType === ITEM_TYPE.ADGUARD_WIDGET ||
                    selectedWidgetType === ITEM_TYPE.DOWNLOAD_CLIENT ||
                    selectedWidgetType === ITEM_TYPE.MEDIA_SERVER_WIDGET ||
                    selectedWidgetType === ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET ||
                    selectedWidgetType === ITEM_TYPE.NOTES_WIDGET ||
                    selectedWidgetType === ITEM_TYPE.SONARR_WIDGET ||
                    selectedWidgetType === ITEM_TYPE.RADARR_WIDGET ||
                    selectedWidgetType === ITEM_TYPE.DUAL_WIDGET) {
                    formContext.setValue('showLabel', true);
                } else {
                    formContext.setValue('showLabel', false);
                }
            }
        }
    }, [selectedItemType, selectedWidgetType, formContext, existingItem]);

    // Automatically set shortcutName to "Group" for new group widgets
    useEffect(() => {
        if (!existingItem && selectedItemType === 'widget' && selectedWidgetType === ITEM_TYPE.GROUP_WIDGET) {
            formContext.setValue('shortcutName', 'Group');
        }
    }, [selectedItemType, selectedWidgetType, existingItem, formContext]);

    const handleCustomIconSelect = (file: File | null) => {
        setCustomIconFile(file);
    };

    // Helper function to scroll to top of form
    const scrollToTop = () => {
        // Use a small delay to ensure the step has rendered
        setTimeout(() => {
            // Find the scrollable div with MuiBox-root css-i0qe32 classes
            const scrollableDiv = document.querySelector('.MuiBox-root.css-i0qe32');
            if (scrollableDiv && scrollableDiv.scrollTo) {
                scrollableDiv.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                // Fallback: try to find any scrollable element in the modal
                const modalContent = document.querySelector('[role="dialog"] [style*="overflow"]');
                if (modalContent && modalContent.scrollTo) {
                    modalContent.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    // Last fallback to window scroll
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
        }, 100);
    };

    // Enhanced step change function
    const handleStepChange = (newStep: React.SetStateAction<'select' | 'widget-select' | 'configure'>) => {
        // Handle both direct values and function updates
        const resolvedStep = typeof newStep === 'function' ? newStep(currentStep) : newStep;
        setCurrentStep(resolvedStep);
        scrollToTop();
    };

    const handleSubmit = async (data: FormValues) => {
        // Handle page creation/editing
        if (data.itemType === ITEM_TYPE.PAGE) {
            if (data.pageName) {
                try {
                    if (existingItem && onSubmit) {
                        // This is editing an existing page
                        const updatedPageItem = {
                            ...existingItem,
                            label: data.pageName,
                            adminOnly: data.adminOnly
                        };
                        onSubmit(updatedPageItem as DashboardItem);
                        handleFormClose();
                    } else {
                        // This is creating a new page
                        const newPageId = await addPage(data.pageName, data.adminOnly);
                        handleFormClose();

                        if (newPageId) {
                            // Wait a brief moment for state to update, then navigate to the newly created page
                            setTimeout(() => {
                                const pageSlug = pageNameToSlug(data.pageName!);
                                navigate(`/${pageSlug}`);
                            }, 100);
                        }
                    }
                } catch (error) {
                    console.error('Error with page operation:', error);
                    // Set form error for the pageName field
                    formContext.setError('pageName', {
                        type: 'manual',
                        message: error instanceof Error ? error.message : 'Failed to save page'
                    });
                }
            }
            return;
        }

        let iconData = data.icon;

        if (customIconFile && data.icon?.source === 'custom-pending') {
            try {
                const uploadedIcon = await DashApi.uploadAppIcon(customIconFile);

                if (uploadedIcon) {
                    iconData = uploadedIcon;
                } else {
                    console.error('Failed to get a valid response from upload');
                }
            } catch (error) {
                console.error('Error uploading custom icon:', error);
            }
        }

        let config: any = undefined;
        if (data.itemType === 'widget') {
            if (data.widgetType === ITEM_TYPE.WEATHER_WIDGET) {
                config = {
                    temperatureUnit: data.temperatureUnit || 'fahrenheit',
                    location: data.location || undefined
                };
            } else if (data.widgetType === ITEM_TYPE.DATE_TIME_WIDGET) {
                config = {
                    location: data.location || undefined,
                    timezone: data.timezone || null
                };
            } else if (data.widgetType === ITEM_TYPE.SYSTEM_MONITOR_WIDGET) {
                config = {
                    temperatureUnit: data.temperatureUnit || 'fahrenheit',
                    gauges: [data.gauge1, data.gauge2, data.gauge3],
                    showDiskUsage: data.showDiskUsage !== false, // Default to true
                    showSystemInfo: data.showSystemInfo !== false, // Default to true
                    showInternetStatus: data.showInternetStatus !== false // Default to true
                };

                // Add network interface to config if a network gauge is included
                if ([data.gauge1, data.gauge2, data.gauge3].includes('network') && data.networkInterface) {
                    (config as any).networkInterface = data.networkInterface;
                }
            } else if (data.widgetType === ITEM_TYPE.PIHOLE_WIDGET) {
                // Handle masked values - only encrypt if not masked
                let encryptedToken = '';
                let encryptedPassword = '';
                let hasExistingApiToken = false;
                let hasExistingPassword = false;

                // Check if we're editing an existing item with sensitive data
                if (existingItem?.config) {
                    hasExistingApiToken = !!existingItem.config._hasApiToken;
                    hasExistingPassword = !!existingItem.config._hasPassword;
                }

                // Only process API token if it's not the masked value
                if (data.piholeApiToken && data.piholeApiToken !== '**********') {
                    if (!isEncrypted(data.piholeApiToken)) {
                        try {
                            encryptedToken = await DashApi.encryptPiholeToken(data.piholeApiToken);
                        } catch (error) {
                            console.error('Error encrypting Pi-hole API token:', error);
                        }
                    } else {
                        encryptedToken = data.piholeApiToken;
                    }
                }

                // Only process password if it's not the masked value
                if (data.piholePassword && data.piholePassword !== '**********') {
                    if (!isEncrypted(data.piholePassword)) {
                        try {
                            encryptedPassword = await DashApi.encryptPiholePassword(data.piholePassword);
                        } catch (error) {
                            console.error('Error encrypting Pi-hole password:', error);
                        }
                    } else {
                        encryptedPassword = data.piholePassword;
                    }
                }

                const baseConfig = {
                    host: data.piholeHost,
                    port: data.piholePort,
                    ssl: data.piholeSsl,
                    showLabel: data.showLabel,
                    displayName: data.piholeName || 'Pi-hole'
                };

                // Include sensitive fields if they were actually changed (not masked)
                if (encryptedToken) {
                    config = { ...baseConfig, apiToken: encryptedToken };
                } else if (hasExistingApiToken) {
                    // If we have an existing API token but no new token provided, set the flag
                    config = { ...baseConfig, _hasApiToken: true };
                } else {
                    config = baseConfig;
                }

                // Include password if it was actually changed (not masked)
                if (encryptedPassword) {
                    config = { ...config, password: encryptedPassword };
                } else if (hasExistingPassword) {
                    // If we have an existing password but no new password provided, set the flag
                    config = { ...config, _hasPassword: true };
                }
            } else if (data.widgetType === ITEM_TYPE.ADGUARD_WIDGET) {
                // Handle masked values - only encrypt if not masked
                let encryptedUsername = '';
                let encryptedPassword = '';
                let hasExistingUsername = false;
                let hasExistingPassword = false;

                // Check if we're editing an existing item with sensitive data
                if (existingItem?.config) {
                    hasExistingUsername = !!existingItem.config._hasUsername;
                    hasExistingPassword = !!existingItem.config._hasPassword;
                }

                // Only process username if it's not the masked value
                if (data.adguardUsername && data.adguardUsername !== '**********') {
                    if (!isEncrypted(data.adguardUsername)) {
                        try {
                            encryptedUsername = await DashApi.encryptAdGuardUsername(data.adguardUsername);
                        } catch (error) {
                            console.error('Error encrypting AdGuard username:', error);
                        }
                    } else {
                        encryptedUsername = data.adguardUsername;
                    }
                }

                // Only process password if it's not the masked value
                if (data.adguardPassword && data.adguardPassword !== '**********') {
                    if (!isEncrypted(data.adguardPassword)) {
                        try {
                            encryptedPassword = await DashApi.encryptAdGuardPassword(data.adguardPassword);
                        } catch (error) {
                            console.error('Error encrypting AdGuard password:', error);
                        }
                    } else {
                        encryptedPassword = data.adguardPassword;
                    }
                }

                const baseConfig = {
                    host: data.adguardHost,
                    port: data.adguardPort,
                    ssl: data.adguardSsl,
                    showLabel: data.showLabel,
                    displayName: data.adguardName || 'AdGuard Home'
                };

                // Include sensitive fields if they were actually changed (not masked)
                if (encryptedUsername && encryptedPassword) {
                    config = {
                        ...baseConfig,
                        username: encryptedUsername,
                        password: encryptedPassword
                    };
                } else {
                    config = baseConfig;
                    // If we have existing credentials but no new ones provided, set the flags
                    if (hasExistingUsername) {
                        config = { ...config, _hasUsername: true };
                    }
                    if (hasExistingPassword) {
                        config = { ...config, _hasPassword: true };
                    }
                }
            } else if (data.widgetType === ITEM_TYPE.DOWNLOAD_CLIENT) {
                // Download client widget - use tc* fields for all client types
                let encryptedPassword = '';
                let hasExistingPassword = false;

                // Check if we're editing an existing item with a password
                if ((existingItem?.type === ITEM_TYPE.DOWNLOAD_CLIENT || existingItem?.type === ITEM_TYPE.TORRENT_CLIENT) && existingItem?.id) {
                    hasExistingPassword = true;
                }

                // Only process password if it's not the masked value
                if (data.tcPassword && data.tcPassword !== '**********') {
                    if (!isEncrypted(data.tcPassword)) {
                        try {
                            if (data.torrentClientType === DOWNLOAD_CLIENT_TYPE.SABNZBD) {
                                encryptedPassword = await DashApi.encryptSabnzbdPassword(data.tcPassword);
                            } else {
                                encryptedPassword = await DashApi.encryptPassword(data.tcPassword);
                            }
                        } catch (error) {
                            console.error('Error encrypting download client password:', error);
                        }
                    } else {
                        encryptedPassword = data.tcPassword;
                    }
                }

                const baseConfig: any = {
                    clientType: data.torrentClientType,
                    host: data.tcHost,
                    port: data.tcPort,
                    ssl: data.tcSsl,
                    showLabel: data.showLabel
                };

                // Include username for clients that need it (not SABnzbd)
                if (data.torrentClientType !== DOWNLOAD_CLIENT_TYPE.SABNZBD && data.tcUsername) {
                    baseConfig.username = data.tcUsername;
                }

                // Include password if it was actually changed (not masked)
                if (encryptedPassword) {
                    baseConfig.password = encryptedPassword;
                } else if (hasExistingPassword) {
                    // If we have an existing password but no new password provided, set the flag
                    baseConfig._hasPassword = true;
                }

                config = baseConfig;
            } else if (data.widgetType === ITEM_TYPE.MEDIA_SERVER_WIDGET) {
                // Media server widget - use ms* fields for all server types
                config = {
                    clientType: data.mediaServerType || 'jellyfin',
                    displayName: data.mediaServerName || '',
                    host: data.msHost || '',
                    port: data.msPort || '8096',
                    ssl: data.msSsl || false,
                    showLabel: data.showLabel !== undefined ? data.showLabel : true
                };

                // Handle API key - if masked, set flag for backend to preserve existing key
                if (data.msApiKey === '**********') {
                    // API key is masked - tell backend to preserve existing key
                    config._hasApiKey = true;
                } else if (data.msApiKey && data.msApiKey.trim() !== '') {
                    // API key was changed - encrypt and include it
                    if (!isEncrypted(data.msApiKey)) {
                        try {
                            const encryptedApiKey = await DashApi.encryptPassword(data.msApiKey);
                            config.apiKey = encryptedApiKey;
                        } catch (error) {
                            console.error('Error encrypting media server API key:', error);
                        }
                    } else {
                        config.apiKey = data.msApiKey;
                    }
                }
            } else if (data.widgetType === ITEM_TYPE.DISK_MONITOR_WIDGET) {
                // Disk monitor widget configuration
                config = await createWidgetConfig(ITEM_TYPE.DISK_MONITOR_WIDGET, data, existingItem, formContext);
            } else if (data.widgetType === ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET) {
                // Media request widget configuration
                config = await createWidgetConfig(ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET, data, existingItem, formContext);
            } else if (data.widgetType === ITEM_TYPE.NOTES_WIDGET) {
                // Notes widget configuration
                config = await createWidgetConfig(ITEM_TYPE.NOTES_WIDGET, data, existingItem, formContext);

                // If updating an existing Notes widget and the default font size changed, update all notes
                if (existingItem && data.defaultNoteFontSize && existingItem.config?.defaultNoteFontSize !== data.defaultNoteFontSize) {
                    try {
                        const result = await DashApi.updateAllNotesFontSize(data.defaultNoteFontSize);
                        console.log(`Updated font size for ${result.updatedCount} notes to ${data.defaultNoteFontSize}`);
                    } catch (error) {
                        console.error('Error updating existing notes font size:', error);
                    }
                }
            } else if (data.widgetType === ITEM_TYPE.SONARR_WIDGET) {
                // Sonarr widget configuration
                config = await createWidgetConfig(ITEM_TYPE.SONARR_WIDGET, data, existingItem, formContext);
            } else if (data.widgetType === ITEM_TYPE.RADARR_WIDGET) {
                // Radarr widget configuration
                config = await createWidgetConfig(ITEM_TYPE.RADARR_WIDGET, data, existingItem, formContext);
            } else if (data.widgetType === ITEM_TYPE.GROUP_WIDGET) {
                // Group widget configuration
                config = await createWidgetConfig(ITEM_TYPE.GROUP_WIDGET, data, existingItem, formContext);
            } else if (data.widgetType === ITEM_TYPE.DUAL_WIDGET) {
                // Check if DualWidgetConfig component has already built the config
                const existingConfig = (formContext as any).getValues('config');

                if (existingConfig && existingConfig.topWidget && existingConfig.bottomWidget) {
                    // Use the config built by DualWidgetConfig component (preserves sensitive data flags)
                    config = existingConfig;
                } else {
                    // Fallback to building config from form data (for backwards compatibility)

                    // Ensure neither widget type is DOWNLOAD_CLIENT
                    if (data.topWidgetType === ITEM_TYPE.DOWNLOAD_CLIENT ||
                        data.bottomWidgetType === ITEM_TYPE.DOWNLOAD_CLIENT) {
                        console.error('DOWNLOAD_CLIENT widget is not supported in Dual Widget');
                        // Replace DOWNLOAD_CLIENT with DATE_TIME_WIDGET as a fallback
                        if (data.topWidgetType === ITEM_TYPE.DOWNLOAD_CLIENT) {
                            data.topWidgetType = ITEM_TYPE.DATE_TIME_WIDGET;
                        }
                        if (data.bottomWidgetType === ITEM_TYPE.DOWNLOAD_CLIENT) {
                            data.bottomWidgetType = ITEM_TYPE.DATE_TIME_WIDGET;
                        }
                    }

                    // Create custom data objects for top and bottom widgets with proper field mapping
                    const topWidgetData = {
                        ...data,
                        // Map position-specific fields to standard fields for the createWidgetConfig function
                        temperatureUnit: data.top_temperatureUnit,
                        location: data.top_location,
                        timezone: data.top_timezone,
                        gauge1: data.top_gauge1,
                        gauge2: data.top_gauge2,
                        gauge3: data.top_gauge3,
                        networkInterface: data.top_networkInterface,
                        showDiskUsage: data.top_showDiskUsage,
                        showSystemInfo: data.top_showSystemInfo,
                        showInternetStatus: data.top_showInternetStatus,
                        selectedDisks: data.top_selectedDisks,
                        showIcons: data.top_showIcons,
                        showMountPath: data.top_showMountPath,
                        showName: data.top_showName,
                        piholeHost: data.top_piholeHost,
                        piholePort: data.top_piholePort,
                        piholeSsl: data.top_piholeSsl,
                        piholeApiToken: data.top_piholeApiToken,
                        piholePassword: data.top_piholePassword,
                        piholeName: data.top_piholeName,
                        adguardHost: data.top_adguardHost,
                        adguardPort: data.top_adguardPort,
                        adguardSsl: data.top_adguardSsl,
                        adguardUsername: data.top_adguardUsername,
                        adguardPassword: data.top_adguardPassword,
                        adguardName: data.top_adguardName,
                        showLabel: data.top_showLabel
                    };

                    const bottomWidgetData = {
                        ...data,
                        // Map position-specific fields to standard fields for the createWidgetConfig function
                        temperatureUnit: data.bottom_temperatureUnit,
                        location: data.bottom_location,
                        timezone: data.bottom_timezone,
                        gauge1: data.bottom_gauge1,
                        gauge2: data.bottom_gauge2,
                        gauge3: data.bottom_gauge3,
                        networkInterface: data.bottom_networkInterface,
                        showDiskUsage: data.bottom_showDiskUsage,
                        showSystemInfo: data.bottom_showSystemInfo,
                        showInternetStatus: data.bottom_showInternetStatus,
                        selectedDisks: data.bottom_selectedDisks,
                        showIcons: data.bottom_showIcons,
                        showMountPath: data.bottom_showMountPath,
                        showName: data.bottom_showName,
                        piholeHost: data.bottom_piholeHost,
                        piholePort: data.bottom_piholePort,
                        piholeSsl: data.bottom_piholeSsl,
                        piholeApiToken: data.bottom_piholeApiToken,
                        piholePassword: data.bottom_piholePassword,
                        piholeName: data.bottom_piholeName,
                        adguardHost: data.bottom_adguardHost,
                        adguardPort: data.bottom_adguardPort,
                        adguardSsl: data.bottom_adguardSsl,
                        adguardUsername: data.bottom_adguardUsername,
                        adguardPassword: data.bottom_adguardPassword,
                        adguardName: data.bottom_adguardName,
                        showLabel: data.bottom_showLabel
                    };

                    const topConfig: any = await createWidgetConfig(data.topWidgetType || '', topWidgetData, existingItem, formContext);
                    const bottomConfig: any = await createWidgetConfig(data.bottomWidgetType || '', bottomWidgetData, existingItem, formContext);

                    config = {
                        topWidget: {
                            type: data.topWidgetType,
                            config: topConfig
                        },
                        bottomWidget: {
                            type: data.bottomWidgetType,
                            config: bottomConfig
                        }
                    };
                }
            }
        } else if (data.itemType === ITEM_TYPE.APP_SHORTCUT) {
            config = {};

            // Add Wake-on-LAN config if enabled
            if (data.isWol) {
                config = {
                    ...config,
                    isWol: true,
                    macAddress: data.macAddress,
                    broadcastAddress: data.broadcastAddress,
                    port: data.port
                };
            }

            // Add health URL if provided
            if (data.healthUrl) {
                config = {
                    ...config,
                    healthUrl: data.healthUrl,
                    healthCheckType: data.healthCheckType || 'http'
                };
            }

            // If no config options were added, set config to undefined
            if (Object.keys(config).length === 0) {
                config = undefined;
            }
        }

        const url = (data.itemType === ITEM_TYPE.APP_SHORTCUT && data.isWol)
            ? (data.url || '#')
            : data.url; // Allow URL to be undefined when health URL is provided but no URL is set

        // Determine the actual item type based on form data
        let actualItemType = data.itemType;
        if (data.itemType === 'widget' && data.widgetType) {
            actualItemType = data.widgetType;
        } else if (data.itemType === ITEM_TYPE.PLACEHOLDER && data.placeholderSize) {
            // Map placeholder size to legacy types for backward compatibility
            switch (data.placeholderSize) {
            case 'app':
                actualItemType = ITEM_TYPE.BLANK_APP;
                break;
            case 'widget':
                actualItemType = ITEM_TYPE.BLANK_WIDGET;
                break;
            case 'row':
                actualItemType = ITEM_TYPE.BLANK_ROW;
                break;
            default:
                actualItemType = ITEM_TYPE.BLANK_APP;
            }
        }

        // Generate label for DOWNLOAD_CLIENT widgets if not provided
        let itemLabel = data.shortcutName || '';
        if (actualItemType === ITEM_TYPE.DOWNLOAD_CLIENT && !itemLabel) {
            const clientType = data.torrentClientType || DOWNLOAD_CLIENT_TYPE.QBITTORRENT;
            const clientName = clientType === DOWNLOAD_CLIENT_TYPE.DELUGE ? 'Deluge'
                : clientType === DOWNLOAD_CLIENT_TYPE.TRANSMISSION ? 'Transmission'
                    : clientType === DOWNLOAD_CLIENT_TYPE.SABNZBD ? 'SABnzbd'
                        : 'qBittorrent';
            itemLabel = `${clientName} Client`;
        }

        const updatedItem: NewItem = {
            label: itemLabel,
            icon: iconData ? {
                path: iconData.path,
                name: iconData.name,
                source: iconData.source
            } : undefined,
            url,
            type: actualItemType,
            showLabel: data.showLabel,
            config: config,
            adminOnly: data.adminOnly
        };

        try {
            if (existingItem) {
                // If onSubmit prop is provided, we're editing within a group context
                // This is more reliable than trying to detect group items by their absence from dashboardLayout
                if (onSubmit) {
                    // This is an item being edited within a group widget
                    const updated = {
                        ...existingItem,
                        ...updatedItem
                    };
                    onSubmit(updated as DashboardItem);

                    // Don't call refreshDashboard() for group items as it can cause duplication
                    // The group widget's updateGroupItem function handles the state updates properly
                } else {
                    // This is a regular dashboard item
                    await updateItem(existingItem.id, updatedItem);

                    // Refresh the dashboard to ensure all widgets are updated with latest data
                    await refreshDashboard();
                }
            } else {
                await addItem(updatedItem);

                // Refresh the dashboard to ensure all widgets are updated with latest data
                await refreshDashboard();
            }

            formContext.reset();
            handleFormClose();
        } catch (error) {
            console.error('Error submitting form:', error);
            // Still close the form even if there's an error
            formContext.reset();
            handleFormClose();
        }
    };

    const handleFormClose = () => {
        setCustomIconFile(null);
        setCurrentStep(existingItem ? 'configure' : 'select');
        formContext.reset();
        handleClose();
    };

    return (
        <Grid
            container
            justifyContent='center'
            alignItems='center'
            key={existingItem ? `item-${existingItem.id}` : 'new-item'}
        >
            <Grid>
                <Box
                    sx={{
                        p: 2,
                        borderRadius: '8px',
                        boxShadow: 3,
                        backgroundColor: COLORS.GRAY,
                        width: { xs: '80vw', sm: '70vw', md: '40vw', lg: '45vw' }
                    }}
                >
                    <FormContainer
                        onSuccess={handleSubmit}
                        formContext={formContext}
                        key={existingItem ? `form-${existingItem.id}` : 'new-form'}
                    >
                        <Grid container spacing={2} sx={styles.vcenter}>
                            {currentStep === 'select' && (
                                <Grid>
                                    <ItemTypeSelector formContext={formContext} setCurrentStep={handleStepChange}/>
                                </Grid>
                            )}

                            {currentStep === 'widget-select' && (
                                <>
                                    <Grid sx={{
                                        width: '100%',
                                        mb: 0,
                                        display: 'flex',
                                        flexDirection: { xs: 'column', sm: 'row' },
                                        alignItems: { xs: 'flex-start', sm: 'center' },
                                        position: 'relative',
                                        gap: { xs: 1, sm: 0 }
                                    }}>
                                        <Button
                                            variant='outlined'
                                            onClick={() => handleStepChange('select')}
                                            sx={{
                                                color: 'text.primary',
                                                borderColor: 'text.primary',
                                                '&:hover': {
                                                    borderColor: theme.palette.primary.main,
                                                    backgroundColor: `${theme.palette.primary.main}10`
                                                }
                                            }}
                                            startIcon={<ArrowBackIosIcon />}
                                        >
                                            Back
                                        </Button>

                                        <Typography variant='h6' sx={{
                                            color: 'text.primary',
                                            position: { xs: 'static', sm: 'absolute' },
                                            left: { xs: 'auto', sm: '50%' },
                                            transform: { xs: 'none', sm: 'translateX(-50%)' },
                                            textAlign: 'center',
                                            width: { xs: '100%', sm: 'auto' },
                                        }}>
                                            Select Widget
                                        </Typography>
                                    </Grid>

                                    <Grid>
                                        <WidgetSelector formContext={formContext} setCurrentStep={handleStepChange}/>
                                    </Grid>
                                </>
                            )}

                            {currentStep === 'configure' && (
                                <>
                                    <Grid sx={{
                                        width: '100%',
                                        mb: 1,
                                        display: 'flex',
                                        flexDirection: { xs: 'column', sm: 'row' },
                                        alignItems: { xs: 'flex-start', sm: 'center' },
                                        position: 'relative',
                                        gap: { xs: 1, sm: 0 }
                                    }}>
                                        <Button
                                            variant='outlined'
                                            onClick={() => {
                                                if (selectedItemType === 'widget') {
                                                    handleStepChange('widget-select');
                                                } else {
                                                    handleStepChange('select');
                                                }
                                            }}
                                            sx={{
                                                color: 'text.primary',
                                                borderColor: 'text.primary',
                                                '&:hover': {
                                                    borderColor: theme.palette.primary.main,
                                                    backgroundColor: `${theme.palette.primary.main}10`
                                                }
                                            }}
                                            startIcon={<ArrowBackIosIcon />}
                                        >
                                            Back
                                        </Button>

                                        <Typography variant='h6' sx={{
                                            color: 'text.primary',
                                            position: { xs: 'static', sm: 'absolute' },
                                            left: { xs: 'auto', sm: '50%' },
                                            transform: { xs: 'none', sm: 'translateX(-50%)' },
                                            textAlign: 'center',
                                            width: { xs: '100%', sm: 'calc(100% - 120px)' },
                                            maxWidth: { xs: '100%', sm: '400px' },
                                            whiteSpace: { xs: 'normal', sm: 'nowrap' },
                                            overflow: { xs: 'visible', sm: 'hidden' },
                                            textOverflow: { xs: 'clip', sm: 'ellipsis' }
                                        }}>
                                            Configure {selectedItemType === 'widget'
                                                ? WIDGET_OPTIONS.find(opt => opt.id === selectedWidgetType)?.label
                                                : ITEM_TYPE_OPTIONS.find(opt => opt.id === selectedItemType)?.label}
                                        </Typography>
                                    </Grid>

                                    {selectedItemType === ITEM_TYPE.PAGE && (
                                        <>
                                            <Grid>
                                                <TextFieldElement
                                                    label='Page Name'
                                                    name='pageName'
                                                    required
                                                    fullWidth
                                                    sx={{
                                                        '& .MuiOutlinedInput-root': {
                                                            '& fieldset': {
                                                                borderColor: 'text.primary',
                                                            },
                                                            '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                                            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
                                                        },
                                                        width: '100%',
                                                        minWidth: isMobile ? '65vw' : '20vw'
                                                    }}
                                                    helperText='Pages are added to the navigation menu'
                                                    slotProps={{
                                                        inputLabel: { style: { color: theme.palette.text.primary } }
                                                    }}
                                                    rules={{
                                                        required: 'Page name is required',
                                                        validate: (value: string) => {
                                                            if (!value) return 'Page name is required';

                                                            // Check if it contains only alphanumeric characters and spaces
                                                            const allowedCharsRegex = /^[a-zA-Z0-9\s]+$/;
                                                            if (!allowedCharsRegex.test(value)) {
                                                                return 'Page name can only contain letters, numbers, and spaces';
                                                            }

                                                            // Check if it's the word "settings" (case-insensitive)
                                                            if (value.toLowerCase() === 'settings') {
                                                                return 'Page name cannot be "settings"';
                                                            }

                                                            // Check for duplicate page names (case-insensitive)
                                                            const existingPages = pages || [];
                                                            const isDuplicate = existingPages.some((page: Page) =>
                                                                page.name.toLowerCase() === value.toLowerCase() &&
                                                                page.id !== existingItem?.id
                                                            );
                                                            if (isDuplicate) {
                                                                return `A page named "${value}" already exists. Please choose a different name.`;
                                                            }

                                                            return true;
                                                        }
                                                    }}
                                                />
                                            </Grid>

                                            <Grid>
                                                <CheckboxElement
                                                    label='Admin Only'
                                                    name='adminOnly'
                                                    checked={formContext.watch('adminOnly')}
                                                    sx={{
                                                        ml: 1,
                                                        color: 'white',
                                                        '& .MuiSvgIcon-root': { fontSize: 30 },
                                                        '& .MuiFormHelperText-root': {
                                                            marginLeft: 1,
                                                            fontSize: '0.75rem',
                                                            color: 'rgba(255, 255, 255, 0.7)'
                                                        }
                                                    }}
                                                />
                                            </Grid>
                                        </>
                                    )}

                                    {/* Widget specific configurations */}
                                    {selectedItemType === 'widget' && selectedWidgetType && (
                                        <>
                                            <WidgetConfig formContext={formContext} widgetType={selectedWidgetType} existingItem={existingItem} />

                                            {/* Admin Only checkbox for widget types - keep this outside the WidgetConfig component */}
                                            <Grid>
                                                <CheckboxElement
                                                    label='Admin Only'
                                                    name='adminOnly'
                                                    checked={formContext.watch('adminOnly')}

                                                    sx={{
                                                        ml: 1,
                                                        color: 'white',
                                                        '& .MuiSvgIcon-root': { fontSize: 30 },
                                                        '& .MuiFormHelperText-root': {
                                                            marginLeft: 1,
                                                            fontSize: '0.75rem',
                                                            color: 'rgba(255, 255, 255, 0.7)'
                                                        }
                                                    }}
                                                />
                                            </Grid>
                                        </>
                                    )}

                                    {selectedItemType === ITEM_TYPE.APP_SHORTCUT && (
                                        <AppShortcutConfig formContext={formContext} onCustomIconSelect={handleCustomIconSelect} />
                                    )}

                                    {selectedItemType === ITEM_TYPE.PLACEHOLDER && (
                                        <PlaceholderConfig formContext={formContext} />
                                    )}

                                    {(selectedItemType === ITEM_TYPE.BLANK_WIDGET || selectedItemType === ITEM_TYPE.BLANK_ROW || selectedItemType === ITEM_TYPE.BLANK_APP) && (
                                        <Grid>
                                            <CheckboxElement
                                                label='Admin Only'
                                                name='adminOnly'
                                                checked={formContext.watch('adminOnly')}
                                                sx={{
                                                    ml: 1,
                                                    color: 'white',
                                                    '& .MuiSvgIcon-root': { fontSize: 30 },
                                                    '& .MuiFormHelperText-root': {
                                                        marginLeft: 1,
                                                        fontSize: '0.75rem',
                                                        color: 'rgba(255, 255, 255, 0.7)'
                                                    }
                                                }}
                                            />
                                        </Grid>
                                    )}

                                    <Grid sx={{ width: '100%', display: 'flex', justifyContent: 'center', mt: 2 }}>
                                        <Button variant='contained' type='submit' sx={{ minHeight: '3rem' }} fullWidth>
                                            {existingItem ? 'Update' : 'Add'}
                                        </Button>
                                    </Grid>
                                </>
                            )}
                        </Grid>
                    </FormContainer>
                </Box>
            </Grid>
        </Grid>
    );
};
