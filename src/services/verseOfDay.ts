// Verse of the Day Service - Prayer-focused KJV verses

export interface VerseOfDay {
  reference: string;
  text: string;
}

// Collection of prayer-focused KJV verses
const PRAYER_VERSES: VerseOfDay[] = [
  {
    reference: 'Philippians 4:6',
    text: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.',
  },
  {
    reference: 'Matthew 7:7',
    text: 'Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you.',
  },
  {
    reference: '1 Thessalonians 5:17',
    text: 'Pray without ceasing.',
  },
  {
    reference: 'James 5:16',
    text: 'Confess your faults one to another, and pray one for another, that ye may be healed. The effectual fervent prayer of a righteous man availeth much.',
  },
  {
    reference: 'Matthew 21:22',
    text: 'And all things, whatsoever ye shall ask in prayer, believing, ye shall receive.',
  },
  {
    reference: 'Jeremiah 29:12',
    text: 'Then shall ye call upon me, and ye shall go and pray unto me, and I will hearken unto you.',
  },
  {
    reference: 'Psalm 145:18',
    text: 'The LORD is nigh unto all them that call upon him, to all that call upon him in truth.',
  },
  {
    reference: 'Mark 11:24',
    text: 'Therefore I say unto you, What things soever ye desire, when ye pray, believe that ye receive them, and ye shall have them.',
  },
  {
    reference: 'Romans 8:26',
    text: 'Likewise the Spirit also helpeth our infirmities: for we know not what we should pray for as we ought: but the Spirit itself maketh intercession for us with groanings which cannot be uttered.',
  },
  {
    reference: 'Psalm 55:17',
    text: 'Evening, and morning, and at noon, will I pray, and cry aloud: and he shall hear my voice.',
  },
  {
    reference: 'Matthew 6:6',
    text: 'But thou, when thou prayest, enter into thy closet, and when thou hast shut thy door, pray to thy Father which is in secret; and thy Father which seeth in secret shall reward thee openly.',
  },
  {
    reference: 'Colossians 4:2',
    text: 'Continue in prayer, and watch in the same with thanksgiving.',
  },
  {
    reference: '1 John 5:14',
    text: 'And this is the confidence that we have in him, that, if we ask any thing according to his will, he heareth us.',
  },
  {
    reference: 'Psalm 34:17',
    text: 'The righteous cry, and the LORD heareth, and delivereth them out of all their troubles.',
  },
  {
    reference: 'Isaiah 65:24',
    text: 'And it shall come to pass, that before they call, I will answer; and while they are yet speaking, I will hear.',
  },
  {
    reference: 'Hebrews 4:16',
    text: 'Let us therefore come boldly unto the throne of grace, that we may obtain mercy, and find grace to help in time of need.',
  },
  {
    reference: 'Psalm 91:15',
    text: 'He shall call upon me, and I will answer him: I will be with him in trouble; I will deliver him, and honour him.',
  },
  {
    reference: 'John 15:7',
    text: 'If ye abide in me, and my words abide in you, ye shall ask what ye will, and it shall be done unto you.',
  },
  {
    reference: 'Proverbs 15:29',
    text: 'The LORD is far from the wicked: but he heareth the prayer of the righteous.',
  },
  {
    reference: 'Psalm 17:6',
    text: 'I have called upon thee, for thou wilt hear me, O God: incline thine ear unto me, and hear my speech.',
  },
  {
    reference: 'Matthew 18:19',
    text: 'Again I say unto you, That if two of you shall agree on earth as touching any thing that they shall ask, it shall be done for them of my Father which is in heaven.',
  },
  {
    reference: 'Psalm 102:17',
    text: 'He will regard the prayer of the destitute, and not despise their prayer.',
  },
  {
    reference: 'Luke 11:9',
    text: 'And I say unto you, Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you.',
  },
  {
    reference: 'Ephesians 6:18',
    text: 'Praying always with all prayer and supplication in the Spirit, and watching thereunto with all perseverance and supplication for all saints.',
  },
  {
    reference: 'Psalm 66:19',
    text: 'But verily God hath heard me; he hath attended to the voice of my prayer.',
  },
  {
    reference: '2 Chronicles 7:14',
    text: 'If my people, which are called by my name, shall humble themselves, and pray, and seek my face, and turn from their wicked ways; then will I hear from heaven, and will forgive their sin, and will heal their land.',
  },
  {
    reference: 'Psalm 5:3',
    text: 'My voice shalt thou hear in the morning, O LORD; in the morning will I direct my prayer unto thee, and will look up.',
  },
  {
    reference: 'John 14:13',
    text: 'And whatsoever ye shall ask in my name, that will I do, that the Father may be glorified in the Son.',
  },
  {
    reference: 'Psalm 86:6',
    text: 'Give ear, O LORD, unto my prayer; and attend to the voice of my supplications.',
  },
  {
    reference: 'James 1:5',
    text: 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.',
  },
];

/**
 * Get the verse of the day based on the current date.
 * Uses a deterministic algorithm so all users see the same verse on the same day.
 */
export const getVerseOfDay = (): VerseOfDay => {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const diff = today.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  // Use day of year to select verse (cycles through all verses)
  const verseIndex = dayOfYear % PRAYER_VERSES.length;
  return PRAYER_VERSES[verseIndex];
};
