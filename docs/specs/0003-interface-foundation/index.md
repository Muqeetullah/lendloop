# 0003. Accessible interface foundation

**Date**: 2026-11-03
**Status**: Accepted

## Summary

Give LendLoop a warm and welcoming visual foundation for neighbors. The public page introduces the board, uses the existing sign in flow, and displays the real public tool query. Shared controls and feedback states establish patterns for later lending screens.

## Requirements

- **AC-1**: The page presents LendLoop, the lending tagline, an accessible sign in control, and only the name and category returned by the public tool query.
- **AC-2**: The interface works at mobile and desktop widths, provides a skip link and visible keyboard focus, and uses semantic headings, links, buttons, lists, and labelled form controls.
- **AC-3**: Reusable controls and feedback views cover loading, empty, validation, and recoverable error states, without presenting future functionality as available now.
- **AC-4**: The interface has a light, warm cookie colored palette with accessible contrast and respects reduced motion.
- **AC-5**: Unexpected route and root layout failures show safe error messages and a recovery action without exposing raw errors.
- **AC-6**: Existing Clerk sign in and Convex account initialization continue to work.

## Decision

Use Tailwind utilities and CSS custom properties, with native HTML and small project owned components. Use a light cream and cookie palette with cocoa accents and system font stacks. Keep the light palette even when the device uses dark mode, as requested. Use a compact wordmark and a simple decorative mark drawn in code. Do not rely on external image or font services.

## Interface design

- A persistent header carries the wordmark, a link to the real tools section, and sign in or account controls.
- The hero introduces neighborhood sharing and links to the real public collection. A side panel explains how the lending process is intended to work without fabricating users, tool counts, or inventory.
- The collection shows live names and categories, a loading state, an honest empty state, or an actionable error state. A small footer closes the page.
- Buttons, form fields, labels, validation messages, and status panels are reusable. They use native semantics and do not implement placeholder actions.
- Root and route boundaries are separate so a failure in the root layout has its own document shell.

## Verification

- Build and lint the app, run existing backend tests, and inspect the page at desktop and mobile sizes.
- Verify keyboard access to the skip link, navigation, and sign in control; inspect loading and empty states.
- Exercise recoverable error components and confirm the retry action works. Check color contrast for text and control boundaries in the light palette.
- Sign in with the existing development account and confirm the account remains connected.

## Follow-up

- The full listing form, authenticated navigation, and loan actions belong to later scope items.
- Automated screen reader and cross browser testing remain desirable before production.

## Rationale

The user selected warm and welcoming, then asked for a lighter cookie palette instead of green. System fonts and locally rendered vector marks avoid extra network dependencies and keep the focus on the board. The existing public query constrains the information shown to visitors.
