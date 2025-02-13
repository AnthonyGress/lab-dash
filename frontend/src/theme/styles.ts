export enum COLORS {
    GRAY = '#2e2e2e',
    DARK_GRAY = '#242424',
    TRANSPARENT_GRAY = 'rgba(46,46,46, .7)',
    BORDER = '#424242'
}

export const styles = {
    vcenter: { display: 'flex', justifyContent: 'center', alignContent: 'center', flexDirection: 'column' },
    center: { display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
    widgetContainer: { backgroundColor: COLORS.TRANSPARENT_GRAY, borderRadius: '4px', border: `1px solid ${COLORS.BORDER}`, height: '14rem' },
    shortcutIcon: { width: '6rem' }
};
