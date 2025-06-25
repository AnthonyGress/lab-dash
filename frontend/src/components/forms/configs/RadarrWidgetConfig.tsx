import { UseFormReturn } from 'react-hook-form';

import { FormValues } from '../AddEditForm';
import { QueueManagementWidgetConfig } from './QueueManagementWidgetConfig';

interface RadarrWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
}

export const RadarrWidgetConfig: React.FC<RadarrWidgetConfigProps> = ({ formContext }) => {
    return (
        <QueueManagementWidgetConfig
            formContext={formContext}
            serviceName='Radarr'
            defaultPort='7878'
        />
    );
};
