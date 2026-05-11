/**
 * Study Guides Service
 * Sabbath School-style quarterly Bible study guides with lessons
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDoc,
  getDocs,
  where,
} from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';

// ============================================================================
// Types
// ============================================================================

export interface Lesson {
  id: string;
  guideId: string;
  number: number;
  title: string;
  date: string;              // "Sep 27 - Oct 03"
  heroImage?: string;
  memoryText: string;
  memoryRef: string;         // "Joshua 1:7"
  readings: string;          // "Deut. 18:15-22; Joshua 1"
  content: string;           // Main lesson content
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface StudyGuide {
  id: string;
  title: string;             // "Lessons of Faith from Joshua"
  subtitle: string;          // "Adult Bible Study Guide"
  author: string;            // "Standard Adult"
  authorAvatar?: string;
  dateRange: string;         // "Oct • Nov • Dec 2025"
  quarter: string;           // "Q4-2025"
  year: number;
  coverImage: string;
  description: string;
  lessonCount: number;
  isActive: boolean;         // Currently active quarter
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserProgress {
  odId: string;
  lessonId: string;
  completed: boolean;
  completedAt?: Timestamp;
  bookmarked: boolean;
  notes?: string;
}

export interface UserStats {
  currentStreak: number;
  longestStreak: number;
  lessonsCompleted: number;
  guidesCompleted: number;
  lastStudyDate?: Timestamp;
  savedLessons: string[];    // Lesson IDs
}

export type StudyGuideInput = {
  title: string;
  subtitle: string;
  author: string;
  authorAvatar?: string;
  dateRange: string;
  quarter: string;
  year: number;
  coverImage: string;
  description: string;
  isActive?: boolean;
};

export type LessonInput = {
  number: number;
  title: string;
  date: string;
  heroImage?: string;
  memoryText: string;
  memoryRef: string;
  readings: string;
  content: string;
};

// ============================================================================
// Mock Data (for development/demo)
// ============================================================================

export const MOCK_STUDY_GUIDES: StudyGuide[] = [
  {
    id: 'joshua-2025-q4',
    title: 'Lessons of Faith from Joshua',
    subtitle: 'Adult Bible Study Guide',
    author: 'Standard Adult',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    dateRange: 'Oct • Nov • Dec 2025',
    quarter: 'Q4-2025',
    year: 2025,
    coverImage: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=800',
    description: 'The book of Joshua marks the transition from the leadership of Moses to that of Joshua. It begins with the story of the Israelites entering the Promised Land, conquering it, and dividing it among the tribes.',
    lessonCount: 13,
    isActive: true,
    createdAt: Timestamp.now(),
  },
  {
    id: 'exodus-2025-q3',
    title: 'Exodus: The Deliverance',
    subtitle: 'Adult Bible Study Guide',
    author: 'Standard Adult',
    authorAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200',
    dateRange: 'Jul • Aug • Sep 2025',
    quarter: 'Q3-2025',
    year: 2025,
    coverImage: 'https://images.unsplash.com/photo-1504198266287-1659872e6590?auto=format&fit=crop&q=80&w=800',
    description: 'A deep dive into the deliverance of Israel, exploring the themes of redemption, law, and the tabernacle in the wilderness.',
    lessonCount: 13,
    isActive: false,
    createdAt: Timestamp.now(),
  },
  {
    id: 'psalms-2025-q2',
    title: 'Songs of the Heart',
    subtitle: 'Adult Bible Study Guide',
    author: 'Standard Adult',
    authorAvatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&q=80&w=200',
    dateRange: 'Apr • May • Jun 2025',
    quarter: 'Q2-2025',
    year: 2025,
    coverImage: 'https://images.unsplash.com/photo-1455582916367-25f75bfc6710?auto=format&fit=crop&q=80&w=800',
    description: 'The Psalms speak to every human emotion and experience. This quarter we explore how these ancient songs can guide our worship and prayer life today.',
    lessonCount: 13,
    isActive: false,
    createdAt: Timestamp.now(),
  },
];

export const MOCK_LESSONS: Record<string, Lesson[]> = {
  'joshua-2025-q4': [
    {
      id: 'joshua-01',
      guideId: 'joshua-2025-q4',
      number: 1,
      title: 'Recipe for Success',
      date: 'Sep 27 - Oct 03',
      heroImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=800',
      memoryText: 'Only be strong and very courageous, that you may observe to do according to all the law which Moses My servant commanded you; do not turn from it to the right hand or to the left, that you may prosper wherever you go.',
      memoryRef: 'Joshua 1:7',
      readings: 'Deut. 18:15-22; Joshua 1; Heb. 6:17, 18',
      content: `Benjamin Zander, musical director of the Boston Philharmonic Orchestra, taught a music interpretation class. He observed the students' anxiety as they faced the evaluation of their performance.

In order to put the students at ease and to open them up to their full potential, he announced on the first day of the class that everybody would get an "A." This "A" was not an expectation to live up to "but a possibility to live into."

The book of Joshua is about new possibilities. Moses, who had dominated 40 years of Israel's history, belonged in the past. The Exodus from Egypt and the wanderings in the wilderness, tragically marked by rebellion and stubbornness, had ended.

Now, a new generation stood on the borders of the Promised Land, ready to claim their inheritance. But they needed a leader who could inspire them to trust in God's promises.

God's command to Joshua was clear: "Be strong and courageous." This wasn't mere motivational speaking—it was a divine imperative backed by divine presence. The success of Israel's mission depended not on military might or strategic brilliance, but on faithful obedience to God's Word.

The recipe for success that God gave Joshua remains relevant today: meditate on Scripture day and night, observe to do all that is written, and trust that God goes with you wherever you go.`,
      createdAt: Timestamp.now(),
    },
    {
      id: 'joshua-02',
      guideId: 'joshua-2025-q4',
      number: 2,
      title: 'Surprised by Grace',
      date: 'Oct 04 - Oct 10',
      heroImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=800',
      memoryText: 'By faith the harlot Rahab did not perish with those who did not believe, when she had received the spies with peace.',
      memoryRef: 'Hebrews 11:31',
      readings: 'Joshua 2; Heb. 11:31; James 2:25',
      content: `The story of Rahab is one of the most surprising narratives in Scripture. Here was a woman whose profession and nationality should have placed her firmly among Israel's enemies. Yet she became an ancestor of Jesus Christ.

When the two Israelite spies entered Jericho, they found refuge in an unlikely place—the house of Rahab. Her confession of faith is remarkable: "The LORD your God, He is God in heaven above and on earth beneath."

This Canaanite woman had heard of Israel's God and His mighty acts. The parting of the Red Sea, the defeat of the Amorite kings—these stories had reached her ears and transformed her heart. While her fellow citizens trembled in fear, Rahab chose faith.

Her request was simple yet profound: "Show kindness to my family, as I have shown kindness to you." The scarlet cord she hung from her window became a symbol of salvation—a foreshadowing of the blood of Christ that would one day save all who believe.

Grace often surprises us. It reaches into the most unexpected places and transforms the most unlikely people. Rahab's story reminds us that no one is beyond the reach of God's redeeming love.`,
      createdAt: Timestamp.now(),
    },
    {
      id: 'joshua-03',
      guideId: 'joshua-2025-q4',
      number: 3,
      title: 'Memorials of Grace',
      date: 'Oct 11 - Oct 17',
      heroImage: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&q=80&w=800',
      memoryText: 'That this may be a sign among you when your children ask in time to come, saying, "What do these stones mean to you?"',
      memoryRef: 'Joshua 4:6',
      readings: 'Joshua 3-4; Psalm 66:5-7; 1 Peter 2:4-5',
      content: `The Jordan River crossing was Israel's second great water miracle. Like their parents at the Red Sea, this new generation witnessed God's power over nature as the waters stood in a heap while they crossed on dry ground.

But God didn't want this moment to be forgotten. He commanded Joshua to have twelve men—one from each tribe—take stones from the middle of the Jordan and set them up as a memorial at Gilgal.

These weren't ordinary stones. They were testimonies in rock, permanent reminders of God's faithfulness. When future generations would ask, "What do these stones mean?" parents could tell the story of God's mighty deliverance.

We all need memorials of grace—tangible reminders of how God has worked in our lives. Perhaps it's a journal entry, a photograph, or a special place that marks a moment when God's presence was unmistakably real.

The stones at Gilgal served another purpose: they marked the end of the wilderness wandering and the beginning of a new chapter. Sometimes we need to look back at what God has done to find courage for what lies ahead.

What are the memorial stones in your life? What stories of God's faithfulness can you share with the next generation?`,
      createdAt: Timestamp.now(),
    },
    {
      id: 'joshua-04',
      guideId: 'joshua-2025-q4',
      number: 4,
      title: 'The Fall of Jericho',
      date: 'Oct 18 - Oct 24',
      heroImage: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&q=80&w=800',
      memoryText: 'By faith the walls of Jericho fell down after they were encircled for seven days.',
      memoryRef: 'Hebrews 11:30',
      readings: 'Joshua 5:13-6:27; 2 Cor. 10:3-5',
      content: `Jericho was a fortress city, its walls seemingly impenetrable. From a military standpoint, Israel's army of former slaves had no chance against such fortifications. But God's battle plans rarely make sense to human wisdom.

March around the city once a day for six days. On the seventh day, march seven times, then shout. These were not the instructions of a military strategist—they were the commands of the Commander of the Lord's army.

The strategy required faith, patience, and obedience. For six days, the Israelites marched in silence while Jericho's defenders watched and waited. What must they have thought? Perhaps they mocked. Perhaps they grew complacent.

Then came the seventh day. Seven circuits. The blast of trumpets. The great shout. And the walls came tumbling down—not by siege engines or battering rams, but by the power of God responding to the faith of His people.

The fall of Jericho teaches us that our battles are ultimately spiritual. The weapons of our warfare are not carnal but mighty through God. Sometimes victory comes not through our strength but through our surrender to God's unconventional methods.

What walls in your life need to come down? Are you willing to trust God's methods, even when they don't make sense?`,
      createdAt: Timestamp.now(),
    },
    {
      id: 'joshua-05',
      guideId: 'joshua-2025-q4',
      number: 5,
      title: 'The Sin of Achan',
      date: 'Oct 25 - Oct 31',
      heroImage: 'https://images.unsplash.com/photo-1509909756405-be0199881695?auto=format&fit=crop&q=80&w=800',
      memoryText: 'Israel has sinned, and they have also transgressed My covenant which I commanded them.',
      memoryRef: 'Joshua 7:11',
      readings: 'Joshua 7; 1 John 2:15-17; James 1:13-15',
      content: `After the miraculous victory at Jericho, Israel faced a stunning defeat at the small city of Ai. Thirty-six men died, and the army fled in terror. What had gone wrong?

The answer lay hidden in Achan's tent: a beautiful Babylonian garment, two hundred shekels of silver, and a wedge of gold. Despite God's clear command that all the spoils of Jericho were devoted to destruction, Achan had coveted, taken, and concealed.

"I saw... I coveted... I took." These three steps trace the anatomy of sin. It begins with the eyes, moves to the heart, and ends in action. Achan's private sin had public consequences—the entire nation suffered because of one man's disobedience.

The story is sobering. Sin cannot be hidden from God. What we do in secret affects the community of faith. And the consequences of disobedience can be devastating.

But there's also grace in this dark chapter. God didn't abandon Israel. He revealed the problem and provided a path to restoration. The valley of Achor (trouble) would one day become a door of hope (Hosea 2:15).

Are there hidden things in your life that need to be brought into the light? God's discipline is always aimed at restoration, not destruction.`,
      createdAt: Timestamp.now(),
    },
  ],
  'exodus-2025-q3': [
    {
      id: 'exodus-01',
      guideId: 'exodus-2025-q3',
      number: 1,
      title: 'A Cry from Egypt',
      date: 'Jun 28 - Jul 04',
      heroImage: 'https://images.unsplash.com/photo-1539650116574-8efeb43e2750?auto=format&fit=crop&q=80&w=800',
      memoryText: 'So God heard their groaning, and God remembered His covenant with Abraham, with Isaac, and with Jacob.',
      memoryRef: 'Exodus 2:24',
      readings: 'Exodus 1-2; Acts 7:17-36',
      content: `Four hundred years of silence. Since Joseph's death, no prophet had spoken, no miracle had occurred. The descendants of Abraham had multiplied into a great nation, but they had also become slaves in a foreign land.

The book of Exodus opens with a new king who "did not know Joseph." This Pharaoh saw Israel not as honored guests but as a threat. His solution was brutal: forced labor, oppression, and eventually, genocide—the murder of every Hebrew baby boy.

Into this darkness, Moses was born. Hidden for three months, placed in a basket on the Nile, discovered by Pharaoh's daughter—his survival was a series of divine interventions. Raised in the palace, educated in all the wisdom of Egypt, Moses seemed destined for greatness.

But God's timing is rarely our timing. Moses' attempt to deliver his people through human effort ended in failure and forty years of exile. It was in the wilderness, tending sheep, that God finally appeared in the burning bush.

The cry of the oppressed had reached heaven. God had heard, God remembered, and God was about to act. The greatest deliverance in Old Testament history was about to begin.`,
      createdAt: Timestamp.now(),
    },
  ],
  'psalms-2025-q2': [
    {
      id: 'psalms-01',
      guideId: 'psalms-2025-q2',
      number: 1,
      title: 'The Way of the Righteous',
      date: 'Mar 29 - Apr 04',
      heroImage: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&q=80&w=800',
      memoryText: 'Blessed is the man who walks not in the counsel of the ungodly, nor stands in the path of sinners, nor sits in the seat of the scornful.',
      memoryRef: 'Psalm 1:1',
      readings: 'Psalm 1; Jeremiah 17:5-8; Matthew 7:24-27',
      content: `The Psalter opens not with a prayer or a song, but with a wisdom teaching. Psalm 1 sets the stage for everything that follows by presenting two ways of life: the way of the righteous and the way of the wicked.

The blessed person is described in both negative and positive terms. Negatively, they avoid the progressive descent into sin—walking, standing, sitting with those who reject God. Positively, they delight in God's law and meditate on it constantly.

The image of a tree planted by streams of water is powerful. Such a tree doesn't struggle for survival; it flourishes naturally because its roots reach the source of life. Its leaves don't wither in drought; its fruit comes in season.

In contrast, the wicked are like chaff—the worthless husks that blow away when the wheat is winnowed. They have no stability, no substance, no future.

This psalm invites us to examine our influences and our priorities. What voices are we listening to? What occupies our thoughts? Are we rooted in God's Word, or are we being blown about by every wind of culture and opinion?

The choice between these two ways is presented starkly because the consequences are eternal. The Lord knows the way of the righteous, but the way of the wicked will perish.`,
      createdAt: Timestamp.now(),
    },
  ],
};

export const MOCK_USER_STATS: UserStats = {
  currentStreak: 12,
  longestStreak: 45,
  lessonsCompleted: 8,
  guidesCompleted: 2,
  savedLessons: ['joshua-01', 'joshua-03'],
};

// ============================================================================
// Firebase Functions
// ============================================================================

/**
 * Subscribe to all study guides
 */
