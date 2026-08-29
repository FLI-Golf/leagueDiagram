# LeagueDiogram

LeagueDiogram is a working prototype and architectural blueprint for a sports league management and fantasy platform. The goal is to demonstrate how a team can build this system using object-oriented design, clear domain models, and route-driven UI flows without starting from scratch.

This project is intentionally lightweight and front-end focused. It is designed to show the structure, relationships, and behaviors that a future engineering team would use to turn the concept into a production product.

## Purpose

This app is meant to save time and cost by proving the core business model, domain entities, and interactions before a larger team invests in a full production implementation. Instead of paying a team to reinvent the architecture, this repo acts as a concrete blueprint that shows how the system can be organized.

The key idea is simple:

- demonstrate the domain model clearly
- make the league, teams, pros, fantasy roles, and schedules understandable
- show how object-oriented patterns can support future implementation
- reduce the amount of design work a downstream team would need to recreate from scratch

## Included examples

- league and team structure
- pro athlete rosters and reserve players
- role-based access patterns such as admin, scorekeeper, fantasy owner, and pro
- mock current-user switching for UI development
- simple fan-post content flow for pro profiles
- route-based views for teams and pros

## Notes

This is not yet a full authentication system or backend. Instead, the app uses a mock current-user helper to simulate different user roles while the product is being designed and discussed. That keeps the prototype interactive while preserving a clean path to later replacing the mock with real auth and persistence.

## Getting started

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Then open the local Vite URL in the browser.

