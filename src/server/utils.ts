import {
  reddit,
  context,
  ModNote,
  SettingsValues
} from "@devvit/web/server";
import { PostOrCommentId } from "./types";

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
    return [];
  }
}

export async function iterateModNotes(modNotes: ModNote[], allSettings: SettingsValues, id: PostOrCommentId) {
  const behavior = allSettings['selectedBehavior'] as string ?? "report";
  const actionBanNote = allSettings['actionBanNote'] as boolean ?? false;
  const actionAbuseWarning = allSettings['actionAbuseWarning'] as boolean ?? false;
  const actionSpamWarning = allSettings['actionSpamWarning'] as boolean ?? false;
  const actionSpamWatch = allSettings['actionSpamWatch'] as boolean ?? false;
  const actionNoLabel = allSettings['actionNoLabel'] as boolean ?? false;
  for (const note of modNotes) {
    const label = note.userNote?.label ?? "NONE";
    if (actionBanNote && label.includes("BAN")) {
      await actionContent(id as PostOrCommentId, label, behavior);
      break;
    }
    if (actionAbuseWarning && label == "ABUSE_WARNING") {
      await actionContent(id as PostOrCommentId, label, behavior);
      break;
    }
    if (actionSpamWarning && label == "SPAM_WARNING") {
      await actionContent(id as PostOrCommentId, label, behavior);
      break;
    }
    if (actionSpamWatch && label == "SPAM_WATCH") {
      await actionContent(id as PostOrCommentId, label, behavior);
      break;
    }
    if (actionNoLabel && label == "NONE") {
      await actionContent(id as PostOrCommentId, label, behavior);
      break;
    }
  }
}

export async function actionContent(id: PostOrCommentId, label: string, behavior: string) {
  switch (behavior) {
    case "report":
      await reddit.filter(id, `User has mod note with label: ${label}`, true);
      break;
    case "filter":
      await reddit.filter(id, `User has mod note with label: ${label}`, false);
      break;
    case "remove":
      await reddit.remove(id, false);
      break;
  }
}