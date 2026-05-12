# Firestore Schema

This document describes the Firestore database schema used in the Lift Prayer Network app.

## Collection Constants

Collection names are defined in `src/config/collections.ts`:
- `REQUESTS` - 'requests'
- `TESTIMONIES` - 'testimonies'
- `USERS` - 'users'
- `GROUPS` - 'groups'
- `COMMENTS` - 'comments'
- `PRAYERS` - 'prayers'
- `NOTIFICATIONS` - 'notifications'
- `REPORTS` - 'reports'
- `ANNOUNCEMENTS` - 'announcements'
- `DEVOTIONS` - 'devotions'
- `REACTIONS` - 'reactions'
- `STUDY_GUIDES` - 'studyGuides'
- `USER_STUDY_STATS` - 'userStudyStats'
- `PRAYER_PROMISES` - 'prayerPromises'
- `USER_PROGRESS` - 'userProgress'

## Collections

### users
User profile and preferences.

**Fields:**
- `displayName` (string) - User display name
- `email` (string) - User email
- `photoURL` (string, optional) - Profile photo URL
- `isBanned` (boolean) - Ban status
- `bannedAt` (timestamp, optional) - Ban timestamp
- `banReason` (string, optional) - Reason for ban
- `unbannedAt` (timestamp, optional) - Unban timestamp
- `groupIds` (array of strings, optional) - IDs of groups user belongs to
- `createdAt` (timestamp) - Account creation time

**Security Rules:**
- Users can read/write their own profile
- Admins can read any user and update ban status

### requests
Prayer requests submitted by users.

**Fields:**
- `ownerUid` (string) - User ID who created the request
- `userDisplayName` (string) - Display name of creator
- `userEmail` (string, optional) - Email of creator
- `userPhotoURL` (string, optional) - Profile photo of creator
- `isAnonymous` (boolean) - Whether request is anonymous
- `isEmailVerified` (boolean) - Whether creator email is verified
- `content` (string) - Prayer request content
- `title` (string) - Request title
- `category` (string) - Request category
- `severity` (string) - Severity level ('PENDING', 'HIGH', 'CRITICAL')
- `status` (string) - Request status ('PENDING', 'ACTIVE', 'RESOLVED')
- `prayers` (number) - Prayer count
- `commentCount` (number) - Number of comments
- `isUrgent` (boolean) - Whether request is urgent
- `isPrivate` (boolean) - Whether request is private
- `isShareable` (boolean) - Whether request can be shared
- `visibility` (string) - Visibility level ('PUBLIC', 'PRIVATE', 'GROUP')
- `groupIds` (array of strings, optional) - Group IDs for GROUP visibility
- `createdAt` (timestamp) - Creation time
- `updatedAt` (timestamp, optional) - Last update time
- `isPinned` (boolean, optional) - Whether request is pinned by admin
- `pinnedAt` (timestamp, optional) - When request was pinned
- `heartCount`, `fireCount`, `strongCount` (number) - Reaction counts

**Security Rules:**
- Public/Private/GROUP visibility based on `visibility` field
- Owner can update their own content
- Admins can update anything including pins
- Any signed-in user can increment prayer count
- Owner or admin can delete

### testimonies
Praise reports and answered prayers.

**Fields:**
- `ownerUid` (string) - User ID who created the testimony
- `userDisplayName` (string) - Display name of creator
- `userEmail` (string, optional) - Email of creator
- `userPhotoURL` (string, optional) - Profile photo of creator
- `isAnonymous` (boolean) - Whether testimony is anonymous
- `isEmailVerified` (boolean) - Whether creator email is verified
- `content` (string) - Testimony content
- `severity` (string) - Severity level ('RESOLVED')
- `status` (string) - Status ('RESOLVED')
- `likes` (number) - Like count
- `commentCount` (number) - Number of comments
- `isPrivate` (boolean) - Whether testimony is private
- `visibility` (string) - Visibility level ('PUBLIC', 'PRIVATE', 'GROUP')
- `groupIds` (array of strings, optional) - Group IDs for GROUP visibility
- `createdAt` (timestamp) - Creation time
- `updatedAt` (timestamp, optional) - Last update time
- `linkedRequestId` (string, optional) - ID of original prayer request
- `heartCount`, `fireCount`, `strongCount` (number) - Reaction counts

**Security Rules:**
- Public/Private/GROUP visibility based on `visibility` field
- Owner can update their own content
- Admins can update anything
- Any signed-in user can update reaction counts
- Owner or admin can delete

### groups
Prayer groups for community prayer.

**Fields:**
- `ownerUid` (string) - User ID who created the group
- `name` (string) - Group name
- `description` (string) - Group description
- `emoji` (string) - Group emoji icon
- `isPrivate` (boolean) - Whether group is private
- `memberUids` (array of strings) - IDs of group members
- `pendingRequests` (array of strings, optional) - IDs of users requesting to join
- `createdAt` (timestamp) - Creation time

**Security Rules:**
- Public groups: anyone can read
- Private groups: only members can read
- Owner can manage everything including membership
- Members can update basic metadata
- Non-members can join public groups or request to join private groups
- Only owner can delete

### comments
Comments on prayer requests and testimonies.

**Fields:**
- `parentId` (string) - ID of parent request/testimony
- `parentType` (string) - 'REQUEST' or 'TESTIMONY'
- `authorUid` (string) - User ID who wrote the comment
- `authorName` (string) - Display name of author
- `content` (string) - Comment content
- `hiddenByOwner` (boolean) - Whether comment is hidden by content owner
- `hiddenAt` (timestamp, optional) - When comment was hidden
- `createdAt` (timestamp) - Creation time
- `editedAt` (timestamp, optional) - Last edit time

