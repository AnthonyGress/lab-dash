import { Box, FormControlLabel, Grid2 as Grid, Radio, RadioGroup, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, TextFieldElement } from 'react-hook-form-mui';

import { useIsMobile } from '../../../hooks/useIsMobile';
import { COLORS } from '../../../theme/styles';
import { theme } from '../../../theme/theme';
import { DOWNLOAD_CLIENT_TYPE, TORRENT_CLIENT_TYPE } from '../../../types';
import { FormValues } from '../AddEditForm/types';

const DOWNLOAD_CLIENT_OPTIONS = [
    { id: DOWNLOAD_CLIENT_TYPE.QBITTORRENT, label: 'qBittorrent' },
    { id: DOWNLOAD_CLIENT_TYPE.DELUGE, label: 'Deluge' },
    { id: DOWNLOAD_CLIENT_TYPE.TRANSMISSION, label: 'Transmission' },
    { id: DOWNLOAD_CLIENT_TYPE.SABNZBD, label: 'SABnzbd' },
    { id: DOWNLOAD_CLIENT_TYPE.NZBGET, label: 'NZBGet' }
];

interface DownloadClientWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
    existingItem?: any; // Pass existing item to check for security flags
}

const MASKED_VALUE = '**********'; // 10 asterisks for masked values

