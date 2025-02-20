import { useMediaQuery } from '@mui/material';
import { ReactNode, useState } from 'react';
import shortid from 'shortid';

import { AppContext } from './AppContext';
import { DashApi } from '../api/dash-api';
import { initialItems } from '../constants/constants';
import { theme } from '../theme/theme';
import { DashboardItem, DashboardLayout, NewItem } from '../types';

type Props = {
    children: ReactNode
};

export const AppContextProvider = ({ children }: Props) => {
    const [dashboardLayout, setDashboardLayout] = useState<DashboardItem[]>(initialItems);
    const  isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const getSavedLayout = async () => {
        console.log('Fetching saved layout');

        const res = await DashApi.getLayout(); // Retrieves { desktop: [], mobile: [] }

        if (res) {
            const selectedLayout = isMobile ? res.mobile : res.desktop;
            if (selectedLayout.length > 0) {
                setDashboardLayout(selectedLayout);
            }
            return selectedLayout;
        }
        return [];
    };

    const saveLayout = async (items: DashboardItem[]) => {
        console.log('saving layout');

        const existingLayout = await DashApi.getLayout();

        let updatedLayout: DashboardLayout;

        if (existingLayout.mobile.length > 3) {
            // has no prev mobile layout, duplicate desktop
            updatedLayout = isMobile
                ? { ...existingLayout, mobile: items }
                : { ...existingLayout, desktop: items };
        } else {
            updatedLayout = { desktop: items, mobile: items };
        }

        console.log('Saving updated layout:', updatedLayout);
        await DashApi.saveLayout(updatedLayout);
    };

    const refreshDashboard = async () => {
        try {
            console.log('updating dashboard');
            const savedLayout = await getSavedLayout();
            console.log('Updated dashboard:', savedLayout);
        } catch (error) {
            console.error('Failed to refresh dashboard:', error);
        }
    };

    const addItem = (itemToAdd: NewItem) => {
        console.log('add item');

        const newItem: DashboardItem = {
            id: `item-${shortid.generate()}`,
            label: itemToAdd.label,
            icon: itemToAdd.icon,
            url: itemToAdd.url,
            type: itemToAdd.type,
            showLabel: itemToAdd.showLabel
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
