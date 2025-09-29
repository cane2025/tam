export const debugLog = (component: string, data: unknown) => {
  if (import.meta.env.DEV) {
    console.log(`[${component}]`, data);
    // Cursor AI kan be dig köra detta och kopiera output
  }
};

