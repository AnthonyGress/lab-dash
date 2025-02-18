import { createContext, Dispatch, SetStateAction } from 'react';

import { DashboardItem } from '../../../shared/types/dashboard-item';
import { NewItem } from '../types';

export interface IAppContext {
    dashboardLayout: DashboardItem[];
    setDashboardLayout: Dispatch<SetStateAction<DashboardItem[]>>
    refreshDashboard: () => Promise<void>;
    saveLayout: (items: DashboardItem[]) => void;
    addItem: (itemToAdd: NewItem) => void;
    updateItem: (id: string, updatedData: Partial<NewItem>) => void;
}

export const AppContext = createContext<IAppContext>(null!);
