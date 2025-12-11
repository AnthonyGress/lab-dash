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
    sx: SxProps
}

export const FileInput = ({
    name,
    label,
    accept='image/png, image/jpeg, image/jpg, image/gif, image/webp',
    width,
    maxSize = 5 * 1024 * 1024, // 5MB default
    sx
}: Props) => {
    const { t, i18n } = useTranslation();
    const [sizeError, setSizeError] = useState<string | null>(null);

    return (
        <Controller
            name={name}
            // rules={{ required: 'This field is required' }}

            render={({ field, fieldState }) => (
                <MuiFileInput
                    value={field.value || null}
                    onChange={(file) => {
                        if (file instanceof File) {
                            // Check file size
                            if (file.size > maxSize) {
                                setSizeError(t('settings.appearance.fileTooLarge', { maxMB: Math.round(maxSize / 1024 / 1024) } ));
                            } else {
                                setSizeError(null);
                                field.onChange(file);
                            }
                        } else {
                            setSizeError(null);
                            field.onChange(file);
                        }
                    }}
                    // inputProps={{ accept: '*' }}
                    label={label}
                    error={!!fieldState.error || !!sizeError}
                    helperText={fieldState.error?.message || sizeError}
                    InputProps={{
                        inputProps: {
                            accept
                        },
                        startAdornment: <FaFileUpload style={{ marginLeft: 5, color: theme.palette.text.primary }}/>
                    }}
                    sx={{ width: width || '100%', ...sx }}
                    placeholder={t('settings.appearance.selectFile')}
                    fullWidth={!width}
                />
            )}
        />
    );
};
