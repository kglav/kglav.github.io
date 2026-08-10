KEITH & JAH FAMILY PLANNER - GITHUB PAGES + SUPABASE
====================================================

FILES TO PUT IN YOUR GITHUB PAGES REPOSITORY
---------------------------------------------
index.html
calendar.html
supabase-config.js

SET UP SUPABASE
---------------
1. Create a Supabase project.
2. In the Supabase dashboard, open SQL Editor.
3. Copy all of supabase-setup.sql into the editor and run it once.
4. Open your project's Connect dialog or Settings -> API Keys.
5. Copy:
   - Project URL
   - Publishable key (normally starts sb_publishable_...)
6. Open supabase-config.js and replace:
   https://YOUR_PROJECT.supabase.co
   YOUR_PUBLISHABLE_KEY
7. Commit index.html, calendar.html and supabase-config.js to your GitHub Pages repository.
8. Open the GitHub Pages site and test adding an entry. Refresh the page to confirm it remains.

IMPORTANT SECURITY NOTE
-----------------------
This version deliberately has no login, as requested.

That means the Supabase 'anon' browser role is allowed to read, add, edit and delete every row in calendar_entries. The Publishable key is designed to be used in browser code, but the database permissions are still public according to the Row Level Security policies you create.

Do NOT put a Supabase Secret key or legacy service_role key in supabase-config.js or anywhere in your GitHub repository.

If the GitHub Pages URL is public, a technically knowledgeable visitor could potentially use the site's public Supabase credentials to alter the family calendar. If you later want the calendar protected, add Supabase Auth and change the RLS policies to authenticated users only.

HOW IT WORKS
------------
- GitHub Pages hosts only the static HTML/JS files.
- calendar.html loads supabase-js from the official documented CDN pattern.
- The browser connects directly to your Supabase Postgres table using the Project URL + Publishable key.
- All adds, edits and deletes persist in Supabase and appear on other devices.
- No Python server, SQLite DB, Node server, or GitHub Actions are required.

WEEK SELECTOR
-------------
The week dropdown displays Monday-Sunday date ranges rather than week numbers.
Example: ISO week 19 of 2027 displays "10 May - 16 May 2027".
