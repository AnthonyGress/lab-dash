import { ReactNode, useState } from 'react';

import { AppContext } from './AppContext';
import { DashApi } from '../api/dash-api';
import { initialItems } from '../constants/constants';
import { DashboardItem, NewItem } from '../types';

type Props = {
    children: ReactNode
};

export const AppContextProvider = ({ children }: Props) => {
    const [dashboardLayout, setDashboardLayout] = useState<DashboardItem[]>(initialItems);

    const getSavedLayout = async () => {
        console.log('getSavedLayout');

        const res = await DashApi.getLayout();

        if (res) {
            setDashboardLayout(res);
            return res;
        }
        return [];
    };

    // Save layout to localStorage
    const saveLayout = async (items: DashboardItem[]) => {
        const res = await DashApi.saveLayout(items);
        console.log(res);
    };

    const refreshDashboard = async () => {
        try {
            console.log('updating dashboard');
            const savedLayout = await getSavedLayout();
            console.log('Updated dashboard:', savedLayout);
        } catch (error) {
            console.error('Failed to refresh portfolio:', error);
        }
    };


    const addItem = (itemToAdd: NewItem) => {
        const newItem = {
            id: `item-${dashboardLayout.length + 1}`,
            label: itemToAdd.label,
            icon: itemToAdd.icon,
            url: itemToAdd.url,
            type: itemToAdd.type,
        };
        setDashboardLayout((prevItems: any) => [...prevItems, newItem]);
    };

    const updateItem = (id: string, updatedData: Partial<NewItem>) => {
        setDashboardLayout((prevLayout) =>
            prevLayout.map((item) =>
                item.id === id ? { ...item, ...updatedData } : item
            )
        );
    };

    const { Provider } = AppContext;

    return (
        <Provider value={{ dashboardLayout, refreshDashboard, saveLayout, addItem, setDashboardLayout, updateItem }}>
            {children}
        </Provider>
    );
};
