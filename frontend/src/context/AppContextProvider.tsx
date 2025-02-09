import { ReactNode, useState } from 'react';

import { AppContext } from './AppContext';
import { initialItems } from '../constants/constants';
import { DashboardItem, NewItem } from '../types';

type Props = {
    children: ReactNode
};

const LOCAL_STORAGE_KEY = 'dashboardLayout';

export const AppContextProvider = ({ children }: Props) => {
    const [dashboardLayout, setDashboardLayout] = useState<DashboardItem[]>(initialItems);

    const getSavedLayout = async () => {
        console.log('getSavedLayout');

        const savedLayout = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedLayout) {
            setDashboardLayout(JSON.parse(savedLayout));
        }
        return [];
    };

    // Save layout to localStorage
    const saveLayout = (items: DashboardItem[]) => {
        const jsonData = JSON.stringify({ items });
        localStorage.setItem(LOCAL_STORAGE_KEY, jsonData);
    };

    const refreshDashboard = async () => {
        try {
            console.log('updating dashboard');
            const savedLayout = getSavedLayout();
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


    const { Provider } = AppContext;

    return (
        <Provider value={{ dashboardLayout, refreshDashboard, saveLayout, addItem }}>
            {children}
        </Provider>
    );
};
