import { useState } from 'react';

import { DashApi } from '../../api/dash-api';
import { initialItems } from '../../constants/constants';
import { useAppContext } from '../../context/useAppContext';
import { SetupModal } from '../modals/SetupModal';

type SetupFormProps = {
    onSuccess: () => void;
};

export const SetupForm: React.FC<SetupFormProps> = ({ onSuccess }) => {
    const [showSetupModal, setShowSetupModal] = useState(true);
    const { updateConfig, refreshDashboard } = useAppContext();

    const handleSetupComplete = async () => {
        // Read as the new admin, so admin-only items count as existing content
        const existing = await DashApi.getConfig();
        const hasDashboard = Boolean(
            existing.isSetupComplete
            || existing.layout?.desktop?.length
            || existing.layout?.mobile?.length
            || existing.pages?.length
        );

        if (hasDashboard) {
            // Users file was removed to reset the account: keep the dashboard as it is
            await updateConfig({ isSetupComplete: true });
        } else {
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
        }

        // Refresh dashboard to load the initial items
        await refreshDashboard();

        onSuccess();
    };

    return (
        <SetupModal open={showSetupModal} onComplete={handleSetupComplete} />
    );
};
