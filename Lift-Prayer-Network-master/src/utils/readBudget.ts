export const logFirestoreRead = (source: string, count: number) => {
  if (!__DEV__) return;
  console.log(`[ReadBudget] ${source}: ${count} docs read`);
};
