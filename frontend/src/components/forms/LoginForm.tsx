import { Box, Button, InputAdornment, Typography } from '@mui/material';
import { FormContainer, TextFieldElement, useForm } from 'react-hook-form-mui';
import { FaLock, FaUser } from 'react-icons/fa6';
import { useLocation, useNavigate } from 'react-router-dom';

import { DashApi } from '../../api/dash-api';
import { ToastManager } from '../../components/toast/ToastManager';
import { useAppContext } from '../../context/useAppContext';
import { styles } from '../../theme/styles';
import { theme } from '../../theme/theme';

type FormValues = {
    username: string,
    password: string;
}

export const LoginForm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { setIsLoggedIn, setUsername, setIsAdmin, refreshDashboard } = useAppContext();

    const formContext = useForm<FormValues>({
        defaultValues: {
            username: '',
            password: ''
        }
    });

    const handleSubmit = async (data: FormValues) => {
        try {
            const response = await DashApi.login(data.username, data.password);

            // Update auth state in context - do this in sequence to avoid race conditions
            setUsername(data.username);

            // Get admin status directly from the response
            if (response.isAdmin !== undefined) {
                setIsAdmin(response.isAdmin);
            }

            // Set logged in status last to trigger any dependent effects
            setIsLoggedIn(true);

            // Refresh dashboard to load admin-only items if user is admin
            await refreshDashboard();

            // Show success toast and navigate back to previous page or home
            ToastManager.success('Login successful!');

            // Get the previous location from navigation state, default to home
            const from = (location.state as any)?.from || '/';
            navigate(from, { replace: true });
        } catch (error: any) {
            // Show error message
            ToastManager.error(error.message || 'Login failed');
        }
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
                                    ),
                                    autoComplete: 'username'
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
