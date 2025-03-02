import { useMediaQuery } from '@mui/material';
import { ReactNode, useState } from 'react';
import shortid from 'shortid';

import { AppContext } from './AppContext';
import { DashApi } from '../api/dash-api';
import { initialItems } from '../constants/constants';
import { theme } from '../theme/theme';
import { Config, DashboardItem, DashboardLayout, NewItem } from '../types';

type Props = {
    children: ReactNode
};

export const AppContextProvider = ({ children }: Props) => {
    const [config, setConfig] = useState<Config>();
    const [dashboardLayout, setDashboardLayout] = useState<DashboardItem[]>(initialItems);
    const [editMode, setEditMode] = useState(false);
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const getLayout = async () => {
        console.log('Fetching saved layout');

        const res = await DashApi.getConfig(); // Retrieves { desktop: [], mobile: [] }

        if (res) {
            setConfig(res);
            const selectedLayout = isMobile ? res.layout.mobile : res.layout.desktop;
            if (selectedLayout.length > 0) {
                setDashboardLayout(selectedLayout);
            }
            return selectedLayout;
        }
        return [];
    };

    const saveLayout = async (items: DashboardItem[]) => {

        const existingLayout = await DashApi.getConfig();
        console.log('saving layout', );

        let updatedLayout: DashboardLayout;

        if (existingLayout.layout.mobile.length > 3) {
            console.log('saving mobile layout', items);

            // has no prev mobile layout, duplicate desktop
            updatedLayout = isMobile
                ? { layout: { ...existingLayout.layout, mobile: items } }
                : { layout: { ...existingLayout.layout, desktop: items } };
        } else {
            console.log('desktop + mobile', items);
            updatedLayout = { layout: { desktop: items, mobile: items } };
        }

        console.log('Saving updated layout:', updatedLayout);
        await DashApi.saveConfig(updatedLayout);
    };

    const refreshDashboard = async () => {
        try {
            console.log('updating dashboard');
            const savedLayout = await getLayout();
            console.log('Updated dashboard:', savedLayout);
            setConfig(await DashApi.getConfig());
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

    const updateConfig = async (partialConfig: Partial<Config>) => {
        try {
            const updatedConfig: Partial<Config> = { ...partialConfig };

            // Ensure backgroundImage is a File before uploading
            if (partialConfig.backgroundImage && typeof partialConfig.backgroundImage === 'object' && 'name' in partialConfig.backgroundImage) {
                const res = await DashApi.uploadBackgroundImage(partialConfig.backgroundImage);

                console.log('########### uploaded', res);

                if (res?.filePath) {
                    updatedConfig.backgroundImage = res.filePath;
                } else {
                    console.error('Failed to upload background image');
                    return;
                }
            }

            // Save updated config to API
            await DashApi.saveConfig(updatedConfig);

            // Update state with only the provided values, ensuring layout is always defined
            setConfig((prev) => {
                if (!prev) return { ...updatedConfig, layout: { desktop: [], mobile: [] } };

                return {
                    ...prev,
                    ...updatedConfig,
                    layout: prev.layout ?? { desktop: [], mobile: [] }, // Ensures layout is always defined
                };
            });

        } catch (error) {
            console.error('Error updating config:', error);
        }
    };


    const { Provider } = AppContext;

    return (
        <Provider value={{ dashboardLayout, refreshDashboard, saveLayout: saveLayout, addItem, setDashboardLayout, updateItem, editMode, setEditMode, config, updateConfig }}>
            {children}
        </Provider>
    );
};
