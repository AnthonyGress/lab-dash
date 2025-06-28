import { UseFormReturn } from 'react-hook-form';

import { FormValues } from '../AddEditForm';
import { QueueManagementWidgetConfig } from './QueueManagementWidgetConfig';

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
