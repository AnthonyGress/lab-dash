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
    { id: TORRENT_CLIENT_TYPE.DELUGE, label: 'Deluge' }
];

interface TorrentClientWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
}

export const TorrentClientWidgetConfig = ({ formContext }: TorrentClientWidgetConfigProps) => {
    const isMobile = useIsMobile();
    const [torrentClientType, setTorrentClientType] = useState<string>(
        formContext.getValues('torrentClientType') || TORRENT_CLIENT_TYPE.QBITTORRENT
    );

    useEffect(() => {
        const watchedTorrentClientType = formContext.watch('torrentClientType');
        if (watchedTorrentClientType) {
            setTorrentClientType(watchedTorrentClientType);

            // Update the port based on torrent client type
            const defaultPort = watchedTorrentClientType === TORRENT_CLIENT_TYPE.DELUGE ? '8112' : '8080';
            formContext.setValue('tcPort', defaultPort);
        }
    }, [formContext.watch('torrentClientType'), formContext]);

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
            {/* Only show username field for qBittorrent */}
            {torrentClientType === TORRENT_CLIENT_TYPE.QBITTORRENT && (
                <Grid>
                    <TextFieldElement
                        name='tcUsername'
                        label='Username'
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
            )}
            <Grid>
                <TextFieldElement
                    name='tcPassword'
                    label='Password'
                    type='password'
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
