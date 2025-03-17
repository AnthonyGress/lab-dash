import { Box, Button, InputAdornment, Paper, Tooltip, Typography } from '@mui/material';
import { FormContainer, TextFieldElement, useForm } from 'react-hook-form-mui';
import { FaLock, FaUser } from 'react-icons/fa6';

import { styles } from '../../theme/styles';
import { theme } from '../../theme/theme';

type FormValues = {
    username: string,
    password: string;
}

export const LoginForm = () => {
    const formContext = useForm<FormValues>({
        defaultValues: {
            username: '',
            password: ''
        }
    });

    const handleSubmit = async (data: FormValues) => {
        console.log(data);
    };

    return (
        <FormContainer onSuccess={handleSubmit} formContext={formContext}>
            <Box sx={styles.vcenter} gap={3}>
                <Box pt={2} textAlign={'center'}>
                    <Typography variant='h4'>Login</Typography>
                </Box>
                <Box sx={styles.vcenter} mb={2} mt={2}>
                    <Box width={'100%'} sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TextFieldElement
                            name='username'
                            label='Username'
                            variant='outlined'
                            sx={{ width: { xs: '80%', md: '40%' } }}
                            required
                            placeholder='Username'
                            slotProps={{
                                input: {
                                    startAdornment: (
                                        <InputAdornment position='start'>
                                            <FaUser style={{ color: theme.palette.text.primary, fontSize: 22 }}/>
                                        </InputAdornment>
                                    )
                                }
                            }}
                        />
                    </Box>
                </Box>
                <Box width={'100%'} sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TextFieldElement
                        name='password'
                        label='Password'
                        variant='outlined'
                        sx={{ width: { xs: '80%', md: '40%' } }}
                        type='password'
                        placeholder='Password'
                        required
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position='start'>
                                        <FaLock style={{ color: theme.palette.text.primary, fontSize: 22 }}/>
                                    </InputAdornment>
                                )
                            }
                        }}
                    />
                </Box>
                <Box mt={4} sx={styles.center} mb={2}>
                    <Button variant='contained' type='submit'>Login</Button>
                </Box>
            </Box>
        </FormContainer>
    );
};