export const subscribeToStudyGuides = (
  callback: (guides: StudyGuide[]) => void,
  activeOnly: boolean = false
): (() => void) => {
  if (!firebaseEnabled || !db) {
    // Return mock data for development
    const filtered = activeOnly 
      ? MOCK_STUDY_GUIDES.filter(g => g.isActive)
      : MOCK_STUDY_GUIDES;
    callback(filtered);
    return () => {};
  }

  let q = query(
    collection(db, 'studyGuides'),
    orderBy('year', 'desc'),
    orderBy('quarter', 'desc')
  );

  if (activeOnly) {
    q = query(
      collection(db, 'studyGuides'),
      where('isActive', '==', true),
      orderBy('year', 'desc')
    );
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const guides: StudyGuide[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as StudyGuide[];
      callback(guides.length > 0 ? guides : MOCK_STUDY_GUIDES);
    },
    (error) => {
      console.error('Error subscribing to study guides:', error);
      callback(MOCK_STUDY_GUIDES);
    }
  );
};

/**
 * Get a single study guide by ID
 */
export const getStudyGuide = async (guideId: string): Promise<StudyGuide | null> => {
  // Check mock data first
  const mockGuide = MOCK_STUDY_GUIDES.find(g => g.id === guideId);
  
  if (!firebaseEnabled || !db) {
    return mockGuide || null;
  }

  try {
    const docRef = doc(db, 'studyGuides', guideId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as StudyGuide;
    }
    return mockGuide || null;
  } catch (err) {
    console.error('Error getting study guide:', err);
    return mockGuide || null;
  }
};

