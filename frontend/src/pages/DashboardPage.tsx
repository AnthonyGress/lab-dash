import { DashboardGrid } from '../components/dashboard/DashboardGrid';

export const DashboardPage = () => {
    // All page switching logic is now handled in AppContextProvider
    // This component just renders the dashboard grid
    return (
        <DashboardGrid />
    );
};
