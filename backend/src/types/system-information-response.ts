import { Systeminformation } from 'systeminformation';

export type SysteminformationResponse = {
 cpu: {
    currentLoad: number;
    main?: number | undefined;
    cores: number | number[];
    max?: number | undefined;
    socket: string | number[];
    chipset?: number;
    manufacturer: string;
    brand: string;
    vendor: string;
    family: string;
     model: string;
     stepping: string;
     revision: string;
     voltage: string;
     speed: number;
     speedMin: number;
     speedMax: number;
     governor: string;
     physicalCores: number;
     efficiencyCores?: number;
     performanceCores?: number;
     processors: number;
     flags: string;
     virtualization: boolean;
     cache: Systeminformation.CpuCacheData;
    } | null;

 system: {
    current?: number | undefined;
    uptime?: number | undefined;
    timezone?: string | undefined;
    timezoneName?: string | undefined;
    platform: string;
    distro: string;
    release: string;
    codename: string;
    kernel: string;
    arch: string;
    hostname: string;
    fqdn: string;
    codepage: string;
    logofile: string;
    serial: string;
    build: string;
    servicepack: string;
    uefi: boolean | null;
    hypervizor?: boolean;
    remoteSession?: boolean;
    } | null;

 memory: Systeminformation.MemData | null;
 disk: Systeminformation.FsSizeData[] | null;
 network: {
    rx_sec: number;
    tx_sec: number;
    iface: string;
    operstate: string;
    speed?: number;
 } | null;
 networkInterfaces?: Array<{
    iface: string;
    operstate: string;
    speed: number;
    rx_bytes: number;
    tx_bytes: number;
    rx_sec: number;
    tx_sec: number;
 }>;
}

