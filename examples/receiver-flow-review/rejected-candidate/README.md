# Receiver Flow Review Example: Rejected Candidate

This example shows why extracted candidate drafts must not pass `review-draft`
without human rewriting.

## Expected Result

```text
review-draft input still contains blocked review markers: [CANDIDATE]
```

The rejection is intentional. `difference_found` is not the right status here;
this is a local review gate block before receiver-ready handoff creation.

