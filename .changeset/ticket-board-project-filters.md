---
"agent-org": minor
---

Ticket mode reads each ticket's repository from its title, `<type>(<scope>): <what>`, where the scope is a repository in `clones` or a package under one's `packages/` on its default branch. The board lists the repository beside each ticket, and a ticket whose title names neither cannot be queued until it is retitled. The Pick tab's repositories bar is gone, and `POST /api/queue` no longer takes `repos`. The Pick tab also filters by Linear project (several at once, with counts) beside the search and folds each status group, both remembered in the browser.
