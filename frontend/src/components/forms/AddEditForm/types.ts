export type FormValues = {
    shortcutName?: string;
    pageName?: string;
    itemType: string;
    url?: string;
    healthUrl?: string;
    healthCheckType?: 'http' | 'ping';
    icon?: { path: string; name: string; source?: string } | null;
    showLabel?: boolean;
    widgetType?: string;
    placeholderSize?: string;
    // Weather widget
    temperatureUnit?: string;
    location?: { name: string; latitude: number; longitude: number } | null;
    // System monitor widget
    gauge1?: string;
    gauge2?: string;
    gauge3?: string;
    networkInterface?: string;
    showDiskUsage?: boolean;
    showSystemInfo?: boolean;
    showInternetStatus?: boolean;
    // Disk monitor widget
    selectedDisks?: Array<{ mount: string; customName: string; showMountPath?: boolean }>;
    showIcons?: boolean;
    showMountPath?: boolean;
    showName?: boolean;
    layout?: '2x2' | '2x4' | '1x6';
    // DateTime widget
    timezone?: string;
    // Pihole widget
    piholeUrl?: string;
    piholeApiKey?: string;
    piholeHost?: string;
    piholePort?: string;
    piholeSsl?: boolean;
    piholeApiToken?: string;
    piholePassword?: string;
    piholeName?: string;
    // AdGuard widget
    adguardHost?: string;
    adguardPort?: string;
    adguardSsl?: boolean;
    adguardUsername?: string;
    adguardPassword?: string;
    adguardName?: string;
    // Media server widget
    mediaServerType?: string;
    mediaServerName?: string;
    msHost?: string;
    msPort?: string;
    msSsl?: boolean;
    msApiKey?: string;
    // Sonarr widget
    sonarrName?: string;
    sonarrHost?: string;
    sonarrPort?: string;
    sonarrSsl?: boolean;
    sonarrApiKey?: string;

    // Radarr widget
    radarrName?: string;
    radarrHost?: string;
    radarrPort?: string;
    radarrSsl?: boolean;
    radarrApiKey?: string;

    // Media Request Manager widget
    mediaRequestManagerService?: 'jellyseerr' | 'overseerr';
    mediaRequestManagerName?: string;
    mediaRequestManagerHost?: string;
    mediaRequestManagerPort?: string;
    mediaRequestManagerSsl?: boolean;
    mediaRequestManagerApiKey?: string;

    // Notes widget
    displayName?: string;
    defaultNoteFontSize?: string;

    // Torrent client widget
    torrentClient?: string;
    torrentUrl?: string;
    torrentUsername?: string;
    torrentPassword?: string;
    torrentClientType?: string;
    tcHost?: string;
    tcPort?: string;
    tcSsl?: boolean;
    tcUsername?: string;
    tcPassword?: string;

    // Dual Widget
    topWidgetType?: string;
    bottomWidgetType?: string;
    // Dual Widget - position-specific fields for top widget
    top_temperatureUnit?: string;
    top_location?: { name: string; latitude: number; longitude: number } | null;
    top_timezone?: string;
    top_gauge1?: string;
    top_gauge2?: string;
    top_gauge3?: string;
    top_networkInterface?: string;
    top_showDiskUsage?: boolean;
    top_showSystemInfo?: boolean;
    top_showInternetStatus?: boolean;
    top_selectedDisks?: Array<{ mount: string; customName: string; showMountPath?: boolean }>;
    top_showIcons?: boolean;
    top_showMountPath?: boolean;
    top_showName?: boolean;
    top_layout?: '2x2' | '2x4' | '1x6';
    top_piholeHost?: string;
    top_piholePort?: string;
    top_piholeSsl?: boolean;
    top_piholeApiToken?: string;
    top_piholePassword?: string;
    top_piholeName?: string;
    top_adguardHost?: string;
    top_adguardPort?: string;
    top_adguardSsl?: boolean;
    top_adguardUsername?: string;
    top_adguardPassword?: string;
    top_adguardName?: string;
    top_showLabel?: boolean;
    // Dual Widget - position-specific fields for bottom widget
    bottom_temperatureUnit?: string;
    bottom_location?: { name: string; latitude: number; longitude: number } | null;
    bottom_timezone?: string;
    bottom_gauge1?: string;
    bottom_gauge2?: string;
    bottom_gauge3?: string;
    bottom_networkInterface?: string;
    bottom_showDiskUsage?: boolean;
    bottom_showSystemInfo?: boolean;
    bottom_showInternetStatus?: boolean;
    bottom_selectedDisks?: Array<{ mount: string; customName: string; showMountPath?: boolean }>;
    bottom_showIcons?: boolean;
    bottom_showMountPath?: boolean;
    bottom_showName?: boolean;
    bottom_layout?: '2x2' | '2x4' | '1x6';
    bottom_piholeHost?: string;
    bottom_piholePort?: string;
    bottom_piholeSsl?: boolean;
    bottom_piholeApiToken?: string;
    bottom_piholePassword?: string;
    bottom_piholeName?: string;
    bottom_adguardHost?: string;
    bottom_adguardPort?: string;
    bottom_adguardSsl?: boolean;
    bottom_adguardUsername?: string;
    bottom_adguardPassword?: string;
    bottom_adguardName?: string;
    bottom_showLabel?: boolean;
    // Other fields
    adminOnly?: boolean;
    isWol?: boolean;
    macAddress?: string;
    broadcastAddress?: string;
    port?: string;
    maxItems?: string;
};
