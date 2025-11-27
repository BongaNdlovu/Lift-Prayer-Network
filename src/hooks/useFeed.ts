import { useEffect, useState } from 'react';
import {
  Unsubscribe,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  addDoc,
  updateDoc,
  doc,
  increment,
} from 'firebase/firestore';
import { db, firebaseEnabled } from '../services/firebase';
import type { FeedItem } from '../types';

type Mode = 'REQUEST' | 'TESTIMONY';

const LOCATIONS = [
  'SECTOR 07 (NY)',
  'NEO-TOKYO GRID',
  'OLD LONDON',
  'JOHANNESBURG OUTPOST',
  'DUBAI NODE',
  'MUMBAI NET',
  'BERLIN WALL 2',
  'SAO PAULO ZONE',
];
const URGENT_TOPICS = ['Supply Shortage', 'Sickness', 'Protection', 'Guidance', 'Grid Failure', 'Reunification'];
const NAMES = ['User_992', 'Kael', 'Sera_Phim', 'Unit_734', 'Watcher', 'Nomad', 'Echo_Five'];

const generateMockItem = (mode: Mode): FeedItem => {
  const base = {
    id: Math.random().toString(36).slice(2),
    ownerUid: 'mock',
    userDisplayName: NAMES[Math.floor(Math.random() * NAMES.length)],
    location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
    content:
      mode === 'REQUEST'
        ? `Requesting spiritual cover for ${
            URGENT_TOPICS[Math.floor(Math.random() * URGENT_TOPICS.length)]
          }. The shadows are lengthening here. We need light.`
        : 'The intervention arrived at dawn. Supplies secured. The blockade has lifted. Faith confirmed.',
    createdAt: new Date(),
  };
  if (mode === 'REQUEST') {
    return {
      ...base,
      type: 'REQUEST',
      severity: Math.random() > 0.7 ? 'CRITICAL' : 'HIGH',
      prayers: Math.floor(Math.random() * 50),
      status: 'ACTIVE',
    };
  }
  return {
    ...base,
    type: 'TESTIMONY',
    severity: 'RESOLVED',
    likes: Math.floor(Math.random() * 200),
  };
};

export const useFeed = (mode: Mode) => {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsub: Unsubscribe | null = null;

    if (!firebaseEnabled || !db) {
      setItems(Array.from({ length: 8 }).map(() => generateMockItem(mode)));
      setLoading(false);
      return undefined;
    }

    const col = collection(db, mode === 'REQUEST' ? 'requests' : 'testimonies');
    const q = query(col, orderBy('createdAt', 'desc'), limit(40));
    unsub = onSnapshot(
      q,
      (snapshot) => {
        const next = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            ...data,
            id: docSnap.id,
            type: mode,
          } as FeedItem;
        });
        setItems(next);
        setLoading(false);
      },
      (err) => {
        console.warn('Feed listener error', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub?.();
  }, [mode]);

  return { items, loading, error };
};

export const submitFeedItem = async (
  mode: Mode,
  content: string,
  ownerUid: string | undefined,
  displayName: string | undefined,
) => {
  if (!firebaseEnabled || !db) return;
  const col = collection(db, mode === 'REQUEST' ? 'requests' : 'testimonies');
  await addDoc(col, {
    ownerUid: ownerUid || 'anonymous',
    userDisplayName: displayName || 'Anonymous',
    content,
    location: 'LOCAL CONNECTION',
    severity: mode === 'REQUEST' ? 'PENDING' : 'RESOLVED',
    prayers: mode === 'REQUEST' ? 0 : undefined,
    likes: mode === 'TESTIMONY' ? 0 : undefined,
    status: mode === 'REQUEST' ? 'PENDING' : 'RESOLVED',
    createdAt: serverTimestamp(),
  });
};

export const incrementPrayerCount = async (requestId: string) => {
  if (!firebaseEnabled || !db) return;
  const ref = doc(db, 'requests', requestId);
  await updateDoc(ref, { prayers: increment(1) });
};
