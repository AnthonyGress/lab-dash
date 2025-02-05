import { Box, Grid2 as Grid } from '@mui/material';
import { useEffect, useState } from 'react';

import { AppShortcut } from './AppShortcut';
import { IconSearch } from './IconSearch';
import { DateTimeWidget } from './widgets/DateTimeWidget';
import { styles } from '../theme/styles';
import { SystemMonitorWidget } from './widgets/SystemMonitorWidget/SystemMonitorWidget';
import { WeatherWidget } from './widgets/WeatherWidget';
type ConfigItem = {
    widget?: WIDGET,
    shortcut?: ShortcutItem,
    order: number,
    size: number
}

type ShortcutItem = {
    name: string,
    url: string,
    icon: string
}

enum WIDGET {
    DATE_TIME = 'date_time',
    SYSTEM_MONITOR = 'system_monitor',
    WEATHER = 'weather'
}

const renderWidget = (configItem: ConfigItem, index: number) => {
    const widget = configItem.widget;
    switch (widget) {
    case WIDGET.DATE_TIME:
        return <DateTimeWidget key={index}/>;
    case WIDGET.SYSTEM_MONITOR:
        return <SystemMonitorWidget key={index}/>;
    case WIDGET.WEATHER:
        return <WeatherWidget key={index}/>;
    default:
        return null;
    }
};

const renderAppShortcut = (shortcutItem: ShortcutItem, index: number) => {
    return <AppShortcut url={shortcutItem.url} name={shortcutItem.name} iconName={shortcutItem.icon} key={index}/>;
};

type Props = {
    config: any;
}

export const Dashboard = ({ config }: Props) => {
    // Passed in via docker-compose .env file via entrypoint.sh at runtime
    const localIp = window.env?.VITE_HOST_IP || 'localhost';
    // const config: any = configFile;



    return (
        <Box>
            <Grid container spacing={3} sx={styles.center} size={12}>
                {config?.dashboard?.items?.map((item: ConfigItem, index: number) => item.widget &&
                    renderWidget(item, index)
                )}
            </Grid>
            <Grid container spacing={3} sx={styles.center} size={12} mt={8}>
                {config?.dashboard?.items?.map((item: ConfigItem, index: number) => item.shortcut &&
                    renderAppShortcut(item.shortcut, index)
                )}
            </Grid>
        </Box>
    );
};
