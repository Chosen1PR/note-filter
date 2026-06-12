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
  PostOrCommentId
} from "./types";

// Helper function to get all mod notes for a given user
// For reference, mod note types are below
// "NOTE" | "APPROVAL" | "REMOVAL" | "BAN" | "MUTE" | "INVITE" | "SPAM" | "CONTENT_CHANGE" | "MOD_ACTION" | "ALL"
// And user note labels are below
// "BOT_BAN" | "PERMA_BAN" | "BAN" | "ABUSE_WARNING" | "SPAM_WARNING" | "SPAM_WATCH" | "SOLID_CONTRIBUTOR" | "HELPFUL_USER"
export async function getModNotes(username: string) {
  try {
    const modNotes = await reddit.getModNotes( { user: username, subreddit: context.subredditName } ).all();
    if (modNotes) {
      return modNotes;
    }
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
  maxNoteAgeDays = allSettings['maxNoteAgeDays'] as number ?? 0;
  var actionTaken = '';
  for (const note of modNotes) {
    const userNote = note.userNote;
    if (!userNote) continue;
    if (maxNoteAgeDays > 0) {
      const noteAgeDays = getAgeDays(note.createdAt);
      if (noteAgeDays > maxNoteAgeDays) continue;
    }
    const label = userNote.label as string ?? 'NONE';
    if (banNoteBehavior != 'none' && label.toString().includes("BAN")) {
      await actionContent(id, label, banNoteBehavior);
      actionTaken = banNoteBehavior;
    }
    else if (abuseWarningBehavior != 'none' && label == 'ABUSE_WARNING') {
      await actionContent(id, label, abuseWarningBehavior);
      actionTaken = abuseWarningBehavior;
    }
    else if (spamWarningBehavior != 'none' && label == 'SPAM_WARNING') {
      await actionContent(id, label, spamWarningBehavior);
      actionTaken = spamWarningBehavior;
    }
    else if (spamWatchBehavior != 'none' && label == 'SPAM_WATCH') {
      await actionContent(id, label, spamWatchBehavior);
      actionTaken = spamWatchBehavior;
    }
    else if (noLabelBehavior != 'none' && label == 'NONE') {
      await actionContent(id, label, noLabelBehavior);
      actionTaken = noLabelBehavior;
    }
    if (actionTaken == 'remove') break;
  }
}

// Helper function to take action on content based on mod note label and selected behavior.
// Split up into two functions because of content type requirements for Reddit API.
export async function actionContent(id: PostOrCommentId, label: string, behavior: string) {
  const formattedLabel = formatLabel(label),
  reason = `User has a mod note with label: ${formattedLabel}`;
  if (behavior == 'report') {
    let postOrComment: Post | Comment | undefined;
    if (id.startsWith('t3_'))
      postOrComment = await reddit.getPostById(id as PostId);
    else if (id.startsWith('t1_'))
      postOrComment = await reddit.getCommentById(id as CommentId);
    if (postOrComment) await reddit.report(postOrComment, { reason: reason })
  }
  else if (behavior == "filter") {
    await reddit.filter(id, reason, true);
  }
  else if (behavior == "remove") {
    await reddit.remove(id, false);
  }
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
  if (spamWatchBehavior != 'none') return true;
  else if (spamWarningBehavior != 'none') return true;
  else if (abuseWarningBehavior != 'none') return true;
  else if (banNoteBehavior != 'none') return true;
  else if (noLabelBehavior != 'none') return true;
  else return false;
}