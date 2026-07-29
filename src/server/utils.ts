import {
  reddit,
  context,
  ModNote,
  SettingsValues,
  Post,
  Comment
} from "@devvit/web/server";

import {
  PostId,
  CommentId,
  PostOrCommentId,
  ActionsTaken
} from "./types";

// Helper function to get all mod notes for a given user
// For reference, mod note types are below
// "NOTE" | "APPROVAL" | "REMOVAL" | "BAN" | "MUTE" | "INVITE" | "SPAM" | "CONTENT_CHANGE" | "MOD_ACTION" | "ALL"
// And user note labels are below
// "BOT_BAN" | "PERMA_BAN" | "BAN" | "ABUSE_WARNING" | "SPAM_WARNING" | "SPAM_WATCH" | "SOLID_CONTRIBUTOR" | "HELPFUL_USER"
export async function getModNotes(username: string) {
  try {
    const shadowbanned = !(await reddit.getUserByUsername(username));
    if (shadowbanned) return [];
    const modNotes = await reddit.getModNotes( { user: username, subreddit: context.subredditName } ).all();
    if (modNotes) return modNotes;
    else return [];
  }
  catch (error) {
    console.log(error);
    return [];
  }
}

// Helper function to iterate through mod notes and take aciton based on settings
export async function iterateModNotes(modNotes: ModNote[], allSettings: SettingsValues, id: PostOrCommentId) {
  const banNoteBehavior = allSettings['banNoteBehavior'] as string ?? 'none',
  abuseWarningBehavior = allSettings['abuseWarningBehavior'] as string ?? 'none',
  spamWarningBehavior = allSettings['spamWarningBehavior'] as string ?? 'none',
  spamWatchBehavior = allSettings['spamWatchBehavior'] as string ?? 'none',
  noLabelBehavior = allSettings['noLabelBehavior'] as string ?? 'none',
  maxNoteAgeDays = allSettings['maxNoteAgeDays'] as number ?? 0,
  modBlacklist = getModBlacklist(allSettings);
  const actions: ActionsTaken = { reported: false, filtered: false, removed: false };
  for (const note of modNotes) {
    const userNote = note.userNote;
    if (!userNote) continue;
    if (maxNoteAgeDays > 0) {
      if (getAgeDays(note.createdAt) > maxNoteAgeDays) continue;
    }
    const modName = note.operator.name ?? '';
    if (isModIgnored(modName, modBlacklist)) continue;
    const label = userNote.label as string ?? 'NONE';
    if (banNoteBehavior != 'none' && label.toString().endsWith("BAN") && !hasActionBeenTaken(banNoteBehavior, actions)) {
      await actionContent(id, label, banNoteBehavior);
      markActionTaken(banNoteBehavior, actions);
    }
    else if (abuseWarningBehavior != 'none' && label == 'ABUSE_WARNING' && !hasActionBeenTaken(abuseWarningBehavior, actions)) {
      await actionContent(id, label, abuseWarningBehavior);
      markActionTaken(abuseWarningBehavior, actions);
    }
    else if (spamWarningBehavior != 'none' && label == 'SPAM_WARNING' && !hasActionBeenTaken(spamWarningBehavior, actions)) {
      await actionContent(id, label, spamWarningBehavior);
      markActionTaken(spamWarningBehavior, actions);
    }
    else if (spamWatchBehavior != 'none' && label == 'SPAM_WATCH' && !hasActionBeenTaken(spamWatchBehavior, actions)) {
      await actionContent(id, label, spamWatchBehavior);
      markActionTaken(spamWatchBehavior, actions);
    }
    else if (noLabelBehavior != 'none' && label == 'NONE' && !hasActionBeenTaken(noLabelBehavior, actions)) {
      const keywordConfig = (allSettings['noLabelKeywords'] as string) ?? '';
      if (keywordConfig.trim() != '') { // Keyword config is not empty. Search for keywords and action accordingly.
        const keywordMatch = getKeywordMatchForNoLabelNotes(userNote.note ?? '', keywordConfig);
        if (keywordMatch) {
          await actionContent(id, label, noLabelBehavior, keywordMatch);
          markActionTaken(noLabelBehavior, actions);
        }
      }
      else { // Keyword config is empty. Ignore keywords and always action.
        await actionContent(id, label, noLabelBehavior);
        markActionTaken(noLabelBehavior, actions);
      }
    }
    if (actions.removed) break;
  }
}

// Helper function to take action on content based on mod note label and selected behavior.
// Split up into two functions because of content type requirements for Reddit API.
export async function actionContent(id: PostOrCommentId, label: string, behavior: string, keyword?: string) {
  const formattedLabel = formatLabel(label);
  let reason = `User has a mod note with label: ${formattedLabel}`;
  if (keyword != undefined && keyword.trim() != '')
    reason = `User has a mod note with keyword: ${keyword}`;
  if (behavior == 'report') {
    const postOrComment = await getPostOrComment(id);
    if (postOrComment) await reddit.report(postOrComment, { reason: reason })
  }
  else if (behavior == "filter") {
    await reddit.filter(id, { reason: reason, keep: false });
  }
  else if (behavior == "remove") {
    await reddit.remove(id, false);
  }
}

