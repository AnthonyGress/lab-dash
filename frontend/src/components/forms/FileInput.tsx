import { SxProps } from '@mui/material';
import { MuiFileInput } from 'mui-file-input';
import { Controller } from 'react-hook-form-mui';
import { FaFileUpload } from 'react-icons/fa';

import { theme } from '../../theme/theme';

type Props = {
    name: string;
    label?: string;
    accept?: string;
    width?: string;
    sx: SxProps
}

export const FileInput = ({ name, label, accept='image/png, image/jpeg, image/jpg, image/gif, image/webp', width, sx }: Props) => {
    return (
        <Controller
            name={name}
            // rules={{ required: 'This field is required' }}

            render={({ field, fieldState }) => (
                <MuiFileInput
                    value={field.value || null}
                    onChange={(file) => {
                        if (file instanceof File) {
                            field.onChange(file); // ✅ Ensures a `File` object is stored
                        }
                    }}
                    // inputProps={{ accept: '*' }}
                    label={label}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message || '5MB max'}
                    InputProps={{
                        inputProps: {
                            accept
                        },
                        startAdornment: <FaFileUpload style={{ marginLeft: 5, color: theme.palette.text.primary }}/>
                    }}
                    sx={{ width: width || '100%', ...sx }}
                    placeholder='Select a File'
                    fullWidth={!width}
                />
            )}
        />
    );
};
