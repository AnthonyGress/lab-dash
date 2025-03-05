import { Box } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { SearchBar } from './SearchBar';
import { useAppContext } from '../../context/useAppContext';
import { DashboardItem } from '../../types';
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
        const options = dashboardLayout
            .filter((item: DashboardItem) => item.url)
            .map((item) => ({
                label: item.label,
                icon: getIconPath(item.icon?.path as string),
                url: item.url,
            }));
        setSearchOptions(options);
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
