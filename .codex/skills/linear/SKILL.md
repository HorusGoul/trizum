---
name: linear
description: |
  Use Symphony's `linear_graphql` tool for raw Linear GraphQL operations during
  app-server sessions.
---

# Linear GraphQL

Use the `linear_graphql` tool exposed by Symphony's app-server session. It reuses Symphony's configured Linear auth.

## Tool input

```json
{
  "query": "query or mutation document",
  "variables": {
    "optional": "graphql variables object"
  }
}
```

## Rules

- Send one GraphQL operation per tool call.
- Treat a top-level `errors` array as a failed operation.
- Keep queries and mutations narrowly scoped.

## Common operations

### Fetch an issue by key

```graphql
query IssueByKey($key: String!) {
  issue(id: $key) {
    id
    identifier
    title
    branchName
    url
    description
    state {
      id
      name
      type
    }
    project {
      id
      name
    }
    attachments {
      nodes {
        id
        title
        url
        sourceType
      }
    }
  }
}
```

### Fetch team states for an issue

```graphql
query IssueTeamStates($id: String!) {
  issue(id: $id) {
    id
    team {
      id
      key
      name
      states {
        nodes {
          id
          name
          type
        }
      }
    }
  }
}
```

### Create a comment

```graphql
mutation CreateComment($issueId: String!, $body: String!) {
  commentCreate(input: { issueId: $issueId, body: $body }) {
    success
    comment {
      id
      url
    }
  }
}
```

### Update an existing comment

```graphql
mutation UpdateComment($id: String!, $body: String!) {
  commentUpdate(id: $id, input: { body: $body }) {
    success
    comment {
      id
      body
    }
  }
}
```

### Move an issue to another state

```graphql
mutation MoveIssueToState($id: String!, $stateId: String!) {
  issueUpdate(id: $id, input: { stateId: $stateId }) {
    success
    issue {
      id
      identifier
      state {
        id
        name
      }
    }
  }
}
```
