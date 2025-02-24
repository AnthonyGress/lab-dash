import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, Paper, Tooltip, Typography } from '@mui/material';
import axios from 'axios';
import { FormContainer, TextFieldElement, useForm } from 'react-hook-form-mui';

import { FileInput } from './FileInput';
import { DashApi } from '../../api/dash-api';
import { BACKEND_URL } from '../../constants/constants';
import { styles } from '../../theme/styles';

export const SettingsForm = () => {
    const formContext = useForm({
        defaultValues: {
            selectedFile: null as File | null,
            title: ''
        }
    });

    const selectedFile = formContext.watch('selectedFile', null);

    const handleSubmit = async (data: any) => {
        console.log(data);

        if (data.selectedFile instanceof File) { // ✅ Ensure it's a File object
            const res = await DashApi.uploadBackgroundImage(data.selectedFile);
            console.log(res);

            // TODO: set in config
        }

        // TODO: set title in config/app context
    };

    return (
        <FormContainer onSuccess={handleSubmit} formContext={formContext}>
            <Box sx={styles.vcenter} gap={2}>
                <Box pt={2}>
                    <Typography variant='h4'>Settings</Typography>
                </Box>
                <Box sx={styles.vcenter} mb={2} mt={2}>
                    <Box width={'100%'}>
                        <TextFieldElement name='title' label='Custom Title' variant='outlined' sx={{ width: '40%' }}/>
                    </Box>
                </Box>
                <Box width={'100%'} sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileInput name='selectedFile' label='Background Image' width='40%' />

                    {/* Close Icon (✖) to clear the file */}
                    {selectedFile && (
                        <Tooltip title='Clear'>
                            <CloseIcon
                                onClick={() => formContext.resetField('selectedFile')}
                                sx={{
                                    position: 'absolute',
                                    right: 'calc(30% - 30px)', // ✅ Adjust position to stay inside the input field
                                    top: '50% - 20px',
                                    transform: 'translateY(-50%)', // ✅ Ensures vertical centering
                                    cursor: 'pointer',
                                    fontSize: 26,
                                    color: 'rgba(255, 255, 255, 0.7)', // ✅ Adjust color for visibility
                                }}
                            />
                        </Tooltip>
                    )}
                </Box>
                <Box mt={4} sx={styles.center} mb={2}>
                    <Button variant='contained' type='submit'>Save</Button>
                </Box>
            </Box>
        </FormContainer>
    );
};
