// Shared by the widgets-*.test.tsx files: feeds the mocked realtime socket from
// test/components/setup.ts, which `useLiveData` reads through `realtime.getState`.
import { LiveState, realtime } from '../../src/realtime/socket';

type MockedRealtime = typeof realtime & {
    __setState: (topic: string, itemId: string | undefined, state: LiveState) => void;
};

/** What the server has pushed for a stream from now on; call before rendering, or rerender after */
export const setLive = (topic: string, itemId: string | undefined, state: LiveState): void => {
    (realtime as MockedRealtime).__setState(topic, itemId, state);
};
