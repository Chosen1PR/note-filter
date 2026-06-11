import {
  reddit,
  context,
  ModNote,
  SettingsValues
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
  const behavior = allSettings['behavior'] as string ?? "report";
  const actionBanNote = allSettings['actionBanNote'] as boolean ?? false;
  const actionAbuseWarning = allSettings['actionAbuseWarning'] as boolean ?? false;
  const actionSpamWarning = allSettings['actionSpamWarning'] as boolean ?? false;
  const actionSpamWatch = allSettings['actionSpamWatch'] as boolean ?? false;
  const actionNoLabel = allSettings['actionNoLabel'] as boolean ?? false;
  const maxNoteAgeDays = allSettings['maxNoteAgeDays'] as number ?? 0;
  for (const note of modNotes) {
    const userNote = note.userNote;
    if (!userNote) continue;
    if (maxNoteAgeDays > 0) {
      const noteAgeDays = getAgeDays(note.createdAt);
      if (noteAgeDays > maxNoteAgeDays) continue;
    }
    const label = userNote.label as string ?? "NONE";
    if (actionBanNote && label.toString().includes("BAN")) {
      await actionContent(id as PostOrCommentId, label, behavior);
      break;
    }
    else if (actionAbuseWarning && label == "ABUSE_WARNING") {
      await actionContent(id as PostOrCommentId, label, behavior);
      break;
    }
    else if (actionSpamWarning && label == "SPAM_WARNING") {
      await actionContent(id as PostOrCommentId, label, behavior);
      break;
    }
    else if (actionSpamWatch && label == "SPAM_WATCH") {
      await actionContent(id as PostOrCommentId, label, behavior);
      break;
    }
    else if (actionNoLabel && label == "NONE") {
      await actionContent(id as PostOrCommentId, label, behavior);
      break;
    }
  }
}

// Helper function to take action on content based on mod note label and selected behavior.
// Split up into two functions because of content type requirements for Reddit API.
export async function actionContent(id: PostOrCommentId, label: string, behavior: string) {
  if (id.startsWith("t3_")) {
    await actionPost(id as PostId, label, behavior);
  }
  else if (id.startsWith("t1_")) {
    await actionComment(id as CommentId, label, behavior);
  }
}

// Helper function to action a post based on mod note label and selected behavior
export async function actionPost(id: PostId, label: string, behavior: string) {
  const reason = `User has a mod note with label: ${label}`;
  if (behavior == "report") {
    const post = await reddit.getPostById(id);
    if (post) await reddit.report(post, { reason: reason });
  }
  else if (behavior == "filter") {
    await reddit.filter(id, reason, true);
  }
  else if (behavior == "remove") {
    await reddit.remove(id, false);
  }
}

// Helper function to action a comment based on mod note label and selected behavior
export async function actionComment(id: CommentId, label: string, behavior: string) {
  const reason = `User has a mod note with label: ${label}`;
  if (behavior == "report") {
    const comment = await reddit.getCommentById(id);
    if (comment) await reddit.report(comment, { reason: reason });
  }
  else if (behavior == "filter") {
    await reddit.filter(id, reason, true);
  }
  else if (behavior == "remove") {
    await reddit.remove(id, false);
  }
}

// Helper function to determine if a user is a mod. Used for excluding mods from actions.
export async function isUserAMod(username: string) {
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