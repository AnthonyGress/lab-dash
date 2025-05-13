export interface GroupItem {
    id: string;
    name: string;
    url: string;
    icon?: string;
    isWol?: boolean;
    macAddress?: string;
    broadcastAddress?: string;
    port?: number;
    healthUrl?: string;
    healthCheckType?: string;
    [key: string]: any;
}
