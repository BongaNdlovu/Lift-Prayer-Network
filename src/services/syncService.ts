import { 
  getPendingPrayers, 
  getPendingRequests,
  getPendingComments,
  getPendingReactions,
  setPendingPrayers,
  setPendingRequests,
  setPendingComments,
  setPendingReactions,
  type PendingPrayer,
  type PendingRequest,
  type PendingComment,
  type PendingReaction,
} from './offlineCache';
import { logPrayer, logReaction } from './prayers';
import { addComment } from './comments';
import { submitFeedItem } from '../hooks/useFeed';
import { db, firebaseEnabled } from './firebase';
import { getSafeErrorMessage } from '../types/errors';

export type SyncResult = {
  success: boolean;
  synced: {
    prayers: number;
    requests: number;
    comments: number;
    reactions: number;
  };
  failed: {
    prayers: number;
    requests: number;
    comments: number;
    reactions: number;
  };
  errors: string[];
};

/**
 * Sync all pending offline actions to the server
 */
export const syncPendingActions = async (userId: string): Promise<SyncResult> => {
  const result: SyncResult = {
    success: true,
    synced: { prayers: 0, requests: 0, comments: 0, reactions: 0 },
    failed: { prayers: 0, requests: 0, comments: 0, reactions: 0 },
    errors: [],
  };

  if (!firebaseEnabled || !db) {
    result.success = false;
    result.errors.push('Firebase not available');
    return result;
  }

  try {
    // Sync prayers
    const prayers = await getPendingPrayers();
    const remainingPrayers: PendingPrayer[] = [];
    
    for (const prayer of prayers) {
      if (prayer.actorUid !== userId) {
        remainingPrayers.push(prayer);
        continue;
      }
      
      try {
        await logPrayer(
          prayer.actorUid,
          prayer.requestId,
          prayer.targetOwnerUid,
          prayer.targetSummary,
          prayer.actorDisplayName
        );
        result.synced.prayers++;
      } catch (error) {
        console.error('[Sync] Failed to sync prayer:', getSafeErrorMessage(error));
        result.failed.prayers++;
        result.errors.push(`Prayer sync failed: ${getSafeErrorMessage(error)}`);
        remainingPrayers.push(prayer);
      }
    }
    await setPendingPrayers(remainingPrayers);

    // Sync requests
    const requests = await getPendingRequests();
    const remainingRequests: PendingRequest[] = [];
    
    for (const request of requests) {
      if (request.ownerUid !== userId) {
        remainingRequests.push(request);
        continue;
      }
      
      try {
        await submitFeedItem(
          'REQUEST',
          request.content,
          request.ownerUid,
          request.displayName,
          {
            isAnonymous: request.isAnonymous,
            category: request.category,
            isUrgent: request.isUrgent,
            visibility: request.isPrivate ? 'PRIVATE' : 'PUBLIC',
          }
        );
        result.synced.requests++;
      } catch (error) {
        console.error('[Sync] Failed to sync request:', getSafeErrorMessage(error));
        result.failed.requests++;
        result.errors.push(`Request sync failed: ${getSafeErrorMessage(error)}`);
        remainingRequests.push(request);
      }
    }
    await setPendingRequests(remainingRequests);

    // Sync comments
    const comments = await getPendingComments();
    const remainingComments: PendingComment[] = [];
    
    for (const comment of comments) {
      if (comment.authorUid !== userId) {
        remainingComments.push(comment);
        continue;
      }
      
      try {
        await addComment(
          comment.targetId,
          comment.targetType,
          comment.authorUid,
          comment.authorDisplayName,
          comment.content
        );
        result.synced.comments++;
      } catch (error) {
        console.error('[Sync] Failed to sync comment:', getSafeErrorMessage(error));
        result.failed.comments++;
        result.errors.push(`Comment sync failed: ${getSafeErrorMessage(error)}`);
        remainingComments.push(comment);
      }
    }
    await setPendingComments(remainingComments);

    // Sync reactions
    const reactions = await getPendingReactions();
    const remainingReactions: PendingReaction[] = [];
    
    for (const reaction of reactions) {
      if (reaction.actorUid !== userId) {
        remainingReactions.push(reaction);
        continue;
      }
      
      try {
        await logReaction(
          reaction.actorUid,
          reaction.targetId,
          reaction.targetType,
          reaction.reactionType as any
        );
        result.synced.reactions++;
      } catch (error) {
        console.error('[Sync] Failed to sync reaction:', getSafeErrorMessage(error));
        result.failed.reactions++;
        result.errors.push(`Reaction sync failed: ${getSafeErrorMessage(error)}`);
        remainingReactions.push(reaction);
      }
    }
    await setPendingReactions(remainingReactions);

    // Check if any failures occurred
    const totalFailed = result.failed.prayers + result.failed.requests + 
                        result.failed.comments + result.failed.reactions;
    result.success = totalFailed === 0;

    const totalSynced = result.synced.prayers + result.synced.requests + 
                        result.synced.comments + result.synced.reactions;
    
    if (totalSynced > 0) {
      console.log(`[Sync] Synced ${totalSynced} actions (${totalFailed} failed)`);
    }

    return result;
  } catch (error) {
    console.error('[Sync] Sync failed:', getSafeErrorMessage(error));
    result.success = false;
    result.errors.push(`Sync failed: ${getSafeErrorMessage(error)}`);
    return result;
  }
};

/**
 * Check if there are any pending actions to sync
 */
export const hasPendingActions = async (): Promise<boolean> => {
  const [prayers, requests, comments, reactions] = await Promise.all([
    getPendingPrayers(),
    getPendingRequests(),
    getPendingComments(),
    getPendingReactions(),
  ]);
  
  return prayers.length > 0 || requests.length > 0 || 
         comments.length > 0 || reactions.length > 0;
};
