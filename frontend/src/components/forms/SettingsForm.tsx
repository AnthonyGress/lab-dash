import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, Paper, Tooltip, Typography } from '@mui/material';
import axios from 'axios';
import { FormContainer, TextFieldElement, useForm } from 'react-hook-form-mui';

import { FileInput } from './FileInput';
import { DashApi } from '../../api/dash-api';
import { BACKEND_URL } from '../../constants/constants';
import { useAppContext } from '../../context/useAppContext';
import { styles } from '../../theme/styles';
import { Config } from '../../types';

type FormValues = {
    selectedFile: File | null,
    title: string;
}

export const SettingsForm = () => {
    const { config, updateConfig } = useAppContext();
    const formContext = useForm<FormValues>({
        defaultValues: {
            selectedFile: null as File | null,
            title: config?.title || ''
        }
    });

    const selectedFile = formContext.watch('selectedFile', null);

    const handleSubmit = async (data: any) => {
        console.log(data);

        const updatedConfig: Partial<Config> = {};

        if (data.selectedFile instanceof File) {
            updatedConfig.backgroundImage = data.selectedFile;
        }

        if (data.title.trim()) {
            updatedConfig.title = data.title;
        } else {
            updatedConfig.title = 'Lab Dash';
        }

        if (Object.keys(updatedConfig).length > 0) {
            await updateConfig(updatedConfig); // Update only the provided fields
        }
    };

    const resetBackground = async () => {
        await updateConfig({ backgroundImage: '' });
    };

    return (
        <FormContainer onSuccess={handleSubmit} formContext={formContext}>
            <Box sx={styles.vcenter} gap={2}>
                <Box pt={2}>
                    <Typography variant='h4'>Settings</Typography>
                </Box>
                <Box sx={styles.vcenter} mb={2} mt={2}>
                    <Box width={'100%'}>
                        <TextFieldElement name='title' label='Custom Title' variant='outlined' sx={{ width: { xs: '80%', md: '40%' } }}/>
                    </Box>
                </Box>
                <Box width={'100%'} sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileInput name='selectedFile' label='Background Image' sx={{ width: { xs: '80%' , md: '40%' } }}/>

                    {/* Close Icon (✖) to clear the file */}
                    {selectedFile && (
                        <Tooltip title='Clear'>
                            <CloseIcon
                                onClick={() => formContext.resetField('selectedFile')}
                                sx={{
                                    position: 'absolute',
                                    right: 'calc(30% - 30px)',
                                    top: '50% - 20px',
                                    transform: 'translateY(-50%)',
                                    cursor: 'pointer',
                                    fontSize: 26,
                                    color: 'rgba(255, 255, 255, 0.7)',
                                }}
                            />
                        </Tooltip>
                    )}
                </Box>
                <Box><Button variant='contained' onClick={resetBackground}>Reset Background</Button></Box>
                <Box mt={4} sx={styles.center} mb={2}>
                    <Button variant='contained' type='submit'>Save</Button>
                </Box>
            </Box>
        </FormContainer>
    );
};
