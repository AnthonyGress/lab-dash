import { Add, Delete } from '@mui/icons-material';
import { Box, Button, Checkbox, FormControl, FormControlLabel, Grid2 as Grid, IconButton, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, SelectElement } from 'react-hook-form-mui';

import { DashApi } from '../../../api/dash-api';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { COLORS } from '../../../theme/styles';
import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm/types';

interface DiskInfo {
    fs: string;
    type: string;
    size: number;
    used: number;
    available: number;
    use: number;
    mount: string;
}

interface DiskSelection {
    mount: string;
    customName: string;
    showMountPath?: boolean;
}

interface DiskMonitorWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
    fieldNamePrefix?: string;
}

export const DiskMonitorWidgetConfig = ({ formContext, fieldNamePrefix = '' }: DiskMonitorWidgetConfigProps) => {
    const isMobile = useIsMobile();
    const [availableDisks, setAvailableDisks] = useState<Array<{id: string, label: string, size: number}>>([]);
    const [selectedDisks, setSelectedDisks] = useState<DiskSelection[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const selectStyling = {
        '& .MuiOutlinedInput-root': {
            '& fieldset': {
                borderColor: theme.palette.text.primary,
            },
            '.MuiSvgIcon-root ': {
                fill: theme.palette.text.primary,
            },
            '&:hover fieldset': { borderColor: 'primary.main' },
            '&.Mui-focused fieldset': { borderColor: 'primary.main', },
        },
        width: '100%',
        '& .MuiMenuItem-root:hover': {
            backgroundColor: `${COLORS.LIGHT_GRAY_HOVER} !important`,
        },
        '& .MuiMenuItem-root.Mui-selected': {
            backgroundColor: `${'primary.main'} !important`,
            color: 'white',
        },
        '& .MuiMenuItem-root.Mui-selected:hover': {
            backgroundColor: `${'primary.main'} !important`,
            color: 'white',
        }
    };

    // Helper function to get field name with prefix
    const getFieldName = (baseName: string) => {
        return fieldNamePrefix ? `${fieldNamePrefix}${baseName}` : baseName;
    };

    // Helper function to get display name for disk
    const getDiskDisplayName = (disk: DiskInfo): string => {
        const mount = disk.mount;
        const sizeGB = (disk.size / (1024 ** 3)).toFixed(1);

        // Special handling for common mount points
        if (mount === '/') return `Root (${sizeGB} GB)`;
        if (mount === '/home') return `Home (${sizeGB} GB)`;
        if (mount === '/var') return `Var (${sizeGB} GB)`;
        if (mount === '/tmp') return `Temp (${sizeGB} GB)`;
        if (mount === '/boot') return `Boot (${sizeGB} GB)`;
        if (mount.includes('/System/Volumes/Data')) return `System Data (${sizeGB} GB)`;
        if (mount.includes('/Volumes/')) {
            const volumeName = mount.split('/Volumes/')[1];
            return `${volumeName || 'Volume'} (${sizeGB} GB)`;
        }

        // Extract last part of mount path for display
        const parts = mount.split('/').filter(Boolean);
        const displayName = parts.length > 0 ? parts[parts.length - 1] : mount;
        return `${displayName} (${sizeGB} GB)`;
    };

    // Fetch available disks
    useEffect(() => {
        const fetchDisks = async () => {
            try {
                setIsLoading(true);
                const systemInfo = await DashApi.getSystemInformation();

                if (systemInfo?.disk && Array.isArray(systemInfo.disk)) {
                    // Filter out unwanted mounts
                    const validDisks = systemInfo.disk.filter((disk: DiskInfo) =>
                        disk.size > 0 &&
                        disk.mount !== '/dev' &&
                        disk.mount !== '/proc' &&
                        disk.mount !== '/sys' &&
                        !disk.mount.startsWith('/snap/')
                    );

                    // Sort disks by size (largest first) and then by mount path
                    const sortedDisks = validDisks.sort((a: DiskInfo, b: DiskInfo) => {
                        // Primary sort: Size (descending)
                        if (b.size !== a.size) {
                            return b.size - a.size;
                        }
                        // Secondary sort: Mount path (ascending)
                        return a.mount.localeCompare(b.mount);
                    });

                    const diskOptions = sortedDisks.map((disk: DiskInfo) => ({
                        id: disk.mount,
                        label: getDiskDisplayName(disk),
                        size: disk.size
                    }));

                    setAvailableDisks(diskOptions);
                } else {
                    setAvailableDisks([]);
                }
            } catch (error) {
                console.error('Error fetching disk information:', error);
                setAvailableDisks([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDisks();
    }, []);

    // Initialize from form values
    useEffect(() => {
        if (!isLoading) {
            const currentSelectedDisks = formContext.getValues(getFieldName('selectedDisks') as any);

            if (currentSelectedDisks && Array.isArray(currentSelectedDisks) && currentSelectedDisks.length > 0) {
                setSelectedDisks(currentSelectedDisks);
                updateFormValue(currentSelectedDisks); // Ensure validation is applied
            } else {
                // Default based on current layout - ensure at least 1 disk if available
                const currentLayout = formContext.getValues(getFieldName('layout') as any) || '2x2';
                const maxForLayout = getMaxDisksForLayout(currentLayout);
                const defaultCount = Math.max(1, Math.min(2, maxForLayout)); // Start with at least 1 disk, preferably 2

                const defaultDisks = availableDisks.slice(0, defaultCount).map(disk => ({
                    mount: disk.id,
                    customName: disk.label.split(' (')[0], // Remove size from default name
                    showMountPath: false
                }));

                // Only set disks if we have available disks
                if (defaultDisks.length > 0) {
                    setSelectedDisks(defaultDisks);
                    updateFormValue(defaultDisks);
                } else {
                    // No available disks - set empty and trigger validation error
                    setSelectedDisks([]);
                    updateFormValue([]);
                }
            }

            // Set default display options if not set
            const currentShowIcons = formContext.getValues(getFieldName('showIcons') as any);
            const currentShowName = formContext.getValues(getFieldName('showName') as any);
            const currentLayout = formContext.getValues(getFieldName('layout') as any);

            if (currentShowIcons === undefined) {
                formContext.setValue(getFieldName('showIcons') as any, true);
            }
            if (currentShowName === undefined) {
                formContext.setValue(getFieldName('showName') as any, true);
            }
            if (currentLayout === undefined) {
                formContext.setValue(getFieldName('layout') as any, '2x2');
            }
        }
    }, [isLoading, availableDisks, formContext, fieldNamePrefix]);

    // Watch for layout changes and adjust disk selection accordingly
    useEffect(() => {
        if (!fieldNamePrefix) { // Only for standalone widgets
            const layoutFieldName = getFieldName('layout');
            const subscription = formContext.watch((value, { name }) => {
                if (name === layoutFieldName) {
                    const newLayout = value[layoutFieldName as keyof typeof value] as string;
                    if (newLayout && typeof newLayout === 'string') {
                        const currentDisks = selectedDisks;
                        const newMaxDisks = getMaxDisksForLayout(newLayout);

                        // If we need to reduce the number of disks, trim from the end
                        if (currentDisks.length > newMaxDisks) {
                            const trimmedDisks = currentDisks.slice(0, newMaxDisks);
                            setSelectedDisks(trimmedDisks);
                            updateFormValue(trimmedDisks);
                        }
                    }
                }
            });
            return () => subscription.unsubscribe();
        }
    }, [formContext, fieldNamePrefix, selectedDisks]);

    // Helper function to get max disks for a specific layout
    const getMaxDisksForLayout = (layout: string) => {
        switch (layout) {
        case '2x2': return 4;
        case '2x4': return 8;
        case '1x5': return 5;
        default: return 4;
        }
    };

    // Update form value
    const updateFormValue = (disks: DiskSelection[]) => {
        formContext.setValue(getFieldName('selectedDisks') as any, disks);

        // Add validation - require at least one disk
        if (disks.length === 0) {
            formContext.setError(getFieldName('selectedDisks') as any, {
                type: 'required',
                message: 'At least one disk must be selected'
            });
        } else {
            formContext.clearErrors(getFieldName('selectedDisks') as any);
        }
    };

    // Get max disks based on layout
    const getMaxDisks = () => {
        // For dual widgets, always use 2x2 layout (4 disks max)
        if (fieldNamePrefix) {
            return 4;
        }

        const currentLayout = formContext.getValues(getFieldName('layout') as any) || '2x2';
        return getMaxDisksForLayout(currentLayout);
    };

    // Add a new disk selection
    const addDisk = () => {
        const maxDisks = getMaxDisks();
        if (selectedDisks.length < maxDisks) {
            // Find first available disk not already selected
            const usedMounts = selectedDisks.map(d => d.mount);
            const availableDisk = availableDisks.find(disk => !usedMounts.includes(disk.id));

            if (availableDisk) {
                const newDisks = [...selectedDisks, {
                    mount: availableDisk.id,
                    customName: availableDisk.label.split(' (')[0],
                    showMountPath: false
                }];
                setSelectedDisks(newDisks);
                updateFormValue(newDisks);
            }
        }
    };

    // Remove a disk selection
    const removeDisk = (index: number) => {
        const newDisks = selectedDisks.filter((_, i) => i !== index);
        setSelectedDisks(newDisks);
        updateFormValue(newDisks);
    };

    // Update disk selection
    const updateDisk = (index: number, field: 'mount' | 'customName' | 'showMountPath', value: string | boolean) => {
        const newDisks = [...selectedDisks];
        newDisks[index] = { ...newDisks[index], [field]: value };
        setSelectedDisks(newDisks);
        updateFormValue(newDisks);
    };

    // Get available disk options (excluding already selected ones)
    const getAvailableDiskOptions = (currentMount: string) => {
        const usedMounts = selectedDisks.map(d => d.mount).filter(mount => mount !== currentMount);
        return availableDisks.filter(disk => !usedMounts.includes(disk.id));
    };

    return (
        <>
            <Grid>
                <Typography variant='h6' sx={{ color: theme.palette.text.primary, mb: 2 }}>
                    Layout & Disk Selection
                </Typography>
            </Grid>

            {!fieldNamePrefix && (
                <Grid>
                    <SelectElement
                        label='Layout'
                        name={getFieldName('layout') as any}
                        options={[
                            { id: '2x2', label: '2x2 Grid' },
                            { id: '2x4', label: '2x4 Grid' },
                            { id: '1x5', label: '1x5 List' }
                        ]}
                        sx={{
                            ...selectStyling,
                            mb: 2
                        }}
                        slotProps={{
                            inputLabel: { style: { color: theme.palette.text.primary } }
                        }}
                    />
                </Grid>
            )}



            <Grid>
                <Box sx={{
                    border: `1px solid ${COLORS.BORDER}`,
                    borderRadius: 1,
                    p: 2,
                    mb: 2,
                    backgroundColor: 'rgba(255, 255, 255, 0.02)'
                }}>
                    {/* Error message for no disks selected */}
                    {selectedDisks.length === 0 && (
                        <Typography
                            variant='body2'
                            sx={{
                                color: 'error.main',
                                mb: 2,
                                fontStyle: 'italic',
                                textAlign: 'center'
                            }}
                        >
                            At least one disk must be selected
                        </Typography>
                    )}
                    {selectedDisks.map((disk, index) => (
                        <Box key={index} sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                            p: 1.5,
                            mb: index < selectedDisks.length - 1 ? 2 : 0,
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 1,
                            backgroundColor: 'rgba(255, 255, 255, 0.02)'
                        }}>
                            {/* Disk selection row */}
                            <Box sx={{ mb: 1 }}>
                                <FormControl fullWidth>
                                    <InputLabel
                                        sx={{ color: theme.palette.text.primary }}
                                    >
                                        {`Disk ${index + 1}`}
                                    </InputLabel>
                                    <Select
                                        value={disk.mount}
                                        onChange={(e) => updateDisk(index, 'mount', e.target.value)}
                                        label={`Disk ${index + 1}`}
                                        sx={{
                                            ...selectStyling,
                                            '& .MuiSelect-select': {
                                                color: theme.palette.text.primary
                                            },
                                            '& .MuiOutlinedInput-notchedOutline': {
                                                borderColor: theme.palette.text.primary
                                            },
                                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                                borderColor: 'primary.main'
                                            },
                                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                borderColor: 'primary.main'
                                            },
                                            '& .MuiSelect-icon': {
                                                color: theme.palette.text.primary
                                            }
                                        }}
                                    >
                                        {getAvailableDiskOptions(disk.mount).map((option) => (
                                            <MenuItem key={option.id} value={option.id}>
                                                {option.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>

                            {/* Custom name row */}
                            <Box sx={{ mb: 1 }}>
                                <TextField
                                    label='Custom Name'
                                    value={disk.customName}
                                    onChange={(e) => updateDisk(index, 'customName', e.target.value)}
                                    fullWidth
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': { borderColor: theme.palette.text.primary },
                                            '&:hover fieldset': { borderColor: 'primary.main' },
                                            '&.Mui-focused fieldset': { borderColor: 'primary.main' }
                                        }
                                    }}
                                    InputLabelProps={{
                                        style: { color: theme.palette.text.primary }
                                    }}
                                    inputProps={{
                                        style: { color: theme.palette.text.primary }
                                    }}
                                />
                            </Box>

                            {/* Mount path checkbox row */}
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={disk.showMountPath ?? false}
                                            onChange={(e) => updateDisk(index, 'showMountPath', e.target.checked)}
                                            sx={{
                                                color: theme.palette.text.primary,
                                                '&.Mui-checked': {
                                                    color: 'primary.main'
                                                }
                                            }}
                                        />
                                    }
                                    label='Show Mount Path'
                                    sx={{
                                        color: theme.palette.text.primary,
                                        '& .MuiFormControlLabel-label': {
                                            fontSize: '0.875rem'
                                        }
                                    }}
                                />
                            </Box>

                            {/* Remove button row */}
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    onClick={() => removeDisk(index)}
                                    sx={{
                                        minWidth: 'auto',
                                        px: 2,
                                        fontSize: '0.75rem'
                                    }}
                                    variant='contained'
                                    color='error'
                                    size='small'
                                    disabled={selectedDisks.length <= 1}
                                    fullWidth
                                >
                                    Remove
                                </Button>
                            </Box>
                        </Box>
                    ))}

                    {selectedDisks.length < getMaxDisks() && (
                        <Button
                            onClick={addDisk}
                            startIcon={<Add />}
                            sx={{
                                mt: selectedDisks.length > 0 ? 2 : 0
                            }}
                            variant='contained'
                            fullWidth
                            disabled={selectedDisks.length >= availableDisks.length}
                        >
                            Add Disk ({selectedDisks.length}/{getMaxDisks()})
                        </Button>
                    )}
                </Box>
            </Grid>
            <Box sx={{ width: '100%' }}>
                <CheckboxElement
                    label='Show Disk Icons'
                    name={getFieldName('showIcons') as any}
                    sx={{
                        ml: 1,
                        color: 'white',
                        '& .MuiSvgIcon-root': { fontSize: 30 }
                    }}
                />
            </Box>

            <Box sx={{ width: '100%' }}>
                <CheckboxElement
                    label='Show Name'
                    name={getFieldName('showName') as any}
                    sx={{
                        ml: 1,
                        color: 'white',
                        '& .MuiSvgIcon-root': { fontSize: 30 }
                    }}
                />
            </Box>

            {isLoading && (
                <Grid>
                    <Typography variant='body2' sx={{ color: theme.palette.text.primary, fontStyle: 'italic' }}>
                        Loading available disks...
                    </Typography>
                </Grid>
            )}

            {!isLoading && availableDisks.length === 0 && (
                <Grid>
                    <Typography variant='body2' sx={{ color: 'warning.main', fontStyle: 'italic' }}>
                        No disks available for monitoring
                    </Typography>
                </Grid>
            )}
        </>
    );
};
