import axios from 'axios';

// import { APP_VERSION } from '../constants/version';
import { getAppVersion } from './version';

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
}

/**
 * Compares two semver version strings
 * @returns negative if v1 < v2, 0 if v1 === v2, positive if v1 > v2
 */
export const compareVersions = (v1: string, v2: string): number => {
    const v1Parts = v1.replace(/^v/, '').split('.').map(Number);
    const v2Parts = v2.replace(/^v/, '').split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const v1Part = v1Parts[i] || 0;
        const v2Part = v2Parts[i] || 0;
        if (v1Part !== v2Part) {
            return v1Part - v2Part;
        }
    }

    return 0;
};

/**
 * Fetches the latest release from GitHub
 */
export const fetchLatestRelease = async (): Promise<GitHubRelease | null> => {
    try {
        const response = await axios.get<GitHubRelease>(
            'https://api.github.com/repos/anthonygress/lab-dash/releases/latest'
        );
        return response.data;
    } catch (error) {
        console.error('Failed to fetch latest release:', error);
        return null;
    }
};

/**
 * Checks if an update is available
 */
export const checkForUpdates = async (): Promise<{
  updateAvailable: boolean;
  latestVersion: string | null;
  releaseUrl: string | null;
}> => {
    try {
        const latestRelease = await fetchLatestRelease();

        if (!latestRelease) {
            return { updateAvailable: false, latestVersion: null, releaseUrl: null };
        }

        const latestVersion = latestRelease.tag_name;
        const currentVersion = getAppVersion();

        // Compare versions
        const comparison = compareVersions(latestVersion, currentVersion);
        const updateAvailable = comparison > 0;

        console.log(`Version check: Current=${currentVersion}, Latest=${latestVersion}, Update Available=${updateAvailable}`);

        return {
            updateAvailable,
            latestVersion: updateAvailable ? latestVersion : null,
            releaseUrl: updateAvailable ? latestRelease.html_url : null,
        };
    } catch (error) {
        console.error('Error checking for updates:', error);
        return { updateAvailable: false, latestVersion: null, releaseUrl: null };
    }
};
