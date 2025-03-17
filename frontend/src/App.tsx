import './theme/App.css';
import { GlobalStyles } from '@mui/material';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';

import { WithNav } from './components/navbar/WithNav';
import { BACKEND_URL } from './constants/constants';
import { useAppContext } from './context/useAppContext';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';

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
                        <Route path='/login' element={<LoginPage />}/>
                        <Route path='/signup' element={<LoginPage />}/>
                    </Route>
                </Routes>
            </Router>
        </>
    );
};
