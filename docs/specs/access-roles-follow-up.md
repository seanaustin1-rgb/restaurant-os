# Access roles follow-up

Status: flagged for later. Do not build the full invite/approval system before the demo, source-map, and advisor/portfolio story are clearer.

## Product decision

The business should own the data. The default path is owner-led setup: a business owner creates the business, connects sources, and invites helpers.

Also support real-world alternate paths later:

- Consultant/accountant creates a pending client workspace, then the owner claims or approves it.
- Investor creates an account and requests access, but cannot create or control a company's heartbeat without owner approval.
- Manager receives limited operating access from the owner or advisor.

## Current lightweight version

The app now has an Access Paths page that explains the four paths for demos:

- Business owner
- Consultant/accountant
- Investor
- Manager

This is presentation/product scaffolding only. It does not yet send invites, approve access requests, or change permissions.

## Later build

- Owner invite flow with role selection.
- Advisor-created pending client workspace.
- Owner claim/approval step for advisor-created workspaces.
- Investor access request and approval.
- Permission matrix for settings, source connections, dashboard visibility, and portfolio views.
