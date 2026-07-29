## Features

This tool allows mods to configure automatic actions to be made on posts and comments by users who have mod notes on their account. It's configurable by the label on the note (e.g., "Spam Warning" or "Abuse Warning") or, in the case of notes with no label, the text. For example, you can choose to only filter content by users with an "Abuse Warning" note. The full feature list is below.

* Automatically report, filter, or remove content from users who have mod notes on their account.
* Action posts, comments, or both.
* Ignore mod notes past a certain age (in days).
* Optionally exempt approved users.
* Choose the specific label types to action. These include:
    * Spam Watch
    * Spam Warning
    * Abuse Warning
    * Ban
    * No Label
* For notes with no label, define a list of keywords or phrases to look for in the note text.
* Optionally create a Spam Watch or Spam Warning note on a user automatically whenever a mod marks a post or comment as spam.
* Optionally create a Ban note on a user automatically whenever a mod bans them, even if the mod didn't leave a note themselves.
* Define an ignore-list of mods whose notes will *not* be read by the app and whose spam and ban actions will *not* create automatic notes. This could be useful if your subreddit has other apps/bots that write notes and action content accordingly.

*Note: Moderators' posts and comments will not be affected by this app, even if they have mod notes.*

---

## Changelog

### [1.0.13] (2026-07-28)

#### Features

- Mod ignore-list now also ignores notes written by those mods when actioning content (in addition to ignoring the mods when creating automatic notes).
- Related app settings are now grouped together for better readability.

### [1.0.12] (2026-07-09)

- Fixed an issue that could cause posts/comments from shadowbanned users to be filtered to the mod queue. As Reddit already removes these, there is no need to filter them.

### [1.0.11] (2026-07-01)

- Better workaround for the previous bug fix with fewer API calls.

### [1.0.9] (2026-06-29)

#### Bug Fixes

- Fixed an issue that caused automatic note creation to stop working suddenly due to a recent change by Reddit in how "spamlink" and "spamcomment" triggers fire.
- Fixed an issue that caused posts/comments to be reported or filtered multiple times in a row in the mod log if the user had multiple notes.

### [1.0.7] (2026-06-25)

#### Features

- Added the option to automatically create a Spam Watch or Spam Warning note whenever a mod marks a post/comment as spam.
- Added the option to automatically create a Ban note whenever a mod bans a user.
- Added the option to define an ignore-list of mods for which automatic notes will not be created.

### [1.0.3] (2026-06-19)

- Fixed an issue that caused filtered posts/comments to still be visible to other users while in the mod queue.

### [1.0.1] (2026-06-16)

- Added the ability to action content by users with no-label notes according to the text inside of them. This is done by defining a list of keywords or phrases.

### [1.0.0] (2026-06-12)

#### Features

- Added granular control over which actions are taken according to specific note labels. For example, by default, the app now reports content from users with a "Spam Watch" note but filters content from users with a "Spam Warning" note. This is fully configurable in the settings.
- Added an option to ignore mod notes past a certain age (in days).
- Altered the report/filter message slightly for better label readability (no more all-caps).

#### Bug Fixes
- Fixed an issue that caused the app to target approved users instead of exempting them.
- Fixed an issue that could cause the app to only action according to the most recent note label, ignoring older notes.
- Removed the Settings menu item at subreddit level for a cleaner menu. Settings are still accessible from developers.reddit.com.

### [0.1.2] Initial version (2026-05-21)

#### Features

Report, filter, or remove posts and/or comments from users who have mod notes on their account. Configurable by note labels (e.g., "Spam Warning" or "Ban").

#### Bug Fixes

None yet (initial version). Please send a private message to the developer (u/Chosen1PR) to report bugs.