export const DownloadClientWidgetConfig = ({ formContext, existingItem }: DownloadClientWidgetConfigProps) => {
    const isMobile = useIsMobile();

    // Watch the torrent client type directly from the form
    const watchedTorrentClientType = formContext.watch('torrentClientType');
    const [torrentClientType, setTorrentClientType] = useState<string>(
        watchedTorrentClientType || formContext.getValues('torrentClientType') || DOWNLOAD_CLIENT_TYPE.QBITTORRENT
    );

    // Track if we're editing an existing item with sensitive data
    const [hasExistingPassword, setHasExistingPassword] = useState(false);

    // Track if user is intentionally clearing the password field
    const [userClearedPassword, setUserClearedPassword] = useState(false);

    // Initialize masked values for existing items
    useEffect(() => {
        // Reset state when existingItem changes
        setHasExistingPassword(false);
        setUserClearedPassword(false);

        // Check if the form already has a masked password value (set by AddEditForm)
        // This is more reliable than checking existingItem since existingItem is filtered
        const currentPassword = formContext.getValues('tcPassword');

        if (currentPassword === MASKED_VALUE) {
            setHasExistingPassword(true);
        } else if (existingItem?.config) {
            // Fallback: check existingItem config for security flag (though it may not be present in filtered data)
            const config = existingItem.config;

            if (config._hasPassword) {
                setHasExistingPassword(true);

                // Ensure the masked value is set if not already present
                if (!currentPassword || currentPassword === '') {
                    console.log('DownloadClientWidgetConfig: Setting masked password');
                    formContext.setValue('tcPassword', MASKED_VALUE, { shouldValidate: false });
                }
            }
        }
    }, [existingItem?.config?._hasPassword, existingItem?.id, formContext]);

    useEffect(() => {
        if (watchedTorrentClientType) {
            setTorrentClientType(watchedTorrentClientType);

            // Determine the default port for the selected client type
            const defaultPort = watchedTorrentClientType === DOWNLOAD_CLIENT_TYPE.DELUGE ? '8112'
                : watchedTorrentClientType === DOWNLOAD_CLIENT_TYPE.TRANSMISSION ? '9091'
                    : watchedTorrentClientType === DOWNLOAD_CLIENT_TYPE.SABNZBD ? '8080'
                        : watchedTorrentClientType === DOWNLOAD_CLIENT_TYPE.NZBGET ? '6789'
                            : '8080';

            // For new widgets (no existingItem), always update the port to the default
            // For existing widgets, only update if the current port is empty
            const currentPort = formContext.getValues('tcPort');
            if (!existingItem || !currentPort || currentPort === '') {
                formContext.setValue('tcPort', defaultPort);
            }

            // Clear validation errors for username and password when switching to Transmission
            if (watchedTorrentClientType === DOWNLOAD_CLIENT_TYPE.TRANSMISSION) {
                formContext.clearErrors('tcUsername');
                formContext.clearErrors('tcPassword');
                formContext.trigger(['tcUsername', 'tcPassword']);
            }
        }
    }, [watchedTorrentClientType, formContext, existingItem]);

    // Watch for password field changes to track user intent
    useEffect(() => {
        if (hasExistingPassword) {
            const currentPassword = formContext.watch('tcPassword');

            // If user clears the masked value, mark it as intentionally cleared
            if (currentPassword === '' && !userClearedPassword) {
                setUserClearedPassword(true);
            }
            // If user enters a new value after clearing, reset the flag
            else if (currentPassword && currentPassword !== MASKED_VALUE && userClearedPassword) {
                setUserClearedPassword(false);
            }
        }
    }, [formContext.watch('tcPassword'), hasExistingPassword, userClearedPassword]);

    return (
        <>
            <Grid>
                <Box sx={{ mb: 2, mt: 1 }}>
                    <Typography
                        variant='body2'
                        sx={{
                            color: 'white',
                            mb: 1,
                            ml: 1
                        }}
                    >
                        Select Download Client:
                    </Typography>
                    <RadioGroup
                        name='torrentClientType'
                        value={torrentClientType}
                        onChange={(e) => {
                            setTorrentClientType(e.target.value);
                            formContext.setValue('torrentClientType', e.target.value);
                        }}
                        sx={{
                            flexDirection: 'row',
                            ml: 1,
                            '& .MuiFormControlLabel-label': {
                                color: 'white'
                            }
                        }}
                    >
                        {DOWNLOAD_CLIENT_OPTIONS.map((option) => (
                            <FormControlLabel
                                key={option.id}
                                value={option.id}
                                control={
                                    <Radio
                                        sx={{
                                            color: 'white',
                                            '&.Mui-checked': {
                                                color: 'primary.main'
                                            }
                                        }}
                                    />
                                }
                                label={option.label}
                            />
                        ))}
                    </RadioGroup>
                </Box>
            </Grid>
            <Grid>
                <TextFieldElement
                    name='tcHost'
                    label='Host'
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required
                    sx={{
                        width: '100%',
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: 'primary.main' },
                            '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                        },
                    }}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>
            <Grid>
                <TextFieldElement
                    name='tcPort'
                    label='Port'
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required
                    sx={{
                        width: '100%',
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: 'primary.main' },
                            '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                        },
                    }}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>
            {/* Show username field for qBittorrent, Transmission, and NZBGet (not SABnzbd - it uses API key) */}
            {(torrentClientType === DOWNLOAD_CLIENT_TYPE.QBITTORRENT ||
              torrentClientType === DOWNLOAD_CLIENT_TYPE.TRANSMISSION ||
              torrentClientType === DOWNLOAD_CLIENT_TYPE.NZBGET) && (
                <Grid>
                    <TextFieldElement
                        name='tcUsername'
                        label='Username'
                        variant='outlined'
                        fullWidth
                        autoComplete='off'
                        required={watchedTorrentClientType !== DOWNLOAD_CLIENT_TYPE.TRANSMISSION}
                        rules={{
                            required: watchedTorrentClientType !== DOWNLOAD_CLIENT_TYPE.TRANSMISSION ? 'Username is required' : false
                        }}
                        sx={{
                            width: '100%',
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: 'text.primary',
                                },
                                '&:hover fieldset': { borderColor: 'primary.main' },
                                '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                            },
                        }}
                        slotProps={{
                            inputLabel: { style: { color: theme.palette.text.primary } }
                        }}
                    />
                </Grid>
            )}
            <Grid>
                <TextFieldElement
                    name='tcPassword'
                    label={torrentClientType === DOWNLOAD_CLIENT_TYPE.SABNZBD ? 'API Key' : 'Password'}
                    type='password'
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required={watchedTorrentClientType !== DOWNLOAD_CLIENT_TYPE.TRANSMISSION && !hasExistingPassword && !userClearedPassword}
                    rules={{
                        required: (watchedTorrentClientType !== DOWNLOAD_CLIENT_TYPE.TRANSMISSION && !hasExistingPassword && !userClearedPassword) ? (torrentClientType === DOWNLOAD_CLIENT_TYPE.SABNZBD ? 'API Key is required' : 'Password is required') : false
                    }}
                    sx={{
                        width: '100%',
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: 'primary.main' },
                            '&.Mui-focused fieldset': { borderColor: 'primary.main', },
                        },
                    }}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>
            <Grid>
                <CheckboxElement
                    label='Use SSL'
                    name='tcSsl'
                    checked={formContext.watch('tcSsl')}
                    sx={{
                        ml: 1,
                        color: 'white',
                        '& .MuiSvgIcon-root': { fontSize: 30 }
                    }}
                />
            </Grid>
            <Grid>
                <CheckboxElement
                    label='Show Name'
                    name='showLabel'
                    checked={formContext.watch('showLabel')}
                    sx={{ ml: 1, color: 'white', '& .MuiSvgIcon-root': { fontSize: 30 } }}
                />
            </Grid>
        </>
    );
};
