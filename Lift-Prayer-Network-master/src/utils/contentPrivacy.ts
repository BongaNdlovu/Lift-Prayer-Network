import type { RequestVisibility } from '../types';

type PrivacyInput = {
  visibility?: RequestVisibility | null;
  isPrivate?: boolean | null;
  groupIds?: string[] | null;
};

export const normalizePrivacyFields = (input: PrivacyInput) => {
  const visibility: RequestVisibility = input.visibility || (input.isPrivate ? 'PRIVATE' : 'PUBLIC');
  const groupIds = visibility === 'GROUP' ? Array.from(new Set(input.groupIds || [])).filter(Boolean) : [];

  return {
    visibility,
    isPrivate: visibility === 'PRIVATE',
    groupIds,
  };
};

export const validatePrivacyFields = (input: PrivacyInput): string | null => {
  const normalized = normalizePrivacyFields(input);
  if (normalized.visibility === 'GROUP' && normalized.groupIds.length === 0) {
    return 'Choose at least one group for a group-visible prayer.';
  }
  if (normalized.visibility === 'PRIVATE' && normalized.groupIds.length > 0) {
    return 'Private prayers cannot also be assigned to groups.';
  }
  return null;
};
