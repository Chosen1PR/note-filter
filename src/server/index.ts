import express from "express";
import {
  createServer,
  getServerPort,
  settings,
  reddit,
  context
} from "@devvit/web/server";

import {
  getModNotes,
  iterateModNotes,
  isUserMod,
  isUserApproved,
  isThereAtLeastOneValidBehavior,
  isModIgnored,
  getRequestBodyValue
} from "./utils.js";
import { PostId, CommentId, PostOrCommentId, UserId } from "./types";

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

// Trigger handler for post creation
router.post('/internal/triggers/on-post-create', async (req, res): Promise<void> => {
  try {
    const allSettings = await settings.getAll();
    const actionPosts = allSettings['actionPosts'] as boolean ?? false;
    if (!actionPosts) return;
    if (!isThereAtLeastOneValidBehavior(allSettings)) return;
    const username = (req.body.author.name as string) ?? '';
    // Exclude mods from actions.
    const isMod = await isUserMod(username);
    if (isMod) return;
    // Exclude approved users from actions if the corresponding setting is enabled.
    if (allSettings['exemptApproved']) {
      const isApproved = await isUserApproved(username);
      if (isApproved) return;
    }
    // If we're here, time to get the mod notes.
    const modNotes = await getModNotes(username);
    if (modNotes.length > 0) {
      const postId = (req.body.post.id as string) ?? '';
      await iterateModNotes(modNotes, allSettings, postId as PostId);
    }
    res.status(200).json({ status: 'ok' });
  }
  catch (error) {
    console.log(error);
  }
});

// Trigger handler for comment creation
router.post('/internal/triggers/on-comment-create', async (req, res): Promise<void> => {
  try {
    const allSettings = await settings.getAll();
    const actionComments = allSettings['actionComments'] as boolean ?? false;
    if (!actionComments) return;
    if (!isThereAtLeastOneValidBehavior(allSettings)) return;
    const username = (req.body.author.name as string) ?? '';
    // Exclude mods from actions.
    const isMod = await isUserMod(username);
    if (isMod) return;
    // Exclude approved users from actions if the corresponding setting is enabled.
    if (allSettings['exemptApproved']) {
      const isApproved = await isUserApproved(username);
      if (isApproved) return;
    }
    // If we're here, time to get the mod notes.
    const modNotes = await getModNotes(username);
    if (modNotes.length > 0) {
      const commentId = (req.body.comment.id as string) ?? '';
      await iterateModNotes(modNotes, allSettings, commentId as CommentId);
    }
    res.status(200).json({ status: 'ok' });
  }
  catch (error) {
    console.log(error);
  }
});

// Trigger handler for spam removal
router.post('/internal/triggers/on-mod-action', async (req, res): Promise<void> => {
  //console.log(req.body);
  const modAction = getRequestBodyValue(req.body, ['action']) ?? '',
  subredditName = (getRequestBodyValue(req.body, ['subreddit', 'name']) ?? context.subredditName) ?? '',
  userId = getRequestBodyValue(req.body, ['targetUser', 'id']) ?? '',
  modName = getRequestBodyValue(req.body, ['moderator', 'name']) ?? '',
  postId = getRequestBodyValue(req.body, ['targetPost', 'id']) ?? '',
  commentId = getRequestBodyValue(req.body, ['targetComment', 'id']) ?? '',
  id = commentId || postId;
  //console.log(`modAction: ${modAction}\nuserId: ${userId}\nredditId: ${id}`);
  if (userId == '' || userId == 't2_0') return;
  try {
    // For "Spam Link" and "Spam Comment" actions
    if (modAction == 'spamlink' || modAction == 'spamcomment') {
      if (id == '') return;
      const allSettings = await settings.getAll(),
      createSpamWatchNote = allSettings['createSpamWatchNote'] as boolean,
      createSpamWarningNote = allSettings['createSpamWarningNote'] as boolean,
      modBlacklist = (allSettings['modBlacklist'] as string) ?? '';
      if (isModIgnored(modName, modBlacklist)) return;
      const type = id.startsWith('t3_') ? 'Post' : 'Comment';
      let label = '';
      if (createSpamWarningNote) label = 'SPAM_WARNING';
      else if (createSpamWatchNote) label = 'SPAM_WATCH';
      if (label == 'SPAM_WARNING' || label == 'SPAM_WATCH') {
        const user = await reddit.getUserById(userId as UserId);
        if (user) {
          await reddit.addModNote({
            subreddit: subredditName,
            user: user.username,
            note: `${type} marked as spam by ${modName}`,
            redditId: id as PostOrCommentId,
            label: label
          });
        }
      }
    }
    // For "Ban User" actions
    else if (modAction == 'banuser') {
      const allSettings = await settings.getAll(),
      createBanNote = allSettings['createBanNote'] as boolean,
      modBlacklist = (allSettings['modBlacklist'] as string) ?? '';
      if (isModIgnored(modName, modBlacklist)) return;
      if (createBanNote) {
        const user = await reddit.getUserById(userId as UserId);
        if (user) {
          await reddit.addModNote({
            subreddit: subredditName,
            user: user.username,
            note: `Banned by ${modName}`,
            label: 'BAN'
          });
        }
        
      }
    }
    res.status(200).json({ status: 'ok' });
  }
  catch (error) {
    console.log(error);
  }
});

app.use(router);

const server = createServer(app);
server.on("error", (err) => console.error(`server error: ${err.stack}`));
server.listen(getServerPort());