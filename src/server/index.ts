import express from "express";
import {
  createServer,
  getServerPort,
  settings
} from "@devvit/web/server";

import {
  getModNotes,
  iterateModNotes,
  isUserMod,
  isUserApproved,
  isThereAtLeastOneValidBehavior
} from "./utils.js";
import { PostId, CommentId } from "./types";

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
    const username = req.body.author.name as string ?? "";
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
      const postId = req.body.post.id as string ?? "";
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
    const username = req.body.author.name as string ?? "";
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
      const commentId = req.body.comment.id as string ?? "";
      await iterateModNotes(modNotes, allSettings, commentId as CommentId);
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