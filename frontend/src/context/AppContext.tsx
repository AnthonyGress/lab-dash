import { createContext, Dispatch, SetStateAction } from 'react';

import { DashboardItem, NewItem } from '../types';

export interface IAppContext {
    dashboardLayout: DashboardItem[];
    setDashboardLayout: Dispatch<SetStateAction<DashboardItem[]>>;
    refreshDashboard: () => Promise<void>;
    saveLayout: (items: DashboardItem[]) => void;
    addItem: (itemToAdd: NewItem) => void;
    updateItem: (id: string, updatedData: Partial<NewItem>) => void;
    editMode: boolean;
    setEditMode: Dispatch<SetStateAction<boolean>>;
}

export const AppContext = createContext<IAppContext>(null!);
