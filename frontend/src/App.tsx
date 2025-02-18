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
            flexDirection: 'column',
            height: '100vh',
            width: '100vw',
            overflow: 'hidden',
            backgroundImage: 'url(/space.jpeg)',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
        }}
        >
            <ResponsiveAppBar
                editMode={editMode}
                setEditMode={setEditMode}
            />
            <Box component='main' sx={{
                flexGrow: 1,
                overflowY: 'auto',
                padding: '2vh 0vw',
                WebkitOverflowScrolling: 'touch',
                // height: 'calc(100vh - 8vh)',
            }}>
                <DashboardGrid editMode={editMode} items={dashboardLayout}/>
            </Box>
        </Box>
    );
}

export default App;
