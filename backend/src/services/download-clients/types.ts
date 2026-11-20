import { UpstreamConnection } from '../upstream';

export { describeUpstreamError as describeClientError, readConnection } from '../upstream';

/** Totals shown in the widget footer. Field names follow qBittorrent, the first client supported. */
export type DownloadStats = {
    dl_info_speed: number;
    dl_info_data: number;
    up_info_speed: number;
    up_info_data: number;
    torrents: {
        total: number;
        downloading: number;
        seeding: number;
        completed: number;
        paused: number;
    };
};

/** One download, reduced to what the widget shows. */
export type DownloadEntry = {
    hash: string;
    name: string;
    state: string;
    /** 0 to 1 */
    progress: number;
    size: number;
    dlspeed: number;
    upspeed: number;
    /** Seconds */
    eta?: number;
};

export type DownloadSnapshot = {
    stats: DownloadStats;
    torrents: DownloadEntry[];
};

/** Where a client lives and how to log in. */
export type ClientConnection = UpstreamConnection;

export type DownloadClient = {
    /** Name used in messages shown to the user */
    name: string;
    defaultPort: string;
    /** Set when the client's own queue order is meaningful and must not be re-sorted */
    keepsQueueOrder?: boolean;
    /** Overrides the default pace (fast while downloading, slow when idle) */
    intervalMs?: number;
    snapshot: (connection: ClientConnection, signal: AbortSignal) => Promise<DownloadSnapshot>;
    resume: (connection: ClientConnection, id: string) => Promise<void>;
    pause: (connection: ClientConnection, id: string) => Promise<void>;
    remove: (connection: ClientConnection, id: string, deleteFiles: boolean) => Promise<void>;
};

export const emptyStats = (): DownloadStats => ({
    dl_info_speed: 0,
    dl_info_data: 0,
    up_info_speed: 0,
    up_info_data: 0,
    torrents: { total: 0, downloading: 0, seeding: 0, completed: 0, paused: 0 }
});
