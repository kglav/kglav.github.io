# Keith & Jah shared site - routine configuration version

This package keeps the existing calendar and game catalogue, retains the lightweight password (`jokes`), and adds a Supabase-backed **Routine Settings** page at `config.html`.

## Important: existing calendar table is unchanged

The site still uses `public.calendar_entries` for dated / ad-hoc events. The Add calendar entry button on the home page still creates and edits those rows using the existing schema (`id`, `event_date`, `title`, `applies_to`, `other_name`, `written_by`, `event_time`, `notes`, `created_at`). **Do not delete or rebuild that table.**

## Add the recurring task table in Supabase

1. Open your Supabase project.
2. Open **SQL Editor**.
3. Choose **New query**.
4. Open `recurring-tasks-setup.sql` from this package, copy all of it, and paste it into the query editor.
5. Click **Run** once.
6. In **Table Editor**, you should now see `recurring_tasks`.
7. Open the deployed site's `config.html` (or use the gear button on the home page). It should report that the routine is connected.

The SQL creates only `public.recurring_tasks`, enables the browser permissions needed by this password-gated preview site, and seeds it with the routine that was previously hard-coded. The seed runs only if the table is empty, so re-running the script later will not duplicate your tasks.

## Routine Settings page

The small gear button at the bottom-right of the home calendar opens the settings page. From there you can add, edit, enable/disable or delete repeating tasks. Changes are read directly by the home calendar, so changing kayaking from Tuesday to Wednesday only requires editing the task's Day field. Week-specific items can be set to Every week, Week A only or Week B only.

If `recurring_tasks` has not been created yet, the home page deliberately falls back to the previous built-in routine so the calendar remains usable. Once the table exists, Supabase becomes the source of truth for the recurring timetable.

---

# Keith and Jah combined calendar and game catalogue

This folder is a static GitHub Pages site with two pages:

- `index.html` - the main household calendar and Week A / Week B timetable.
- `games.html` - the game catalogue, reached from the small controller link at the bottom-right of the calendar.

The site has no build step. It uses normal HTML, CSS and JavaScript plus the Supabase JavaScript browser client.

## Included Supabase configuration

`assets/supabase-config.js` already contains the supplied project URL and publishable key:

- Project: `https://uasodyhfuyidlwojcugp.supabase.co`
- Key type: Supabase publishable key

Do not replace this with a secret key or a `service_role` key. Browser code must use only the public/publishable key.

## Existing calendar table

The combined site does not include SQL that changes `public.calendar_entries`.

The calendar page deliberately loads the existing table with:

```js
.select("*")
```

It does not request an `event_time` column explicitly, so the previous schema-cache error caused by that hard-coded column is avoided.

For display and editing, the calendar adapter recognises these common existing column names:

| Meaning | Recognised columns |
| --- | --- |
| Record ID | `id`, `entry_id`, `calendar_entry_id`, `uuid` |
| Title | `title`, `event_title`, `name`, `summary` |
| Date | `event_date`, `entry_date`, `date`, `calendar_date`, `start_date`, `starts_at`, `start_at` |
| Time | `event_time`, `start_time`, `time`, `starts_at`, `start_at` |
| Notes | `notes`, `description`, `details`, `detail` |
| Category | `category`, `event_category`, `type` |
| Person | `person`, `owner`, `assigned_to`, `member` |

When the table already contains at least one row, the page learns its real columns from that row. When the table is empty, the first insert tries several common calendar schemas without changing the table.

If the current table has a different required column that is not listed above, existing entries can still load, but adding a new entry may report that the required column is unrecognised.

## Add the game tables

The catalogue needs its own tables because game records do not fit the calendar schema.

1. Open the Supabase dashboard.
2. Open **SQL Editor**.
3. Copy and run all of `game-library-setup.sql` once.
4. Refresh `games.html`.

The SQL file creates only:

- `public.games`
- `public.game_platforms`

It does not alter `public.calendar_entries`.

The catalogue uses cover image URLs rather than uploads. This avoids needing a Supabase Storage bucket and its separate storage policies. When no URL is supplied, the page creates a styled text cover automatically.

## Publish on GitHub Pages

1. Put every file and the `assets` folder at the root of the repository, preserving the folder structure.
2. Commit and push the files.
3. In the repository, open **Settings > Pages**.
4. Choose the branch and root folder that contain `index.html`.
5. Open the published site after GitHub Pages completes the deployment.

Relative links are used throughout, so the site works both at a user-site URL and inside a project repository path.

## Public editing warning

There is no login screen. The supplied game SQL allows the Supabase `anon` role to read and write the game tables so the static page can work directly from GitHub Pages.

That means anyone who can open the public site can also add, change or delete game data. The calendar page continues to use whatever RLS policies already exist on `calendar_entries`.

For restricted editing later, add Supabase Auth and replace the public game policies with user-specific policies.

## Files

```text
.
|-- .nojekyll
|-- index.html
|-- games.html
|-- game-library-setup.sql
|-- README.md
`-- assets
    |-- site.css
    |-- supabase-config.js
    |-- calendar.js
    `-- games.js
```

## Troubleshooting

### Calendar entries load, but saving fails

The table probably has a required column outside the recognised aliases above, or its RLS policy allows reads but not inserts/updates. The error shown in the calendar connection bar or form should identify which case applies.

### Game page says the tables are not ready

Run `game-library-setup.sql` in the same Supabase project used by `assets/supabase-config.js`, then refresh the page.

### Both pages say the browser library did not load

The Supabase JavaScript library is loaded from jsDelivr. Check the browser connection, content blockers and console, then refresh.

### Data can be read but not changed

Check the table's Row Level Security policies and grants. Re-running `game-library-setup.sql` safely recreates the game policies and does not touch the calendar table.


## Existing calendar schema support

This build explicitly supports the existing `calendar_entries` columns:
`id`, `event_date`, `title`, `applies_to`, `other_name`, `written_by`, `event_time`, `notes`, and `created_at`.
The calendar form maps its Person field to `applies_to`; a blank Person is stored as `Everyone`. New rows use `Website` for `written_by` when that column is present. Existing `written_by` values are not overwritten when editing an entry.

## Shared password gate

This package includes a lightweight browser-side password gate on both the calendar and game catalogue.

- Current password: `weekpreview`
- A successful unlock is remembered in that browser for 7 days.
- Use the small **Lock** button at the bottom-left to lock the site again immediately.
- The password itself is not stored as plain text in the site; `assets/auth.js` contains only its SHA-256 hash.

This is intentionally only a first-line privacy measure for a static GitHub Pages preview. A determined technical user can still bypass client-side protection by inspecting or changing the site's JavaScript.
