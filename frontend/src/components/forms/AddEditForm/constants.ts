import {
    Launch as LaunchIcon,
    Article as PageIcon,
    CropFree as PlaceholderIcon,
    Widgets as WidgetIcon
} from '@mui/icons-material';
import {
    FaClock,
    FaCloudSun,
    FaDownload,
    FaFilm,
    FaHdd,
    FaLayerGroup,
    FaMicrochip,
    FaPlay,
    FaShieldAlt,
    FaStickyNote,
    FaTh,
    FaTv,
    FaVideo
} from 'react-icons/fa';
import { PiSquareSplitVerticalFill } from 'react-icons/pi';

import { ITEM_TYPE } from '../../../types';

export const WIDGET_OPTIONS = [
    {
        id: ITEM_TYPE.ADGUARD_WIDGET,
        label: 'AdGuard Home',
        icon: FaShieldAlt,
        description: 'Monitor AdGuard Home DNS blocking statistics'
    },
    {
        id: ITEM_TYPE.DATE_TIME_WIDGET,
        label: 'Date & Time',
        icon: FaClock,
        description: 'Display current date, time, and timezone information'
    },
    {
        id: ITEM_TYPE.DISK_MONITOR_WIDGET,
        label: 'Disk Monitor',
        icon: FaHdd,
        description: 'View disk usage and storage information'
    },
    {
        id: ITEM_TYPE.DOWNLOAD_CLIENT,
        label: 'Download Client',
        icon: FaDownload,
        description: 'Manage torrent/usenet download activity'
    },
    {
        id: ITEM_TYPE.DUAL_WIDGET,
        label: 'Dual Widget',
        icon: PiSquareSplitVerticalFill,
        iconSize: 40,
        description: 'Combine two widgets into one item'
    },
    {
        id: ITEM_TYPE.GROUP_WIDGET,
        label: 'Group',
        icon: FaLayerGroup,
        description: 'Group multiple shortcuts together in a container'
    },
    {
        id: ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET,
        label: 'Media Request Manager',
        icon: FaFilm,
        description: 'Request media and manage approvals'
    },
    {
        id: ITEM_TYPE.MEDIA_SERVER_WIDGET,
        label: 'Media Server',
        icon: FaPlay,
        description: 'Monitor active users, now playing details, and total stored media '
    },
    {
        id: ITEM_TYPE.NOTES_WIDGET,
        label: 'Notes',
        icon: FaStickyNote,
        description: 'Save quick notes with markdown support'
    },
    {
        id: ITEM_TYPE.PIHOLE_WIDGET,
        label: 'Pi-hole',
        icon: FaShieldAlt,
        description: 'Monitor Pi-hole DNS blocking statistics'
    },
    {
        id: ITEM_TYPE.RADARR_WIDGET,
        label: 'Radarr',
        icon: FaVideo,
        description: 'Manage movie downloads and monitor status'
    },
    {
        id: ITEM_TYPE.SONARR_WIDGET,
        label: 'Sonarr',
        icon: FaTv,
        description: 'Manage tv show downloads and monitor status'
    },
    {
        id: ITEM_TYPE.SYSTEM_MONITOR_WIDGET,
        label: 'System Monitor',
        icon: FaMicrochip,
        description: 'Monitor CPU, RAM, temperature, network speed and more'
    },
    {
        id: ITEM_TYPE.WEATHER_WIDGET,
        label: 'Weather',
        icon: FaCloudSun,
        description: 'Live weather conditions and forecast for any location'
    }
];

export const ITEM_TYPE_OPTIONS = [
    {
        id: ITEM_TYPE.APP_SHORTCUT,
        label: 'Shortcut',
        icon: LaunchIcon,
        description: 'Link to websites, applications, or services'
    },
    {
        id: 'widget',
        label: 'Widget',
        icon: WidgetIcon,
        description: 'Interactive widgets with live data and monitoring'
    },
    {
        id: ITEM_TYPE.PLACEHOLDER,
        label: 'Placeholder',
        icon: PlaceholderIcon,
        description: 'Spacing elements for organization'
    },
    {
        id: ITEM_TYPE.PAGE,
        label: 'Page',
        icon: PageIcon,
        description: 'Add new pages within your dashboard'
    },
];
