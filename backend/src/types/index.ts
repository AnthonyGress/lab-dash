export type Config = {
    layout: {
        desktop: DashboardItem[];
        mobile: DashboardItem[];
    }
}

export type DashboardLayout = {
    desktop: DashboardItem[];
    mobile: DashboardItem[];
}

export type DashboardItem = {
    id: string;
    label: string;
    type: string;
    url?: string;
    icon?: { path: string; name: string; source?: string; };
    showName?: boolean;
};

