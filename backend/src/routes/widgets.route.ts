import { Request, Response, Router } from 'express';

import { getSystemInfo } from '../system-monitor';

export const widgetsRoute = Router();

interface WidgetConfig {
    id: string;
    type: string;
    config?: any;
}

interface BulkWidgetRequest {
    widgets: WidgetConfig[];
}

// Bulk load initial widget data for faster startup
widgetsRoute.post('/bulk-data', async (req: Request, res: Response) => {
    try {
        const { widgets }: BulkWidgetRequest = req.body;

        if (!widgets || !Array.isArray(widgets)) {
            res.status(400).json({ message: 'widgets must be an array' });
            return;
        }

        const widgetData: { [key: string]: any } = {};
        const errors: string[] = [];

        // Process each widget type for initial data
        const dataPromises = widgets.map(async (widget: WidgetConfig) => {
            try {
                let data: any = null;

                switch (widget.type) {
                case 'SYSTEM_MONITOR_WIDGET':
                    // Get initial system information
                    try {
                        data = await getSystemInfo(widget.config?.networkInterface);
                    } catch (error) {
                        console.error(`Error loading system info for ${widget.id}:`, error);
                    }
                    break;

                case 'DISK_MONITOR_WIDGET':
                    // Get initial disk information
                    try {
                        data = await getSystemInfo(widget.config?.networkInterface);
                        // Extract only disk info if available
                        if (data && data.disks) {
                            data = { disks: data.disks };
                        }
                    } catch (error) {
                        console.error(`Error loading disk info for ${widget.id}:`, error);
                    }
                    break;

                case 'WEATHER_WIDGET':
                    // For weather, we can't pre-load data without location
                    // But we can provide a placeholder structure
                    data = {
                        placeholder: true,
                        message: 'Weather data will load once location is available'
                    };
                    break;

                case 'DATE_TIME_WIDGET':
                    // Provide current time and timezone info
                    data = {
                        currentTime: new Date().toISOString(),
                        timezone: widget.config?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
                    };
                    break;

                case 'NOTES_WIDGET':
                    // Notes can start empty
                    data = {
                        placeholder: true,
                        content: widget.config?.content || ''
                    };
                    break;

                // For service-based widgets, we could add health checks here
                case 'PIHOLE_WIDGET':
                case 'ADGUARD_WIDGET':
                case 'QBITTORRENT_WIDGET':
                case 'TRANSMISSION_WIDGET':
                case 'DELUGE_WIDGET':
                case 'SABNZBD_WIDGET':
                case 'SONARR_WIDGET':
                case 'RADARR_WIDGET':
                case 'JELLYFIN_WIDGET':
                case 'JELLYSEERR_WIDGET':
                    // For service widgets, provide initial status structure
                    data = {
                        status: 'loading',
                        message: 'Connecting to service...',
                        lastUpdated: new Date().toISOString()
                    };
                    break;

                case 'GROUP_WIDGET':
                    // Group widgets don't need initial data
                    data = {
                        itemCount: widget.config?.items?.length || 0
                    };
                    break;

                case 'DUAL_WIDGET':
                    // Dual widgets are containers, no initial data needed
                    data = {
                        topWidget: widget.config?.topWidget?.type || null,
                        bottomWidget: widget.config?.bottomWidget?.type || null
                    };
                    break;

                default:
                    // For unknown widget types, provide basic structure
                    data = {
                        status: 'ready',
                        type: widget.type
                    };
                    break;
                }

                if (data) {
                    widgetData[widget.id] = {
                        ...data,
                        widgetType: widget.type,
                        loadedAt: new Date().toISOString()
                    };
                }

            } catch (error) {
                console.error(`Error processing widget ${widget.id}:`, error);
                errors.push(`Failed to process widget: ${widget.id}`);
            }
        });

        await Promise.all(dataPromises);

        // Return the results
        res.json({
            widgetData,
            errors: errors.length > 0 ? errors : undefined,
            loaded: Object.keys(widgetData).length,
            total: widgets.length,
            loadedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in bulk widget data loading:', error);
        res.status(500).json({
            message: 'Failed to load widget data in bulk',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default widgetsRoute;