/**
 * Subscribe to lessons for a specific study guide
 */
export const subscribeToLessons = (
  guideId: string,
  callback: (lessons: Lesson[]) => void
): (() => void) => {
  // Check mock data
  const mockLessons = MOCK_LESSONS[guideId] || [];

  if (!firebaseEnabled || !db) {
    callback(mockLessons);
    return () => {};
  }

  const q = query(
    collection(db, 'studyGuides', guideId, 'lessons'),
    orderBy('number', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const lessons: Lesson[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Lesson[];
      callback(lessons.length > 0 ? lessons : mockLessons);
    },
    (error) => {
      console.error('Error subscribing to lessons:', error);
      callback(mockLessons);
    }
  );
};

/**
 * Get a single lesson by ID
 */
export const getLesson = async (guideId: string, lessonId: string): Promise<Lesson | null> => {
  // Check mock data first
  const mockLessons = MOCK_LESSONS[guideId] || [];
  const mockLesson = mockLessons.find(l => l.id === lessonId);

  if (!firebaseEnabled || !db) {
    return mockLesson || null;
  }

  try {
    const docRef = doc(db, 'studyGuides', guideId, 'lessons', lessonId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Lesson;
    }
    return mockLesson || null;
  } catch (err) {
    console.error('Error getting lesson:', err);
    return mockLesson || null;
  }
};

/**
 * Get user study stats
 */
export const getUserStats = async (userId: string): Promise<UserStats> => {
  if (!firebaseEnabled || !db) {
    return MOCK_USER_STATS;
  }

  try {
    const docRef = doc(db, 'userStudyStats', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserStats;
    }
    return MOCK_USER_STATS;
  } catch (err) {
    console.error('Error getting user stats:', err);
    return MOCK_USER_STATS;
  }
};

/**
 * Update user progress for a lesson
 */
export const updateLessonProgress = async (
  userId: string,
  guideId: string,
  lessonId: string,
  completed: boolean
): Promise<{ success: boolean; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: true }; // Mock success
  }

  try {
    const progressRef = doc(db, 'userProgress', userId, 'lessons', lessonId);
    await updateDoc(progressRef, {
      guideId,
      lessonId,
      completed,
      completedAt: completed ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (err) {
    console.error('Error updating lesson progress:', err);
    return { success: false, error: 'Could not update progress' };
  }
};

/**
 * Toggle bookmark for a lesson
 */
export const toggleLessonBookmark = async (
  userId: string,
  lessonId: string,
  bookmarked: boolean
): Promise<{ success: boolean; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: true }; // Mock success
  }

  try {
    const statsRef = doc(db, 'userStudyStats', userId);
    const snap = await getDoc(statsRef);
    
    if (snap.exists()) {
      const currentSaved = snap.data().savedLessons || [];
      const newSaved = bookmarked
        ? [...currentSaved, lessonId]
        : currentSaved.filter((id: string) => id !== lessonId);
      
      await updateDoc(statsRef, {
        savedLessons: newSaved,
        updatedAt: serverTimestamp(),
      });
    }
    return { success: true };
  } catch (err) {
    console.error('Error toggling bookmark:', err);
    return { success: false, error: 'Could not update bookmark' };
  }
};