**Security Rules:**
- Can only read if parent content is visible
- Users can create comments on visible content
- Comment owner can update content and editedAt
- Parent owner can hide comments
- Admins have full access

### prayers
Prayer actions tracking.

**Fields:**
- `actorUid` (string) - User ID who prayed
- `targetOwnerUid` (string) - User ID who owns the request
- `createdAt` (timestamp) - When prayer was made

**Security Rules:**
- Users can read their own prayer records and prayers for their requests
- Users can create their own prayer records
- Users can delete their own prayer records

### notifications
User notifications for app events.

**Fields:**
- `recipientUid` (string) - User ID receiving notification
- `actorUid` (string) - User ID who triggered notification
- `type` (string) - Notification type ('PRAYER', 'COMMENT', 'FOLLOW', 'GROUP_INVITE', 'GROUP_JOIN', 'ANNOUNCEMENT', 'ADMIN')
- `title` (string, optional) - Notification title
- `body` (string, optional) - Notification body
- `data` (object, optional) - Additional data
- `read` (boolean) - Whether notification is read
- `createdAt` (timestamp) - Creation time

**Security Rules:**
- Users can only read their own notifications
- Create requires actor is authenticated user
- Recipient must be different from actor (no self-notifications)
- Notification type must be valid
- Required fields must be present

### reports
Content moderation reports.

**Fields:**
- `actorUid` (string) - User ID who reported
- `targetId` (string) - ID of reported content
- `targetType` (string) - 'REQUEST', 'TESTIMONY', or 'COMMENT'
- `reason` (string) - Report reason
- `status` (string) - 'PENDING', 'REVIEWED', 'RESOLVED'
- `createdAt` (timestamp) - Creation time

**Security Rules:**
- Only admins can read reports
- Users can create reports with matching actorUid
- Admins can update report status
- Admins or reporter can delete

### announcements
Admin announcements to all users.

**Fields:**
- `title` (string) - Announcement title
- `body` (string) - Announcement body
- `createdAt` (timestamp) - Creation time
- `updatedAt` (timestamp, optional) - Last update time

**Security Rules:**
- All signed-in users can read
- Only admins can create, update, delete

### devotions
Daily devotional content.

**Fields:**
- `title` (string) - Devotion title
- `content` (string) - Devotion content
- `scripture` (string, optional) - Scripture reference
- `date` (string) - Devotion date
- `createdAt` (timestamp) - Creation time
- `updatedAt` (timestamp, optional) - Last update time

**Security Rules:**
- All signed-in users can read
- Only admins can create, update, delete

### reactions
Individual user reactions to prevent duplicates.

**Fields:**
- `actorUid` (string) - User ID who reacted
- `targetId` (string) - ID of content
- `targetType` (string) - 'REQUEST' or 'TESTIMONY'
- `reactionType` (string) - 'heart', 'fire', 'strong'
- `createdAt` (timestamp) - Creation time

**Security Rules:**
- Any signed-in user can read reactions
- Users can create reactions with matching actorUid
- Users can delete their own reactions

### studyGuides
Sabbath School study guides.

**Fields:**
- `title` (string) - Guide title
- `quarter` (string) - Quarter identifier
- `description` (string, optional) - Guide description
- `createdAt` (timestamp) - Creation time

**Subcollection: lessons**
- `title` (string) - Lesson title
- `date` (string) - Lesson date
- `content` (string) - Lesson content
- `scripture` (string, optional) - Scripture reference

**Security Rules:**
- All signed-in users can read
- Only admins can create, update, delete

### userStudyStats
User study progress tracking.

**Fields:**
- `userId` (string) - User ID
- `streak` (number) - Current streak
- `completedLessons` (array of strings) - IDs of completed lessons
- `bookmarks` (array of strings, optional) - IDs of bookmarked lessons

**Security Rules:**
- Users can read/write their own stats

### prayerPromises
User's personal prayer promises.

**Fields:**
- `userId` (string) - User ID
- `content` (string) - Promise content
- `scripture` (string, optional) - Scripture reference
- `createdAt` (timestamp) - Creation time
- `completedAt` (timestamp, optional) - When promise was completed

**Security Rules:**
- Users can read/write their own prayer promises

### userProgress
User progress tracking (collection with subcollections).

**Security Rules:**
- Users can read/write their own progress

## Security Rules Key Functions

### Helper Functions
- `isSignedIn()` - Checks if user is authenticated
- `isOwner(data)` - Checks if user owns the document
- `isAdmin()` - Checks if user is admin (email: fanelesibonge50@gmail.com)
- `isMember(data)` - Checks if user is a group member
- `userGroupIds()` - Gets user's group IDs from their profile
- `canReadVisibleContent(data)` - Checks if user can read content based on visibility
- `isValidRequestPrivacy(data)` - Validates request privacy flags are consistent

## Privacy Model

### Visibility Levels
1. **PUBLIC** - Visible to everyone
2. **PRIVATE** - Visible only to owner
3. **GROUP** - Visible to group members

### Legacy Support
- Documents without `visibility` field are treated as PUBLIC
- Documents with `isPrivate: true` are treated as PRIVATE

## Data Sanitization

All writes to Firestore should use `sanitizeForFirestore()` from `src/utils/security.ts` to remove:
- `undefined` values
- Functions
- Invalid object types

This is applied in key services:
- `useFeed.ts` - submitFeedItem
- `requests.ts` - updateRequestContent, updateTestimonyContent, flagContent
- `comments.ts` - addComment
