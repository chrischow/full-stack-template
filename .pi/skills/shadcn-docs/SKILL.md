---
name: shadcn-docs
description: Looks up a component in the shadcn documentation.
argument-hint: component
---

# shadcn Docs

Peform the following steps in sequence:

1. Look up the specified component $component using the `shadcn_docs` tool.
2. If this returns URLs to the documentation, use the `fetch_url` tool to read the API documentation.
3. Otherwise, attempt to find the correct name for the component by searching the component $component using the `shadcn_search` tool.
   1. If the results clearly point to a single component, extract the component name (e.g. in `@shadcn/dropdown-menu-example (example)`, the component name is `dropdown-menu`), and use the name in Steps 1 and 2 to get the documentation.
   2. If the results point to multiple possible components that the user could be referring to, show the results to the user and ask for the component name to lookup. Use that name in Steps 1 and 2 to get the documentation.
   3. Otherwise if there are no results, terminate immediately, stating that the component was not found.
