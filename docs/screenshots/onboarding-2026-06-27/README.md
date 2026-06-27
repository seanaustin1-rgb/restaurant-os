# Onboarding Screenshot Trail

Generated: 2026-06-27

Local folder:

`C:\Users\Default_50\.claude\onboarding-screenshots-2026-06-27`

These screenshots were captured from the local app running on `http://localhost:3227`.

## Captured

- `01-desktop-demo-tour-template-picker.png` - desktop public template picker at `/demo/tour`
- `02-mobile-demo-tour-template-picker.png` - mobile public template picker at `/demo/tour`
- `03-desktop-own-numbers-restaurant-estimate.png` - desktop restaurant own-numbers estimator at `/demo`
- `04-mobile-own-numbers-restaurant-estimate.png` - mobile restaurant own-numbers estimator at `/demo`
- `07-desktop-service-demo-estimator.png` - desktop service estimator at `/demo/service`
- `08-mobile-vacation-rental-demo-estimator.png` - mobile vacation rental estimator at `/demo/vacation-rental`

## Not Fully Captured

The real `/onboarding?new=1` route is protected behind sign-in. In a fresh headless browser it did not render the signed-in onboarding screens, so the actual authenticated onboarding flow still needs a capture pass from a logged-in browser session.

Suggested signed-in captures for Claude/design review:

- New business onboarding step 1: business name
- Step 2: industry/template selection
- Step 3: industry-specific source path, including desktop and mobile
- Existing-user onboarding hub showing business launch, source setup, access setup, and invite guidance

## Notes

- Mobile `02-mobile-demo-tour-template-picker.png` shows horizontal clipping on the template picker. That is worth reviewing before early adopter testing.
- Mobile `08-mobile-vacation-rental-demo-estimator.png` also appears clipped on the right edge. That likely needs mobile layout polish.
- These are local review artifacts only and are not committed to the application repo.
