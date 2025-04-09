/**
 * Access the root package.json version that is exposed by Vite during build
 */
export const getAppVersion = (): string => {
    return import.meta.env.APP_VERSION as string;
};
