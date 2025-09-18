import { UseFormReturn } from 'react-hook-form';

import { QueueManagementWidgetConfig } from './QueueManagementWidgetConfig';
import { FormValues } from '../AddEditForm/types';

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
