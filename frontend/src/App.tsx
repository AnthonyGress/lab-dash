import { Box } from '@mui/material';
import axios from 'axios';
import { useEffect, useState } from 'react';

import { DashboardGrid } from './components/dnd/DashboardGrid';
import { AddForm } from './components/forms/AddForm';
import { CenteredModal } from './components/modals/CenteredModal';
import { ResponsiveAppBar } from './components/ResponsiveAppBar';
import './theme/App.css';
import { useAppContext } from './context/useAppContext';
import { ITEM_TYPE } from './types';

declare global {
    interface Window {
        env?: any;
    }
}

function App() {
    const [openAddModal, setOpenAddModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [config, setConfig] = useState<any>();
    // const [items, setItems] = useState(initialItems);
    const { dashboardLayout, refreshDashboard } = useAppContext();

    const handleClose = () => setOpenAddModal(false);

    useEffect(() => {
        refreshDashboard();
    }, []);

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            backgroundImage: 'url(/space.jpeg)',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover'
        }}
        >
            <ResponsiveAppBar
                editMode={editMode}
                setEditMode={setEditMode}
                setOpenAddModal={setOpenAddModal}
            />
            <Box component='main' mt={'4vh'} mb={'4vh'}>
                <DashboardGrid editMode={editMode} items={dashboardLayout}/>
            </Box>
            <CenteredModal open={openAddModal} handleClose={handleClose} title='Add Item' >
                <AddForm handleClose={handleClose}/>
            </CenteredModal>
        </Box>
    );
}

export default App;
