import { Box, FormControlLabel, Grid2 as Grid, Radio, RadioGroup, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, TextFieldElement } from 'react-hook-form-mui';

import { useIsMobile } from '../../../hooks/useIsMobile';
import { COLORS } from '../../../theme/styles';
import { theme } from '../../../theme/theme';
import { TORRENT_CLIENT_TYPE } from '../../../types';
import { FormValues } from '../AddEditForm';

const TORRENT_CLIENT_OPTIONS = [
    { id: TORRENT_CLIENT_TYPE.QBITTORRENT, label: 'qBittorrent' },
    { id: TORRENT_CLIENT_TYPE.DELUGE, label: 'Deluge' },
    { id: TORRENT_CLIENT_TYPE.TRANSMISSION, label: 'Transmission' }
];

interface TorrentClientWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
    existingItem?: any; // Pass existing item to check for security flags
}

const MASKED_VALUE = '**********'; // 10 asterisks for masked values

export const TorrentClientWidgetConfig = ({ formContext, existingItem }: TorrentClientWidgetConfigProps) => {
    const isMobile = useIsMobile();
    const [torrentClientType, setTorrentClientType] = useState<string>(
        formContext.getValues('torrentClientType') || TORRENT_CLIENT_TYPE.QBITTORRENT
    );

    // Track if we're editing an existing item with sensitive data
    const [hasExistingPassword, setHasExistingPassword] = useState(false);

    // Track if user is intentionally clearing the password field
    const [userClearedPassword, setUserClearedPassword] = useState(false);

    // Initialize masked values for existing items
    useEffect(() => {
        console.log('TorrentClientWidgetConfig: Initializing with existingItem:', existingItem);

        // Reset state when existingItem changes
        setHasExistingPassword(false);
        setUserClearedPassword(false);

        // Check if the form already has a masked password value (set by AddEditForm)
        // This is more reliable than checking existingItem since existingItem is filtered
        const currentPassword = formContext.getValues('tcPassword');
        console.log('TorrentClientWidgetConfig: Current form password value:', currentPassword);

        if (currentPassword === MASKED_VALUE) {
            console.log('TorrentClientWidgetConfig: Found masked password in form, setting hasExistingPassword to true');
            setHasExistingPassword(true);
        } else if (existingItem?.config) {
            // Fallback: check existingItem config for security flag (though it may not be present in filtered data)
            const config = existingItem.config;
            console.log('TorrentClientWidgetConfig: Config has _hasPassword:', config._hasPassword);

            if (config._hasPassword) {
                console.log('TorrentClientWidgetConfig: Setting hasExistingPassword to true from config flag');
                setHasExistingPassword(true);

                // Ensure the masked value is set if not already present
                if (!currentPassword || currentPassword === '') {
                    console.log('TorrentClientWidgetConfig: Setting masked password');
                    formContext.setValue('tcPassword', MASKED_VALUE, { shouldValidate: false });
                }
            } else {
                console.log('TorrentClientWidgetConfig: No existing password found');
            }
        } else {
            console.log('TorrentClientWidgetConfig: No existing item config found');
        }
    }, [existingItem?.config?._hasPassword, existingItem?.id, formContext]);

    // Debug effect to track hasExistingPassword changes
    useEffect(() => {
        console.log('TorrentClientWidgetConfig: hasExistingPassword changed to:', hasExistingPassword);
    }, [hasExistingPassword]);

    useEffect(() => {
        const watchedTorrentClientType = formContext.watch('torrentClientType');
        if (watchedTorrentClientType) {
            setTorrentClientType(watchedTorrentClientType);

            // Update the port based on torrent client type
            const defaultPort = watchedTorrentClientType === TORRENT_CLIENT_TYPE.DELUGE ? '8112'
                : watchedTorrentClientType === TORRENT_CLIENT_TYPE.TRANSMISSION ? '9091'
                    : '8080';
            formContext.setValue('tcPort', defaultPort);
        }
    }, [formContext.watch('torrentClientType'), formContext]);

    // Watch for password field changes to track user intent
    useEffect(() => {
        if (hasExistingPassword) {
            const currentPassword = formContext.watch('tcPassword');

            // If user clears the masked value, mark it as intentionally cleared
            if (currentPassword === '' && !userClearedPassword) {
                console.log('TorrentClientWidgetConfig: User cleared password field');
                setUserClearedPassword(true);
            }
            // If user enters a new value after clearing, reset the flag
            else if (currentPassword && currentPassword !== MASKED_VALUE && userClearedPassword) {
                console.log('TorrentClientWidgetConfig: User entered new password');
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
                        Select Torrent Client:
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
                        {TORRENT_CLIENT_OPTIONS.map((option) => (
                            <FormControlLabel
                                key={option.id}
                                value={option.id}
                                control={
                                    <Radio
                                        sx={{
                                            color: 'white',
                                            '&.Mui-checked': {
                                                color: theme.palette.primary.main
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
                            '&:hover fieldset': { borderColor: theme.palette.primary.main },
                            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
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
                            '&:hover fieldset': { borderColor: theme.palette.primary.main },
                            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                        },
                    }}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>
            {/* Only show username field for qBittorrent and Transmission */}
            {(torrentClientType === TORRENT_CLIENT_TYPE.QBITTORRENT || torrentClientType === TORRENT_CLIENT_TYPE.TRANSMISSION) && (
                <Grid>
                    <TextFieldElement
                        name='tcUsername'
                        label='Username'
                        variant='outlined'
                        fullWidth
                        autoComplete='off'
                        required={torrentClientType !== TORRENT_CLIENT_TYPE.TRANSMISSION}
                        sx={{
                            width: '100%',
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: 'text.primary',
                                },
                                '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
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
                    label='Password'
                    type='password'
                    variant='outlined'
                    fullWidth
                    autoComplete='off'
                    required={torrentClientType !== TORRENT_CLIENT_TYPE.TRANSMISSION && !hasExistingPassword && !userClearedPassword}
                    sx={{
                        width: '100%',
                        '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                                borderColor: 'text.primary',
                            },
                            '&:hover fieldset': { borderColor: theme.palette.primary.main },
                            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
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
