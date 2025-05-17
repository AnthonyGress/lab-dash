import { Box } from '@mui/material';
import { useEffect, useState } from 'react';

import { SearchBar } from './SearchBar';
import { useAppContext } from '../../context/useAppContext';
import { DashboardItem, ITEM_TYPE } from '../../types';
import { GroupItem } from '../../types/group';
import { getIconPath } from '../../utils/utils';

type SearchOption = {
  label: string;
  icon?: string;
  url?: string;
};

export const GlobalSearch = () => {
    const [searchOptions, setSearchOptions] = useState<SearchOption[]>([]);
    const [searchValue, setSearchValue] = useState('');
    const { dashboardLayout } = useAppContext();

    useEffect(() => {
        // Start with items that have direct URLs
        const directOptions = dashboardLayout
            .filter((item: DashboardItem) => item.url)
            .map((item) => ({
                label: item.label,
                icon: getIconPath(item.icon?.path as string),
                url: item.url,
            }));

        // Find group widgets and extract their items
        const groupWidgetItems: SearchOption[] = [];

        dashboardLayout.forEach((item: DashboardItem) => {
            // Check if this is a group widget with items
            if (item.type === ITEM_TYPE.GROUP_WIDGET &&
                item.config?.items &&
                Array.isArray(item.config.items)) {

                // Extract items from the group
                const groupItems = item.config.items as GroupItem[];

                // Map group items to search options
                const groupOptions = groupItems.map((groupItem: GroupItem) => ({
                    label: groupItem.name,
                    icon: getIconPath(groupItem.icon || ''),
                    url: groupItem.url,
                }));

                groupWidgetItems.push(...groupOptions);
            }
        });

        // Combine direct options and group options
        setSearchOptions([...directOptions, ...groupWidgetItems]);
    }, [dashboardLayout]);

    return (
        <Box sx={{ width: '100%' }}>
            <SearchBar
                placeholder='Search...'
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                autocompleteOptions={searchOptions}
            />
        </Box>
    );
};
