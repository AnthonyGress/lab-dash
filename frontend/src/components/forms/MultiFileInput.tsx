import { SxProps } from '@mui/material';
import { MuiFileInput } from 'mui-file-input';
import { useState } from 'react';
import { Controller } from 'react-hook-form-mui';
import { FaFileUpload } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme/theme';

type Props = {
    name: string;
    label?: string;
    accept?: string;
    width?: string;
    maxSize?: number;
    maxFiles?: number;
    sx: SxProps
}

export const MultiFileInput = ({
    name,
    label,
    accept = 'image/png, image/jpeg, image/jpg, image/gif, image/webp, image/svg+xml',
    width,
    maxSize = 5 * 1024 * 1024, // 5MB default per file
    maxFiles = 20,
    sx

}: Props) => {
    const { t, i18n } = useTranslation();
    const [sizeError, setSizeError] = useState<string | null>(null);

    return (
        <Controller
            name={name}
            render={({ field, fieldState }) => (
                <MuiFileInput
                    value={field.value || null}
                    onChange={(files) => {
                        if (files) {
                            const fileArray = Array.isArray(files) ? files : [files];

                            // Check file count
                            if (fileArray.length > maxFiles) {
                                setSizeError(t('settings.appearance.tooManyFiles', { maxFiles }));
                                return;
                            }

                            // Check individual file sizes
                            const oversizedFiles = fileArray.filter(file => file.size > maxSize);
                            if (oversizedFiles.length > 0) {
                                setSizeError(t('settings.appearance.filesTooLarge', { maxMB: Math.round(maxSize / 1024 / 1024) } ));
                                return;
                            }

                            setSizeError(null);
                            field.onChange(fileArray);
                        } else {
                            setSizeError(null);
                            field.onChange(null);
                        }
                    }}
                    label={label}
                    error={!!fieldState.error || !!sizeError}
                    helperText={fieldState.error?.message || sizeError}
                    InputProps={{
                        inputProps: {
                            accept,
                            multiple: true
                        },
                        startAdornment: <FaFileUpload style={{ marginLeft: 5, color: theme.palette.text.primary }}/>
                    }}
                    sx={{ width: width || '100%', ...sx }}
                    placeholder={t('settings.appearance.selectFiles', { maxFiles })}
                    fullWidth={!width}
                    multiple
                />
            )}
        />
    );
};