// ============================================================================
// Admin Functions (for creating/editing guides and lessons)
// ============================================================================

/**
 * Create a new study guide (admin only)
 */
export const createStudyGuide = async (
  input: StudyGuideInput
): Promise<{ success: boolean; id?: string; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    const docRef = await addDoc(collection(db, 'studyGuides'), {
      ...input,
      lessonCount: 0,
      isActive: input.isActive ?? false,
      createdAt: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  } catch (err) {
    console.error('Error creating study guide:', err);
    return { success: false, error: 'Could not create study guide' };
  }
};

/**
 * Create a new lesson (admin only)
 */
export const createLesson = async (
  guideId: string,
  input: LessonInput
): Promise<{ success: boolean; id?: string; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    const docRef = await addDoc(collection(db, 'studyGuides', guideId, 'lessons'), {
      ...input,
      guideId,
      createdAt: serverTimestamp(),
    });

    // Update lesson count on guide
    const guideRef = doc(db, 'studyGuides', guideId);
    const guideSnap = await getDoc(guideRef);
    if (guideSnap.exists()) {
      await updateDoc(guideRef, {
        lessonCount: (guideSnap.data().lessonCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    }

    return { success: true, id: docRef.id };
  } catch (err) {
    console.error('Error creating lesson:', err);
    return { success: false, error: 'Could not create lesson' };
  }
};

/**
 * Update a study guide (admin only)
 */
export const updateStudyGuide = async (
  guideId: string,
  updates: Partial<StudyGuideInput>
): Promise<{ success: boolean; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    const docRef = doc(db, 'studyGuides', guideId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (err) {
    console.error('Error updating study guide:', err);
    return { success: false, error: 'Could not update study guide' };
  }
};

/**
 * Update a lesson (admin only)
 */
export const updateLesson = async (
  guideId: string,
  lessonId: string,
  updates: Partial<LessonInput>
): Promise<{ success: boolean; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    const docRef = doc(db, 'studyGuides', guideId, 'lessons', lessonId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (err) {
    console.error('Error updating lesson:', err);
    return { success: false, error: 'Could not update lesson' };
  }
};

/**
 * Delete a study guide (admin only)
 */
export const deleteStudyGuide = async (
  guideId: string
): Promise<{ success: boolean; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    // Note: This doesn't delete subcollections (lessons)
    // In production, you'd want a Cloud Function to handle this
    await deleteDoc(doc(db, 'studyGuides', guideId));
    return { success: true };
  } catch (err) {
    console.error('Error deleting study guide:', err);
    return { success: false, error: 'Could not delete study guide' };
  }
};

/**
 * Delete a lesson (admin only)
 */
export const deleteLesson = async (
  guideId: string,
  lessonId: string
): Promise<{ success: boolean; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    await deleteDoc(doc(db, 'studyGuides', guideId, 'lessons', lessonId));

    // Update lesson count on guide
    const guideRef = doc(db, 'studyGuides', guideId);
    const guideSnap = await getDoc(guideRef);
    if (guideSnap.exists()) {
      const currentCount = guideSnap.data().lessonCount || 0;
      await updateDoc(guideRef, {
        lessonCount: Math.max(0, currentCount - 1),
        updatedAt: serverTimestamp(),
      });
    }

    return { success: true };
  } catch (err) {
    console.error('Error deleting lesson:', err);
    return { success: false, error: 'Could not delete lesson' };
  }
};
