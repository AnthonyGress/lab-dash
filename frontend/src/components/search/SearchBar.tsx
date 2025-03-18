import CloseIcon from '@mui/icons-material/Close';
import { Autocomplete, Box, InputAdornment, TextField, Typography } from '@mui/material';
import { nanoid } from 'nanoid';
import { Dispatch, SetStateAction } from 'react';
import { FaSearch } from 'react-icons/fa';

import { useAppContext } from '../../context/useAppContext';
import { COLORS, styles } from '../../theme/styles';

export type SearchOption = {
  label: string;
  icon?: string;
  url?: string;
};

type Props = {
  placeholder?: string;
  searchValue: string;
  setSearchValue: Dispatch<SetStateAction<string>>;
  autocompleteOptions?: SearchOption[];
};

export const SearchBar = ({
    placeholder,
    searchValue,
    setSearchValue,
    autocompleteOptions = []
}: Props) => {
    const { config } = useAppContext();

    // Default to Google if no search provider is configured
    const searchProvider = config?.searchProvider || { name: 'Google', url: 'https://www.google.com/search?q={query}' };

    const getSearchUrl = (query: string) => {
        if (!query.trim()) return '';
        return searchProvider.url.replace('{query}', encodeURIComponent(query));
    };

    const handleChange = (_event: any, newValue: SearchOption | string | null) => {
        if (!newValue) return;

        if (typeof newValue === 'string') {
            window.open(getSearchUrl(newValue), '_blank');
        } else {
            if (newValue.url) {
                window.open(newValue.url, '_blank');
            }
        }

        setSearchValue('');
    };

    return (
        <Box sx={styles.center}>
            <Autocomplete
                freeSolo
                value={null}
                clearIcon={<CloseIcon sx={{ color: 'text.primary' }} />}
                options={autocompleteOptions}
                getOptionLabel={(option) =>
                    typeof option === 'string' ? option : option.label
                }
                inputValue={searchValue}
                onInputChange={(_event, newInputValue) => {
                    setSearchValue(newInputValue);
                }}
                filterOptions={(options, state) => {
                    const filtered = options.filter((option) =>
                        option.label.toLowerCase().includes(state.inputValue.toLowerCase())
                    );

                    if (filtered.length === 0 && state.inputValue.trim() !== '') {
                        return [
                            {
                                label: `Search ${searchProvider.name} for "${state.inputValue}"`,
                                url: getSearchUrl(state.inputValue),
                            },
                        ];
                    }

                    return filtered;
                }}
                onChange={handleChange}
                renderOption={(props, option) => {
                    if (typeof option === 'string') {
                        return (
                            <li {...props} key={nanoid()}>
                                {option}
                            </li>
                        );
                    }
                    return (
                        <Box
                            component='li'
                            {...props}
                            key={nanoid()}
                            sx={{
                                '&:hover': {
                                    backgroundColor: `${COLORS.LIGHT_GRAY_HOVER} !important`,
                                }
                            }}
                        >
                            {option.icon && (
                                <img
                                    src={option.icon}
                                    alt=''
                                    style={{ width: 30, height: 30, marginRight: 14 }}
                                    key={nanoid()}
                                />
                            )}
                            <Typography key={nanoid()} fontSize={18}>{option.label}</Typography>
                        </Box>
                    );
                }}
                renderInput={(params) => (
                    <Box sx={{ width: '100%', ...styles.center }}>
                        <TextField
                            {...params}
                            placeholder={placeholder || `Search with ${searchProvider.name}`}
                            InputProps={{
                                ...params.InputProps,
                                startAdornment: (
                                    <InputAdornment position='start' sx={{ color: 'text.primary' }}>
                                        <FaSearch />
                                    </InputAdornment>
                                ),
                                type: 'text',
                                sx: { height: '70%' },
                            }}
                            sx={{
                                width: { xs: '100%',
                                    sm: '50%',
                                    md: '70%',
                                    lg: '55%',
                                    xl: '40%'
                                },
                                height: '60px',
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: { xs: COLORS.TRANSPARENT_GRAY, md: 'transparent' },
                                    borderRadius: 2,
                                    backdropFilter: { xs: 'blur(6px)', md: 'none' },
                                    // (Optional) Include the -webkit- prefix for Safari support:
                                    WebkitBackdropFilter: { xs: 'blur(6px)', md: 'none' },
                                },
                                '& .MuiOutlinedInput-notchedOutline': {
                                    border: `1px solid ${COLORS.BORDER} !important`,
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    border: `1px solid ${COLORS.BORDER}  !important`,
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    border: `1px solid ${COLORS.BORDER}  !important`,
                                },
                                borderRadius: 2,
                                display: 'flex',
                                justifyContent: 'center',
                            }}
                        />
                    </Box>
                )}
                sx={{ width: '100%', px: 2 }}
                slotProps={{
                    listbox: {
                        sx: {
                            '& .MuiAutocomplete-option': {
                                minHeight: 'unset',
                                lineHeight: '1.5',
                                height: {
                                    xs: '3rem'
                                }
                            },
                        },
                    },

                }}
            />
        </Box>
    );
};
