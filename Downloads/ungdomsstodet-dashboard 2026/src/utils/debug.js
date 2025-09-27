export const debugLog = (component, data) => {
    if (import.meta.env.DEV) {
        console.log(`[${component}]`, data);
        // Cursor AI kan be dig köra detta och kopiera output
    }
};
