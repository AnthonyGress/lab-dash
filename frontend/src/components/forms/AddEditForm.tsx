import { Box, Button, Grid2 as Grid, useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {  CheckboxElement, FormContainer, SelectElement, TextFieldElement } from 'react-hook-form-mui';


import { IconSearch } from './IconSearch';
import { DashApi } from '../../api/dash-api';
import { useAppContext } from '../../context/useAppContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { COLORS, styles } from '../../theme/styles';
import { theme } from '../../theme/theme';
import { DashboardItem, Icon, ITEM_TYPE, NewItem } from '../../types';

type Props = {
    handleClose: () => void
    existingItem?: DashboardItem | null;

}

const ITEM_TYPE_OPTIONS = [
    { id: 'widget', label: 'Widget' },
    { id: ITEM_TYPE.APP_SHORTCUT, label: 'App' },
    { id: ITEM_TYPE.BLANK_APP, label: 'Blank App' },
    { id: ITEM_TYPE.BLANK_WIDGET, label: 'Blank Widget' },
    { id: ITEM_TYPE.BLANK_ROW, label: 'Blank Row' },
];

const WIDGET_OPTIONS = [{ id: ITEM_TYPE.DATE_TIME_WIDGET, label: 'Date & Time' }, { id: ITEM_TYPE.WEATHER_WIDGET, label: 'Weather' }, { id: ITEM_TYPE.SYSTEM_MONITOR_WIDGET, label: 'System Monitor' }];

type FormValues = {
    shortcutName?: string;
    itemType: string;
    url?: string;
    icon?: { path: string; name: string; source?: string } | null;
    showLabel?: boolean;
    widgetType?: string;
};

export const AddEditForm = ({ handleClose, existingItem }: Props) => {
    const { formState: { errors } } = useForm();
    const { dashboardLayout, addItem, updateItem } = useAppContext();
    const  isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const formContext = useForm({
        defaultValues: {
            shortcutName: existingItem?.label || '',
            itemType: existingItem?.type || '',
            url: existingItem?.url || '',
            showLabel: existingItem?.showLabel,
            icon: existingItem?.icon
                ? { path: existingItem.icon.path, name: existingItem.icon.name, source: existingItem.icon.source || '' }
                : null // Ensure correct structure
        }
    });

    const selectedItemType = formContext.watch('itemType');

    const handleSubmit = (data: FormValues) => {
        console.log(data);

        const updatedItem: NewItem = {
            label: data.shortcutName || '',
            icon: data.icon ? { path: data.icon.path, name: data.icon.name } : undefined,
            url: data.url,
            type: data.itemType === 'widget' && data.widgetType ? data.widgetType : data.itemType,
            showLabel: data.showLabel
        };

        if (existingItem) {
            updateItem(existingItem.id, updatedItem);
        } else {
            addItem(updatedItem);
        }

        formContext.reset();
        handleClose();
    };

    return (
        <Grid
            container
            justifyContent='center'
            alignItems='center'
        >
            <Grid>
                <Box
                    sx={{
                        p: 3,
                        borderRadius: '8px',
                        boxShadow: 3,
                        backgroundColor: COLORS.GRAY,
                    }}
                >
                    <FormContainer onSuccess={handleSubmit} formContext={formContext}>
                        <Grid container spacing={2} sx={styles.vcenter}>
                            <Grid>
                                <SelectElement label='Item Type' name='itemType' options={ITEM_TYPE_OPTIONS} required fullWidth sx={{
                                    '& .MuiOutlinedInput-root': {
                                        '& fieldset': {
                                            borderColor: 'text.primary',
                                        },
                                        '.MuiSvgIcon-root ': {
                                            fill: theme.palette.text.primary,
                                        },
                                        '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                        '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                    },
                                    width: '100%',
                                    minWidth: isMobile ? '65vw' :'20vw'
                                }}
                                slotProps={{
                                    inputLabel:
                                        { style: { color: theme.palette.text.primary } }
                                }}
                                />
                            </Grid>

                            {selectedItemType === ITEM_TYPE.APP_SHORTCUT &&
                            <>
                                <Grid>
                                    <TextFieldElement name='shortcutName' label='Shortcut Name' required variant='outlined' sx={{
                                        width: '100%',
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: 'text.primary',
                                            },
                                            '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                        },
                                    }}
                                    autoComplete='off'
                                    slotProps={{
                                        inputLabel:
                            { style: { color: theme.palette.text.primary } }
                                    }}
                                    />
                                </Grid>
                                <Grid>
                                    <TextFieldElement name='url' label='URL' required variant='outlined' sx={{
                                        width: '100%',
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: 'text.primary',
                                            },
                                            '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                        },
                                    }}
                                    rules={{
                                        validate: (value) =>
                                            value.includes('://') || 'Invalid url. Ex "http://192.168.x.x" or "unifi-network://"',
                                    }}
                                    autoComplete='off'
                                    slotProps={{
                                        inputLabel:
                            { style: { color: theme.palette.text.primary } },
                                        formHelperText: { sx: {
                                            whiteSpace: 'normal',
                                            maxWidth: '16vw',
                                        }, }
                                    }}
                                    />
                                </Grid>
                                <Grid>
                                    <IconSearch control={formContext.control} errors={errors}/>
                                </Grid>
                                <Grid>
                                    <CheckboxElement label='Show Name' name='showLabel' sx={{ ml: 1, color: 'white', '& .MuiSvgIcon-root': { fontSize: 30 },  }}/>
                                </Grid>
                            </>
                            }
                            {
                                selectedItemType === 'widget' &&
                                <Grid>
                                    <SelectElement label='Widget' name='widgetType' options={WIDGET_OPTIONS} required fullWidth sx={{
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: 'text.primary',
                                            },
                                            '.MuiSvgIcon-root ': {
                                                fill: theme.palette.text.primary,
                                            },
                                            '&:hover fieldset': { borderColor: theme.palette.primary.main },
                                            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
                                        },
                                        width: '100%',
                                        minWidth: isMobile ? '50vw' :'20vw'
                                    }}
                                    slotProps={{
                                        inputLabel:
                                        { style: { color: theme.palette.text.primary } }
                                    }}
                                    />
                                </Grid>
                            }
                            <Button variant='contained' type='submit' sx={{ minHeight: '3rem' }}>{existingItem ? 'Update' : 'Add'}</Button>
                        </Grid>
                    </FormContainer>
                </Box>
            </Grid>
        </Grid>
    );
};