// Helper function to determine if content should be actioned based on a note with no label.
// To be used only when "no label" notes are okay to be actioned.
// Returns a keyword match if found, undefined otherwise.
function getKeywordMatchForNoLabelNotes(noteText: string, keywordConfig: string) {
  if (keywordConfig.trim() == '') return;
  const keywords = keywordConfig.split(',');
  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase().trim(),
    noteLower = noteText.toLowerCase().trim();
    if (keywordLower != '' && noteLower.includes(keywordLower)) {
      return keyword;
    }
  }
  return;
}

// Helper function to determine if a user is a mod. Used for excluding mods from actions.
export async function isUserMod(username: string) {
  try {
    const user = await reddit.getUserByUsername(username);
    if (!user) return false;
    const perms = await user.getModPermissionsForSubreddit(context.subredditName);
    if (!perms) return false;
    else return (perms.length > 0);
  }
  catch (error) { return false; }
}

// Helper function to determine if a user is approved. Used for excluding approved users from actions depending on the setting.
export async function isUserApproved(username: string) {
  try {
    const approvedUser = await reddit.getApprovedUsers( { subredditName: context.subredditName, username: username, limit: 1 }).all();
    if (!approvedUser) return false;
    else return (approvedUser.length > 0);
  }
  catch (error) {return false;}
}

// Helper function to determine the age (in days) of a mod note.
// Used for ignoring mod notest past a certain age.
function getAgeDays(date: Date) {
  const diffMs = Date.now() - date.getTime();
  // 1000ms/s, 60s/min, 60min/hr, 24hr/day
  return diffMs / (1000 * 60 * 60 * 24);
}

// Helper function for cleaning up the formatting on the labels for better readability.
function formatLabel(label: string) {
  switch (label) {
    case 'SPAM_WATCH': return 'Spam Watch';
    case 'SPAM_WARNING': return 'Spam Warning';
    case 'ABUSE_WARNING': return 'Abuse Warning';
    case 'BAN': return 'Ban';
    case 'PERMA_BAN': return 'Permanent Ban';
    case 'BOT_BAN': return 'Bot Ban';
    default: return 'N/A';
  }
}

// Helper function to determine if the app needs to continue at all.
// Returns true if it should try to make at least one action, false otherwise.
export function isThereAtLeastOneValidBehavior(allSettings: SettingsValues) {
  const spamWatchBehavior = allSettings['spamWatchBehavior'] as string ?? 'none',
  spamWarningBehavior = allSettings['spamWarningBehavior'] as string ?? 'none',
  abuseWarningBehavior = allSettings['abuseWarningBehavior'] as string ?? 'none',
  banNoteBehavior = allSettings['banNoteBehavior'] as string ?? 'none',
  noLabelBehavior = allSettings['noLabelBehavior'] as string ?? 'none';
  if      (spamWatchBehavior != 'none') return true;
  else if (spamWarningBehavior != 'none') return true;
  else if (abuseWarningBehavior != 'none') return true;
  else if (banNoteBehavior != 'none') return true;
  else if (noLabelBehavior != 'none') return true;
  else return false;
}

export function getModBlacklist(allSettings: SettingsValues): string[] {
  const modBlacklistString = (allSettings['modBlacklist'] as string) ?? '';
  if (modBlacklistString.trim() == '') return [];
  else return modBlacklistString.split(',');
}

// Helper function to determine is a mod action by a specific mod should be ignored.
export function isModIgnored(modUsername: string, modBlacklist: string[]) {
  for (const modName of modBlacklist) {
    if (modName.trim() == modUsername) return true;
  }
  return false;
}

// Helper function to determine if a specific action has already been made on a post/comment.
function hasActionBeenTaken(behavior: string, actions: ActionsTaken) {
  if      (behavior == 'report') return actions.reported;
  else if (behavior == 'filter') return actions.filtered;
  else if (behavior == 'remove') return actions.removed;
  else return false;
}

// Helper function that mutates an ActionsTaken record by updating the appropriate action taken.
function markActionTaken(behavior: string, actions: ActionsTaken) {
  if      (behavior == 'report') actions.reported = true;
  else if (behavior == 'filter') actions.filtered = true;
  else if (behavior == 'remove') actions.removed = true;
}

// Helper function to get the specific fields of a request.
// Returns empty string if value is not found.
export function getRequestBodyValue(body: any, ...paths: Array<string[]>) {
  for (const path of paths) {
    let current: any = body;
    let found = true;
    for (const key of path) {
      if (current == null || typeof current !== 'object' || !(key in current)) {
        found = false;
        break;
      }
      current = current[key];
    }
    if (found && current != null && current !== '') {
      return String(current);
    }
  }
  return '';
}

// Helper function for when Devvit is borked and shows an invalid username.
export function isValidUsername(username: string) {
  const name = username.toLowerCase();
  return (
    name != '[redacted]' &&
    name != '[deleted]' &&
    name != ''
  );
}

// Helper function for when Devvit is borked and shows an invalid user ID.
export function isValidUserId(userId: string) {
  return (userId != 't2_0' && userId != '');
}

// Helper function to get a post or comment object based on its ID.
export async function getPostOrComment(id: string): Promise<Post | Comment | undefined> {
  if (id.startsWith('t3_'))
    return await reddit.getPostById(id as PostId);
  else if (id.startsWith('t1_'))
    return await reddit.getCommentById(id as CommentId);
  else return;
}