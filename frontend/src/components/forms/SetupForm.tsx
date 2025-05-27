import { Box, Button, InputAdornment, Paper, Typography } from '@mui/material';
import { useState } from 'react';
import { FormContainer, TextFieldElement, useForm } from 'react-hook-form-mui';
import { FaLock, FaUser } from 'react-icons/fa6';

import { DashApi } from '../../api/dash-api';
import { PopupManager } from '../../components/modals/PopupManager';
import { initialItems } from '../../constants/constants';
import { useAppContext } from '../../context/useAppContext';
import { styles } from '../../theme/styles';
import { theme } from '../../theme/theme';
import { SetupModal } from '../modals/SetupModal';

type FormValues = {
    username: string;
    password: string;
    confirmPassword: string;
};

type SetupFormProps = {
    onSuccess: () => void;
};

export const SetupForm: React.FC<SetupFormProps> = ({ onSuccess }) => {
    const [showSetupModal, setShowSetupModal] = useState(true);
    const { updateConfig } = useAppContext();

    const handleSetupComplete = async () => {
        // Mark setup as complete and save initial items to the layout
        await updateConfig({
            isSetupComplete: true,
            search: true,
            searchProvider: {
                name: 'Google',
                url: 'https://www.google.com/search?q={query}'
            },
            layout: {
                desktop: initialItems,
                mobile: initialItems
            }
        });
        onSuccess();
    };

    return (
        <SetupModal open={showSetupModal} onComplete={handleSetupComplete} />
    );
};
