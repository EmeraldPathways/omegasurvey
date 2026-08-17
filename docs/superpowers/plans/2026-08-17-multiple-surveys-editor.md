# Plan: Multiple surveys and editable questionnaires

## Goal

Allow administrators to create and switch between independent surveys, edit each survey's title and questions, and choose the response type for each question without breaking existing recipient links.

## Design

- Reuse the existing `surveys`, `recipients`, and `responses` tables, scoping dashboard, recipient import, invitation sending, and response export by the selected survey id.
- Store the editable questionnaire as validated JSON in `surveys.questions_json`, preserving stable question ids so existing responses remain readable.
- Add a protected admin surveys API for creating and updating survey definitions.
- Resolve public survey links through the recipient's survey instead of the default survey, so every invitation renders and validates its own question set.
- Add a survey selector, create-survey modal, and question editor to the existing Settings view. Supported response types remain single choice, 1–10 rating, and long text, with editable choice options and required/optional state.

## Implementation steps

1. Add shared survey question normalization and survey lookup helpers.
2. Make overview, recipient import, invitation sending, and public token routes survey-aware.
3. Add the protected create/update surveys endpoint.
4. Add the admin survey selector and questionnaire editor using the current visual system.
5. Add focused tests for question normalization and survey-aware source behavior, then run the full build/test checks.
6. Commit the focused changes, push the GitHub branch/main target requested by the user, package the verified artifact, and deploy it to the existing public Sites project.

## Verification

- `npm.cmd test` using the workspace's Node 24 path.
- `npm.cmd exec -- tsc --noEmit` with pre-existing Cloudflare ambient-type errors noted separately if unchanged.
- Sites artifact validation and a successful public deployment status.
