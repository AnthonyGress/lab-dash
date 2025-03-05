import CloseIcon from '@mui/icons-material/Close';
import { Autocomplete, Box, InputAdornment, TextField } from '@mui/material';
import { nanoid } from 'nanoid';
import { Dispatch, SetStateAction } from 'react';
import { FaSearch } from 'react-icons/fa';

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
    // Called whenever user selects an option OR when freeSolo is used and user presses Enter
    const handleChange = (_event: any, newValue: SearchOption | string | null) => {
        if (!newValue) return;

        if (typeof newValue === 'string') {
            // This is a freeSolo string – the user typed something not in the list and pressed Enter
            window.open(`https://www.google.com/search?q=${encodeURIComponent(newValue)}`, '_blank');
        } else {
            // It's a SearchOption object
            if (newValue.url) {
                window.open(newValue.url, '_blank');
            }
        }

        // Optionally clear the search after selecting:
        setSearchValue('');
    };

    return (
        <Box mt={2} sx={styles.center}>
            <Autocomplete
                freeSolo
                value={null}
                clearIcon={<CloseIcon sx={{ color: 'text.primary' }} />}
                options={autocompleteOptions}
                getOptionLabel={(option) =>
                    typeof option === 'string' ? option : option.label
                }
                // (3) Control the text in the input
                inputValue={searchValue}
                onInputChange={(_event, newInputValue) => {
                    setSearchValue(newInputValue);
                }}
                // (4) Filter: if no matches, add a "Google Search" item
                filterOptions={(options, state) => {
                    // Basic local filter
                    const filtered = options.filter((option) =>
                        option.label.toLowerCase().includes(state.inputValue.toLowerCase())
                    );

                    if (filtered.length === 0 && state.inputValue.trim() !== '') {
                        return [
                            {
                                label: `Search Google for "${state.inputValue}"`,
                                url: `https://www.google.com/search?q=${encodeURIComponent(state.inputValue)}`,
                            },
                        ];
                    }

                    return filtered;
                }}
                // (5) Called when user selects from dropdown or uses freeSolo
                onChange={handleChange}
                renderOption={(props, option) => {
                    // If it's a string, just show it
                    if (typeof option === 'string') {
                        return (
                            <li {...props} key={nanoid()}>
                                {option}
                            </li>
                        );
                    }
                    // Otherwise, show icon + label
                    return (
                        <Box
                            component='li'
                            {...props}
                            key={nanoid()}
                            sx={{
                                '&:hover': {
                                    backgroundColor: `${COLORS.LIGHT_GRAY_HOVER} !important`,
                                },
                                height: '2rem'
                            }}
                        >
                            {option.icon && (
                                <img
                                    src={option.icon}
                                    alt=''
                                    style={{ width: 25, height: 25, marginRight: 10 }}
                                    key={nanoid()}
                                />
                            )}
                            {option.label}
                        </Box>
                    );
                }}
                // (6) Render the search input
                renderInput={(params) => (
                    <TextField
                        {...params}
                        placeholder={placeholder}
                        InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                                <InputAdornment position='start' sx={{ color: 'text.primary' }}>
                                    <FaSearch />
                                </InputAdornment>
                            ),
                            type: 'text',
                            sx: { height: '60%' },
                        }}
                        sx={{
                            width: { xs: '100%',
                                sm: '50%',
                                md: '50%',
                                lg: '32.8%',
                                xl: '32.8%'
                            },
                            height: '60px',
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: COLORS.TRANSPARENT_GRAY,
                                borderRadius: 2,
                                backdropFilter: 'blur(6px)',
                                // (Optional) Include the -webkit- prefix for Safari support:
                                WebkitBackdropFilter: 'blur(6px)',
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


                        }}
                    />
                )}
                sx={{ width: '100%', px: 2 }}
            />
        </Box>
    );
};
