# Security Specification - Teac DZ

## Data Invariants
1. A **User Profile** can only be created by the user themselves. The `uid` must match their auth ID.
2. **Private User Data** is strictly restricted to the owner and admins.
3. A **Post** must have a valid author ID and author details. Only the author can update the content or privacy.
4. **Likes/Reactions** can be updated by any authenticated user, but only on the `likes` or `reactions` fields.
5. **Comments** can only be deleted by the comment author or the post author.
6. **Notifications** can only be read/deleted by the recipient.
7. **Messages** are restricted to participants of the room.
8. **Friend Requests/Invitations** are restricted to the sender and receiver.
9. **Blocked Users** logic must prevent users from interacting with those who blocked them.

## The "Dirty Dozen" Payloads
1. **Identity Theft (User Profile):** User A tries to create a profile with User B's UID.
2. **Privilege Escalation:** User A tries to update their own profile to set `isActivated: true`.
3. **Shadow Update (Post):** User A tries to update a Post adding a `verifiedAuthor: true` field.
4. **ID Poisoning:** User A tries to create a post with an ID that is 200KB of random characters.
5. **PII Leak:** User A tries to read User B's private data (email, phone).
6. **Interaction Spoofing:** User A tries to delete User B's like on a post.
7. **Notification Spam:** User A tries to create many notifications for User B without a legitimate event.
8. **Chat Eavesdropping:** User A tries to read messages in a room they are not a participant of.
9. **Terminal State Bypass:** User A tries to update a Friend Request status from 'accepted' to 'pending'.
10. **Resource Poisoning:** User A tries to upload a post with 10MB of content.
11. **Relational Sync Failure:** User A tries to create a comment for a post that doesn't exist.
12. **Admin Spoofing:** User A tries to use an email claim to gain admin access.

## Verification
The generated rules will ensure all these malicious actions are blocked.
