import './theme/App.css';
import { GlobalStyles } from '@mui/material';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';

import { WithNav } from './components/navbar/WithNav';
import { DashboardPage } from './components/pages/DashboardPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { BACKEND_URL } from './constants/constants';
import { useAppContext } from './context/useAppContext';

export const App = () => {
    const { config } = useAppContext();

    const backgroundImage = config?.backgroundImage
        ? `url('${BACKEND_URL}/uploads/${config?.backgroundImage}')`
        : 'url(\'/space4k-min.webp\')';

    const globalStyles = (
        <GlobalStyles
            styles={{
                'body': {
                    background: backgroundImage,
                    backgroundSize: 'cover',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    // backgroundAttachment: 'scroll',
                    imageRendering: 'crispEdges',
                },
            }}
        />
    );

    return (
        <>
            {globalStyles}
            <Router>
                <Routes>
                    <Route element={<WithNav />}>
                        <Route path='/' element={<DashboardPage />}/>
                        <Route path='/settings' element={<SettingsPage />}/>
                    </Route>
                </Routes>
            </Router>
        </>
    );
};
