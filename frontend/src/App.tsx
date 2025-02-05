import { Box } from '@mui/material';
import axios from 'axios';
import { useEffect, useState } from 'react';

import { Dashboard } from './components/Dashboard';
import { ResponsiveAppBar } from './components/ResponsiveAppBar';

import './theme/App.css';
import { CenteredModal } from './components/CenteredModal';
import { AddForm } from './components/forms/AddForm';

declare global {
    interface Window {
        env?: any;
    }
}

function App() {
    const [openAddModal, setOpenAddModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [config, setConfig] = useState<any>();

    const handleClose = () => setOpenAddModal(false);

    useEffect(() => {
        const fetchData = async () => {
            const response = await axios.get('/config/config.json');
            console.log('config', response.data);
            setConfig(response.data);
        };

        fetchData();
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
            <ResponsiveAppBar editMode={editMode} setEditMode={setEditMode} setOpenAddModal={setOpenAddModal}/>
            <Box component='main' mt={'4vh'} mb={'4vh'}>
                <Dashboard config={config}/>
            </Box>
            <CenteredModal open={openAddModal} handleClose={handleClose} title='Add Item' >
                <AddForm handleClose={handleClose}/>
            </CenteredModal>
        </Box>
    );
}

export default App;
