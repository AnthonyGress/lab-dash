import { Alert, Box, Button, Grid2 as Grid, Typography } from '@mui/material';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CheckboxButtonGroup, CheckboxElement, FormContainer, SelectElement, TextFieldElement } from 'react-hook-form-mui';

import { BACKEND_URL } from '../../constants/constants';
import { useIsMobile } from '../../hooks/useIsMobile';
import { COLORS, styles } from '../../theme/styles';
import { theme } from '../../theme/theme';
import { IconSearch } from '../IconSearch';

type Props = {
    handleClose: () => void
}

const ITEM_TYPE_OPTIONS = [{ id: 'widget', label: 'Widget' }, { id: 'app', label: 'App' }];
const WIDGET_OPTIONS = [{ id: 'date_time', label: 'Date & Time' }, { id: 'weather', label: 'Weather' }, { id: 'system_monitor', label: 'System Monitor' }];

export const AddForm = ({ handleClose }: Props) => {
    const [iconList, setIconList] = useState([]);
    const { formState: { errors } } = useForm();
    const formContext = useForm({
        defaultValues: {
            shortcutName: '',
            itemType: '',
            url: '',
            showName: true,
            icon: ''
        }
    });
    const isMobile = useIsMobile();
    const selectedItemType = formContext.watch('itemType');

    const handleSubmit = (data: any) => {
        console.log(data);
        formContext.reset();
        handleClose();
    };

    const fetchIconList = async () => {
        const list = await axios.get(`${BACKEND_URL}/icon-list`);
        console.log(list.data.icons);
        setIconList(list.data.icons);
    };

    useEffect(() => {
        fetchIconList();
    }, []);

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
                        // border: '1px solid #ccc',
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
                                        }
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

                            {selectedItemType === 'app' &&
                            <>
                                <Grid>
                                    <TextFieldElement name='shortcutName' label='Shortcut Name' required variant='outlined' sx={{
                                        width: '100%',
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: 'text.primary',
                                            }
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
                                            }
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
                                    <IconSearch control={formContext.control} errors={errors}/>
                                    <CheckboxElement label='Show Name' name='showName' sx={{ ml: 1, color: 'white' }}/>
                                </Grid>
                            </>
                            }
                            {
                                selectedItemType === 'widget' &&
                                <Grid>
                                    <SelectElement label='Widget' name='widget' options={WIDGET_OPTIONS} required fullWidth sx={{
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: 'text.primary',
                                            },
                                            '.MuiSvgIcon-root ': {
                                                fill: theme.palette.text.primary,
                                            }
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
                            <Button variant='contained' type='submit'>Add</Button>
                        </Grid>
                    </FormContainer>
                </Box>
            </Grid>
        </Grid>
    );
};
