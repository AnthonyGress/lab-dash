import { UseFormReturn } from 'react-hook-form';

import { QueueManagementWidgetConfig } from './QueueManagementWidgetConfig';
import { FormValues } from '../AddEditForm/types';

interface SonarrWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
}

export const SonarrWidgetConfig: React.FC<SonarrWidgetConfigProps> = ({ formContext }) => {
    return (
        <QueueManagementWidgetConfig
            formContext={formContext}
            serviceName='Sonarr'
            defaultPort='8989'
        />
    );
};
