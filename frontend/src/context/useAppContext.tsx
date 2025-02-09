import { useContext } from 'react';

import { AppContext } from './AppContext';

export const useAppContext = () => useContext(AppContext);
