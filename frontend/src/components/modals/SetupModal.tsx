import { ArrowBack, ArrowForward } from '@mui/icons-material';
import { Box, Button, Modal, Paper, Step, StepLabel, Stepper, Typography, FormControl, InputLabel, Select, MenuItem, SelectChangeEvent, InputAdornment } from '@mui/material';
import React, { useState } from 'react';
import { FormContainer, TextFieldElement, useForm } from 'react-hook-form-mui';
import { useTranslation } from 'react-i18next';
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
    const { t, i18n } = useTranslation();
    const [activeStep, setActiveStep] = useState(0);
    
    // State variable to hold the currently selected language
    const [selectedLang, setSelectedLang] = useState<string>(i18n.language || 'en');

    const { setIsLoggedIn, setUsername, setIsAdmin, refreshDashboard } = useAppContext();

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

    // Event handler for language selection (Select component)
    const handleLanguageChange = (event: SelectChangeEvent) => {
        const newLang = event.target.value;
        setSelectedLang(newLang);
        i18n.changeLanguage(newLang);
    };

    const handleSubmit = async (data: FormValues) => {
        try {
            if (data.password !== data.confirmPassword) {
                formContext.setError('confirmPassword', {
                    type: 'manual',
                    message: t('setup.createAccount.passwordMismatch')
                });
                return;
            }
            // Create the first user account
            await DashApi.signup(data.username, data.password, selectedLang);
            // Log in the user automatically
            const loginResponse = await DashApi.login(data.username, data.password);

            // Update auth state in context - first user is always admin
            setIsLoggedIn(true);
            setUsername(data.username);
            setIsAdmin(loginResponse.isAdmin);

            // Refresh dashboard to load admin-only items
            await refreshDashboard();

            PopupManager.success(t('setup.createAccount.success'));
            onComplete();
        } catch (error: any) {
            PopupManager.failure(error.message || t('setup.createAccount.error'));
        }
    };

    // STEP 1: Language Selection (Dropdown / Select)
    const LanguageSelectionStep = (
        <Box sx={styles.vcenter} p={2} gap={4}>
             <Box textAlign="center">
                <Typography variant="h6" gutterBottom>
                    {t('setup.languageSelect.subtitle')}
                </Typography>
                <Typography variant="body2" color="text.primary">
                    {t('setup.languageSelect.description')}
                </Typography>
             </Box>

            <Box width="100%" display="flex" justifyContent="center">
                <FormControl sx={{ minWidth: 200, width: { xs: '100%', sm: '60%' } }}>
                    <InputLabel id="language-select-label" sx={{ color: 'text.primary' }}>
                        {t('setup.languageSelect.label')}
                    </InputLabel>
                    <Select
                        labelId="language-select-label"
                        id="language-select"
                        value={selectedLang}
                        label={t('setup.languageSelect.label')}
                        onChange={handleLanguageChange}
                        sx={{
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255, 255, 255, 0.23)',
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255, 255, 255, 0.5)',
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                borderColor: theme.palette.primary.main,
                            },
                            color: 'white',
                            '.MuiSvgIcon-root ': {
                                fill: "white"
                            }
                        }}
                        MenuProps={{
                            PaperProps: {
                                sx: {
                                    bgcolor: '#2A2A2A', // Tło menu
                                    color: 'white',
                                }
                            }
                        }}
                    >
                        <MenuItem value="en">English</MenuItem>
                        <MenuItem value="pl">Polski</MenuItem>
                    </Select>
                </FormControl>
            </Box>
        </Box>
    );
    
    const AdminAccountForm = (
        <FormContainer onSuccess={handleSubmit} formContext={formContext}>
            <Box sx={styles.vcenter} gap={3}>
                <Box textAlign={'center'}>
                    <Typography variant='h6' gutterBottom align='center'>
                        {t('setup.createAccount.title')}
                    </Typography>
                    <Typography variant='body2' sx={{ mt: 1 }}>
                        {t('setup.createAccount.subtitle')}
                    </Typography>
                </Box>
                <Box sx={styles.vcenter} mb={1} mt={1}>
                    <Box width={'100%'} sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TextFieldElement
                            name='username'
                            label={t('setup.createAccount.username')}
                            variant='outlined'
                            sx={{ width: { xs: '100%', md: '80%' } }}
                            required
                            placeholder={t('setup.createAccount.username')}
                            rules={{
                                minLength: {
                                    value: 3,
                                    message: t('setup.createAccount.usernameLength')
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
                        label={t('setup.createAccount.password')}
                        variant='outlined'
                        sx={{ width: { xs: '100%', md: '80%' } }}
                        type='password'
                        placeholder={t('setup.createAccount.password')}
                        required
                        rules={{
                            minLength: {
                                value: 6,
                                message: t('setup.createAccount.passwordLength')
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
                        label={t('setup.createAccount.confirmPassword')}
                        variant='outlined'
                        sx={{ width: { xs: '100%', md: '80%' } }}
                        type='password'
                        placeholder={t('setup.createAccount.confirmPassword')}
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
                    {t('setup.createAccount.submit')}
                </Button>
            </Box>
        </FormContainer>
    );

    const setupSlides: SetupSlide[] = [
        {
            title: t('setup.languageSelect.title'),
            content: LanguageSelectionStep
        },
        {
            title: t('setup.welcome.title'),
            content: (
                <Box sx={styles.vcenter} p={2}>
                    <Typography variant='h6' gutterBottom align='center'>
                        {t('setup.welcome.title')}
                    </Typography>
                    <Typography paragraph align='center'>
                        {t('setup.welcome.text1')}
                    </Typography>
                    <Typography align='center'>
                        {t('setup.welcome.text2')}
                    </Typography>
                </Box>
            ),
        },
        {
            title: t('setup.features.title'),
            content: (
                <Box sx={styles.vcenter} p={2}>
                    <Typography variant='h6' gutterBottom align='center'>
                        {t('setup.features.title')}
                    </Typography>
                    <Typography paragraph align='center'>
                        {t('setup.features.text')}
                    </Typography>
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start', pl: 4 }}>
                        <Typography>• {t('setup.features.bullets.links')}</Typography>
                        <Typography>• {t('setup.features.bullets.system')}</Typography>
                        <Typography>• {t('setup.features.bullets.health')}</Typography>
                        <Typography>• {t('setup.features.bullets.widgets')}</Typography>
                    </Box>
                </Box>
            ),
        },
        {
            title: t('setup.customization.title'),
            content: (
                <Box sx={styles.vcenter} p={2}>
                    <Typography variant='h6' gutterBottom align='center'>
                        {t('setup.customization.title')}
                    </Typography>
                    <Typography paragraph align='center'>
                        {t('setup.customization.text')}
                    </Typography>
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start', pl: 4 }}>
                        <Typography>• {t('setup.customization.bullets.drag')}</Typography>
                        <Typography>• {t('setup.customization.bullets.background')}</Typography>
                        <Typography>• {t('setup.customization.bullets.search')}</Typography>
                        <Typography>• {t('setup.customization.bullets.config')}</Typography>
                    </Box>
                </Box>
            ),
        },
        {
            title: t('setup.privacy.title'),
            content: (
                <Box sx={styles.vcenter} p={2}>
                    <Typography variant='h6' gutterBottom align='center'>
                        {t('setup.privacy.title')}
                    </Typography>
                    <Typography paragraph align='center' sx={{ mt: 2 }}>
                        {t('setup.privacy.text')}
                    </Typography>
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start', pl: 4 }}>
                        <Typography>• {t('setup.privacy.bullets.local')}</Typography>
                        <Typography>• {t('setup.privacy.bullets.admin')}</Typography>
                        <Typography>• {t('setup.privacy.bullets.backup')}</Typography>
                    </Box>
                </Box>
            ),
        },
        {
            title: t('setup.createAccount.title'),
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
                        {t('common.back')}
                    </Button>
                    {!isLastStep && <Button
                        endIcon={isLastStep ? undefined : <ArrowForward />}
                        variant='contained'
                        color='primary'
                        onClick={handleNext}
                        type={'button'}
                    >
                        {t('common.next')}
                    </Button>}
                </Box>
            </Paper>
        </Modal>
    );
};