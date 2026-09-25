# Keep Party Boost server-authoritative

trizum will keep Party Boost ownership and selection in server-authoritative
account data rather than in the shared Automerge party document. The server
will verify the owner's Premium status and enforce one selected party per
owner, one active boost per party, continued party membership, and the
seven-day transfer interval. Clients may keep the last known result while
offline and revalidate it when online. This adds an online dependency to boost
changes, but prevents collaborators from editing paid access through shared
party state and gives every device a consistent decision.
