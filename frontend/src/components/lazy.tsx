import { ComponentType, lazy, ReactNode, Suspense, useRef } from 'react';

/**
 * Wraps a component so its code is downloaded the first time it is rendered,
 * not with the dashboard. Used for screens most visits never open: settings,
 * login, the add/edit forms, release notes.
 */
export const lazyComponent = <P extends object>(
    load: () => Promise<ComponentType<P>>,
    fallback: ReactNode = null
): ComponentType<P> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Lazy = lazy(async () => ({ default: (await load()) as ComponentType<any> }));

    const LazyComponent = (props: P) => (
        <Suspense fallback={fallback}>
            <Lazy {...props} />
        </Suspense>
    );
    return LazyComponent;
};

/**
 * True from the first time `open` is true. Lets a modal that is always mounted
 * (to keep its closing animation) stay unloaded until it is first opened.
 */
export const useHasBeenOpen = (open: boolean): boolean => {
    const hasBeenOpen = useRef(open);
    if (open) hasBeenOpen.current = true;
    return hasBeenOpen.current;
};
