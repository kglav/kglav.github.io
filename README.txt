CHORES TABLET SCROLL PATCH

This patch changes only assets/chores-tablet.css.

What it fixes:
- The overall tablet page remains a fixed single-screen web app.
- The chore rows are no longer compressed to force every task onto screen.
- The checklist area scrolls internally with touch/swipe.
- There is no four-task display limit: all tasks returned from Supabase remain in the list and can be reached by scrolling.
- The Add button stays outside the scrolling area, so it remains accessible.

GitHub update:
Replace only:
  assets/chores-tablet.css

No Supabase changes are required.
