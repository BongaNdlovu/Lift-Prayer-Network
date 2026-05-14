import {
  getPendingPrayers,
  getPendingRequests,
  getPendingComments,
  getPendingReactions,
  getPendingPrayerPromises,
} from './offlineCache';
export { syncPendingActions, type SyncResult } from './offlineSync';

export const hasPendingActions = async (): Promise<boolean> => {
  const [prayers, requests, comments, reactions, promises] = await Promise.all([
    getPendingPrayers(),
    getPendingRequests(),
    getPendingComments(),
    getPendingReactions(),
    getPendingPrayerPromises(),
  ]);

  return prayers.length > 0 || requests.length > 0 || comments.length > 0 || reactions.length > 0 || promises.length > 0;
};
