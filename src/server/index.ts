import express from "express";
import {
  createServer,
  context,
  getServerPort,
  settings,
  //reddit
} from "@devvit/web/server";

import { getModNotes, iterateModNotes } from "./utils.js";
import { PostId, CommentId } from "./types";

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

// Menu item for app settings
router.post("/internal/menu/app-settings", async (_req, res): Promise<void> => {
  res.json({
    navigateTo: `https://developers.reddit.com/r/${context.subredditName}/apps/${context.appSlug}`,
  });
});

// Trigger handler for post creation
router.post('/internal/triggers/on-post-create', async (req, res): Promise<void> => {
  try {
    const allSettings = await settings.getAll();
    if (!allSettings['actionPosts']) return;
    const username = req.body.author.name as string ?? "";
    const postId = req.body.post.id as string ?? "";
    const modNotes = await getModNotes(username);
    if (modNotes.length > 0) {
      await iterateModNotes(modNotes, allSettings, postId as PostId);
    }
    res.status(200).json({ status: 'ok' });
  }
  catch {} // General catch to make sure app doesn't throw an exception.
});

// Trigger handler for comment creation
router.post('/internal/triggers/on-comment-create', async (req, res): Promise<void> => {
  try {
    const allSettings = await settings.getAll();
    if (!allSettings['actionPosts']) return;
    const username = req.body.author.name as string ?? "";
    const commentId = req.body.comment.id as string ?? "";
    const modNotes = await getModNotes(username);
    if (modNotes.length > 0) {
      await iterateModNotes(modNotes, allSettings, commentId as CommentId);
    }
    res.status(200).json({ status: 'ok' });
  }
  catch {} // General catch to make sure app doesn't throw an exception.
});

app.use(router);

const server = createServer(app);
server.on("error", (err) => console.error(`server error: ${err.stack}`));
server.listen(getServerPort());