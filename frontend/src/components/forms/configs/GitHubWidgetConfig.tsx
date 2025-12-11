import { Grid2 as Grid } from '@mui/material';
import { useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxElement, SelectElement, TextFieldElement } from 'react-hook-form-mui';

import { useIsMobile } from '../../../hooks/useIsMobile';
import { COLORS } from '../../../theme/styles';
import { theme } from '../../../theme/theme';
import { FormValues } from '../AddEditForm/types';

const REFRESH_INTERVAL_OPTIONS = [
    { id: 1800000, label: '30 minutes' },
    { id: 3600000, label: '1 hour' },
    { id: 7200000, label: '2 hours' },
    { id: 14400000, label: '4 hours' }
];

interface GitHubWidgetConfigProps {
    formContext: UseFormReturn<FormValues>;
}

export const GitHubWidgetConfig = ({ formContext }: GitHubWidgetConfigProps) => {
    const isMobile = useIsMobile();

    // Initialize default values
    useEffect(() => {
        const currentRefreshInterval = formContext.getValues('githubRefreshInterval');
        const currentShowLabel = formContext.getValues('showLabel');
        const currentIncludeForks = formContext.getValues('githubIncludeForks');
        const currentIncludeArchived = formContext.getValues('githubIncludeArchived');

        if (!currentRefreshInterval) {
            formContext.setValue('githubRefreshInterval', 3600000);
        }
        if (currentShowLabel === undefined) {
            formContext.setValue('showLabel', true);
        }
        if (currentIncludeForks === undefined) {
            formContext.setValue('githubIncludeForks', false);
        }
        if (currentIncludeArchived === undefined) {
            formContext.setValue('githubIncludeArchived', false);
        }
    }, [formContext]);

    const inputStyling = {
        '& .MuiOutlinedInput-root': {
            '& fieldset': {
                borderColor: 'text.primary',
            },
            '&:hover fieldset': { borderColor: theme.palette.primary.main },
            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
        },
        width: '100%',
        minWidth: isMobile ? '65vw' : '20vw',
    };

    const selectStyling = {
        '& .MuiOutlinedInput-root': {
            '& fieldset': {
                borderColor: 'text.primary',
            },
            '.MuiSvgIcon-root ': {
                fill: theme.palette.text.primary,
            },
            '&:hover fieldset': { borderColor: theme.palette.primary.main },
            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, },
        },
        width: '100%',
        minWidth: isMobile ? '65vw' : '20vw',
        '& .MuiMenuItem-root:hover': {
            backgroundColor: `${COLORS.LIGHT_GRAY_HOVER} !important`,
        },
        '& .MuiMenuItem-root.Mui-selected': {
            backgroundColor: `${theme.palette.primary.main} !important`,
            color: 'white',
        },
        '& .MuiMenuItem-root.Mui-selected:hover': {
            backgroundColor: `${theme.palette.primary.main} !important`,
            color: 'white',
        }
    };

    return (
        <Grid container spacing={2} direction='column'>
            <Grid>
                <TextFieldElement
                    label='GitHub Token'
                    name='githubToken'
                    type='password'
                    required
                    fullWidth
                    helperText='Personal Access Token with repo scope. Create at github.com/settings/tokens'
                    sx={inputStyling}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } },
                        formHelperText: { style: { color: theme.palette.text.secondary } }
                    }}
                />
            </Grid>

            <Grid>
                <SelectElement
                    label='Refresh Interval'
                    name='githubRefreshInterval'
                    options={REFRESH_INTERVAL_OPTIONS}
                    required
                    fullWidth
                    sx={selectStyling}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } }
                    }}
                />
            </Grid>

            <Grid>
                <TextFieldElement
                    label='Display Name'
                    name='displayName'
                    fullWidth
                    helperText='Custom name for the widget header (optional)'
                    sx={inputStyling}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } },
                        formHelperText: { style: { color: theme.palette.text.secondary } }
                    }}
                />
            </Grid>

            <Grid>
                <TextFieldElement
                    label='Include Only Repos'
                    name='githubRepoFilter'
                    fullWidth
                    helperText='Comma-separated list of repo names to include (empty = all)'
                    sx={inputStyling}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } },
                        formHelperText: { style: { color: theme.palette.text.secondary } }
                    }}
                />
            </Grid>

            <Grid>
                <TextFieldElement
                    label='Exclude Repos'
                    name='githubExcludeRepos'
                    fullWidth
                    helperText='Comma-separated list of repo names to exclude'
                    sx={inputStyling}
                    slotProps={{
                        inputLabel: { style: { color: theme.palette.text.primary } },
                        formHelperText: { style: { color: theme.palette.text.secondary } }
                    }}
                />
            </Grid>

            <Grid>
                <CheckboxElement
                    label='Show Label'
                    name='showLabel'
                    sx={{
                        ml: 1,
                        color: 'white',
                        '& .MuiSvgIcon-root': { fontSize: 30 }
                    }}
                />
            </Grid>

            <Grid>
                <CheckboxElement
                    label='Include Forked Repos'
                    name='githubIncludeForks'
                    sx={{
                        ml: 1,
                        color: 'white',
                        '& .MuiSvgIcon-root': { fontSize: 30 }
                    }}
                />
            </Grid>

            <Grid>
                <CheckboxElement
                    label='Include Archived Repos'
                    name='githubIncludeArchived'
                    sx={{
                        ml: 1,
                        color: 'white',
                        '& .MuiSvgIcon-root': { fontSize: 30 }
                    }}
                />
            </Grid>
        </Grid>
    );
};
