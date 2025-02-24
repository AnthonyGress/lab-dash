import './theme/App.css';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';

import { DashboardGrid } from './components/dnd/DashboardGrid';
import { WithNav } from './components/navbar/WithNav';
import { SettingsPage } from './components/SettingsPage';

export const App = () => {

    return (
        <Router>
            <Routes>
                <Route element={<WithNav />}>
                    <Route path='/' element={<DashboardGrid />}/>
                    <Route path='/settings' element={<SettingsPage />}/>
                </Route>
            </Routes>
        </Router>
    );
};
