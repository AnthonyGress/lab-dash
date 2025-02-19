import { Box } from '@mui/material';
import { useEffect, useState } from 'react';

import { DashboardGrid } from './components/dnd/DashboardGrid';
import { ResponsiveAppBar } from './components/ResponsiveAppBar';
import { useAppContext } from './context/useAppContext';
import './theme/App.css';

function App() {
    const [editMode, setEditMode] = useState(false);
    const { dashboardLayout, refreshDashboard } = useAppContext();


    useEffect(() => {
        refreshDashboard();
    }, []);

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column'
        }}
        >
            <ResponsiveAppBar
                editMode={editMode}
                setEditMode={setEditMode}
            />
            <Box component='main' sx={{
                flexGrow: 1,
                padding: '2vh 0vw',
                mt: '64px'
            }}>
                <DashboardGrid editMode={editMode} items={dashboardLayout}/>
            </Box>
        </Box>
    );
}

export default App;
