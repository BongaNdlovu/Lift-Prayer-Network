import { normalizePrivacyFields, validatePrivacyFields } from '../../utils/contentPrivacy';

describe('contentPrivacy', () => {
  it('normalizes public content', () => {
    expect(normalizePrivacyFields({ visibility: 'PUBLIC' })).toEqual({
      visibility: 'PUBLIC',
      isPrivate: false,
      groupIds: [],
    });
  });

  it('normalizes private content from isPrivate flag', () => {
    expect(normalizePrivacyFields({ isPrivate: true })).toEqual({
      visibility: 'PRIVATE',
      isPrivate: true,
      groupIds: [],
    });
  });

  it('normalizes group content and deduplicates groupIds', () => {
    expect(normalizePrivacyFields({ visibility: 'GROUP', groupIds: ['a', 'a', 'b'] })).toEqual({
      visibility: 'GROUP',
      isPrivate: false,
      groupIds: ['a', 'b'],
    });
  });

  it('requires group ids for group visibility', () => {
    expect(validatePrivacyFields({ visibility: 'GROUP', groupIds: [] })).toBe('Choose at least one group for a group-visible prayer.');
  });

  it('rejects private with groupIds', () => {
    expect(validatePrivacyFields({ visibility: 'PRIVATE', groupIds: ['a'] })).toBe('Private prayers cannot also be assigned to groups.');
  });

  it('passes validation for public', () => {
    expect(validatePrivacyFields({ visibility: 'PUBLIC' })).toBe(null);
  });

  it('passes validation for private without groups', () => {
    expect(validatePrivacyFields({ visibility: 'PRIVATE', groupIds: [] })).toBe(null);
  });

  it('passes validation for group with valid groups', () => {
    expect(validatePrivacyFields({ visibility: 'GROUP', groupIds: ['a', 'b'] })).toBe(null);
  });
});
