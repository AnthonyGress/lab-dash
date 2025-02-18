import { DashboardItem } from './dashboard-item'

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
