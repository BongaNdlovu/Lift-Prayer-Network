const DEFAULT_READ_BUDGET = 50;

const READ_BUDGETS: Record<string, number> = {
  notifications_inbox: 50,
  answered_prayers: 50,
  search_requests: 40,
  search_testimonies: 40,
  my_prayers_requests: 50,
  my_prayers_testimonies: 50,
  'prayerPromises.getTodayPrayerPromises': 50,
  'prayerPromises.getPrayerPromisesPage': 25,
};

export const logFirestoreRead = (source: string, count: number, budget = READ_BUDGETS[source] ?? DEFAULT_READ_BUDGET) => {
  if (!__DEV__) return;
  console.log(`[ReadBudget] ${source}: ${count} docs read`);
  if (count > budget) {
    console.warn(`[ReadBudget] ${source} exceeded budget: ${count}/${budget} docs read`);
  }
};
