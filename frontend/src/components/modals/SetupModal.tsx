import { ArrowBack, ArrowForward } from '@mui/icons-material';
import { Box, Button, Modal, Paper, Step, StepLabel, Stepper, Typography } from '@mui/material';
import { InputAdornment } from '@mui/material';
import React, { useState } from 'react';
import { FormContainer, TextFieldElement, useForm } from 'react-hook-form-mui';
import { FaLock, FaUser } from 'react-icons/fa6';

import { DashApi } from '../../api/dash-api';
import { useAppContext } from '../../context/useAppContext';
import { styles } from '../../theme/styles';
import { theme } from '../../theme/theme';
import { PopupManager } from '../modals/PopupManager';

type FormValues = {
    username: string;
    password: string;
    confirmPassword: string;
};

type SetupSlide = {
    title: string;
    content: React.ReactNode;
};

type SetupModalProps = {
    open: boolean;
    onComplete: () => void;
};

export const SetupModal: React.FC<SetupModalProps> = ({ open, onComplete }) => {
    const [activeStep, setActiveStep] = useState(0);
    const { setIsLoggedIn, setUsername, setIsAdmin } = useAppContext();

    const formContext = useForm<FormValues>({
        defaultValues: {
            username: '',
            password: '',
            confirmPassword: ''
        }
    });

    // Get error object for validation
    const { formState } = formContext;
    const { errors } = formState;

    const handleSubmit = async (data: FormValues) => {
        try {
            if (data.password !== data.confirmPassword) {
                formContext.setError('confirmPassword', {
                    type: 'manual',
                    message: 'Passwords do not match'
                });
                return;
            }

            // Create the first user account
            await DashApi.signup(data.username, data.password);

            // Log in the user automatically
            const loginResponse = await DashApi.login(data.username, data.password);

            // Update auth state in context - first user is always admin
            setIsLoggedIn(true);
            setUsername(data.username);
            setIsAdmin(loginResponse.isAdmin);

            // Don't refresh dashboard here - it will be refreshed after setup is complete
            // The SetupForm's handleSetupComplete will update the config, which will trigger a refresh

            PopupManager.success('Account created successfully!');
            onComplete();
        } catch (error: any) {
            PopupManager.failure(error.message || 'Failed to create account');
        }
    };

    const AdminAccountForm = (
        <FormContainer onSuccess={handleSubmit} formContext={formContext}>
            <Box sx={styles.vcenter} gap={3}>
                <Box textAlign={'center'}>
                    <Typography variant='h6' gutterBottom align='center'>
                        Create Administrator Account
                    </Typography>
                    <Typography variant='body2' sx={{ mt: 1 }}>
                        This will be the first user account for your dashboard
                    </Typography>
                </Box>
                <Box sx={styles.vcenter} mb={1} mt={1}>
                    <Box width={'100%'} sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TextFieldElement
                            name='username'
                            label='Username'
                            variant='outlined'
                            sx={{ width: { xs: '100%', md: '80%' } }}
                            required
                            placeholder='Username'
                            rules={{
                                minLength: {
                                    value: 3,
                                    message: 'Username must be at least 3 characters'
                                }
                            }}
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
                        sx={{ width: { xs: '100%', md: '80%' } }}
                        type='password'
                        placeholder='Password'
                        required
                        rules={{
                            minLength: {
                                value: 6,
                                message: 'Password must be at least 6 characters'
                            }
                        }}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position='start'>
                                        <FaLock style={{ color: theme.palette.text.primary, fontSize: 22 }}/>
                                    </InputAdornment>
                                ),
                                autoComplete: 'new-password'
                            }
                        }}
                    />
                </Box>
                <Box width={'100%'} sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TextFieldElement
                        name='confirmPassword'
                        label='Confirm Password'
                        variant='outlined'
                        sx={{ width: { xs: '100%', md: '80%' } }}
                        type='password'
                        placeholder='Confirm Password'
                        required
                        error={!!errors.confirmPassword}
                        helperText={errors.confirmPassword?.message}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position='start'>
                                        <FaLock style={{ color: theme.palette.text.primary, fontSize: 22 }}/>
                                    </InputAdornment>
                                ),
                                autoComplete: 'new-password'
                            }
                        }}
                    />
                </Box>
            </Box>
            <Box sx={styles.center} mt={4}>
                <Button
                    variant='contained'
                    color='primary'
                    type={'submit'}
                >
                    {'Create Account & Continue'}
                </Button>
            </Box>
        </FormContainer>
    );

    const setupSlides: SetupSlide[] = [
        {
            title: 'Welcome to Lab Dash',
            content: (
                <Box sx={styles.vcenter} p={2}>
                    <Typography variant='h6' gutterBottom align='center'>
                        Your Personal Dashboard
                    </Typography>
                    <Typography paragraph align='center'>
                        Welcome to Lab Dash, a customizable dashboard for your lab environment.
                        This wizard will help you set up your system and get started.
                    </Typography>
                    <Typography align='center'>
                        Let's take a moment to set up your first administrator account and configure some basic settings.
                    </Typography>
                </Box>
            ),
        },
        {
            title: 'Dashboard Features',
            content: (
                <Box sx={styles.vcenter} p={2}>
                    <Typography variant='h6' gutterBottom align='center'>
                        Powerful Dashboard Tools
                    </Typography>
                    <Typography paragraph align='center'>
                        Lab Dash features a customizable grid layout where you can add various widgets:
                    </Typography>
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start', pl: 4 }}>
                        <Typography>• Links to your tools/services</Typography>
                        <Typography>• System information</Typography>
                        <Typography>• Service health checks</Typography>
                        <Typography>• Custom widgets and more</Typography>
                    </Box>
                </Box>
            ),
        },
        {
            title: 'Customization',
            content: (
                <Box sx={styles.vcenter} p={2}>
                    <Typography variant='h6' gutterBottom align='center'>
                        Make It Your Own
                    </Typography>
                    <Typography paragraph align='center'>
                        You can easily customize your dashboard by:
                    </Typography>
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start', pl: 4 }}>
                        <Typography>• Dragging and reordering widgets</Typography>
                        <Typography>• Changing the background image</Typography>
                        <Typography>• Adding custom search providers</Typography>
                        <Typography>• Importing/exporting configurations</Typography>
                    </Box>
                </Box>
            ),
        },
        {
            title: 'Privacy & Data Control',
            content: (
                <Box sx={styles.vcenter} p={2}>
                    <Typography variant='h6' gutterBottom align='center'>
                        Your Data Stays Private
                    </Typography>
                    <Typography paragraph align='center' sx={{ mt: 2 }}>
                        You have complete control over your data and dashboard configuration.
                    </Typography>
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start', pl: 4 }}>
                        <Typography>• All data is stored locally on your own server</Typography>
                        <Typography>• Only administrator accounts can make changes</Typography>
                        <Typography>• Configurations can be easily backed up and restored</Typography>
                    </Box>

                </Box>
            ),
        },
        {
            title: 'Create Administrator Account',
            content: AdminAccountForm
        },
    ];

    const handleNext = () => {
        if (activeStep === setupSlides.length - 1) {
            // If we're on the last step with the form, submit the form
            formContext.handleSubmit(handleSubmit)();
        } else {
            setActiveStep((prevStep) => prevStep + 1);
        }
    };

    const handleBack = () => {
        setActiveStep((prevStep) => prevStep - 1);
    };

    const isLastStep = activeStep === setupSlides.length - 1;

    return (
        <Modal
            open={open}
            aria-labelledby='setup-modal-title'
            aria-describedby='setup-modal-description'
            disableEnforceFocus
            disableAutoFocus
            sx={{ userSelect: 'none' }}
        >
            <Paper
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: { xs: '90%', sm: '70%', md: '50%' },
                    maxWidth: '600px',
                    p: 4,
                    boxShadow: 24,
                    borderRadius: 2,
                }}
            >
                <Typography variant='h5' component='h2' gutterBottom align='center'>
                    {setupSlides[activeStep].title}
                </Typography>

                <Stepper activeStep={activeStep} sx={{ mt: 2, mb: 4 }}>
                    {setupSlides.map((slide, index) => (
                        <Step key={index}>
                            <StepLabel></StepLabel>
                        </Step>
                    ))}
                </Stepper>

                <Box sx={{ minHeight: '280px' }}>
                    {setupSlides[activeStep].content}
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                    <Button
                        startIcon={<ArrowBack />}
                        onClick={handleBack}
                        disabled={activeStep === 0}
                    >
                        Back
                    </Button>
                    {!isLastStep && <Button
                        endIcon={isLastStep ? undefined : <ArrowForward />}
                        variant='contained'
                        color='primary'
                        onClick={handleNext}
                        type={'button'}
                    >
                        {'Next'}
                    </Button>}
                </Box>
            </Paper>
        </Modal>
    );
};
