# Deductible and Out-of-Pocket Tracker

A simple tool (HTML, CSS, JavaScript) to log medical claims and track progress toward the annual deductible and out-of-pocket maximum. Estimates only, not a replacement for your Explanation of Benefits.

## Run
Open `index.html` in any browser. No build step or dependencies. Data is saved in the browser (localStorage).

## Files
- `index.html` - page layout and forms
- `style.css` - styling (light and dark mode)
- `script.js` - `processClaims()` logic, rendering, validation, storage

## Claim types
- Standard: applies to the deductible first, then coinsurance on the remainder
- Copay: you pay a flat copay (counts toward out-of-pocket, not the deductible)
- Preventive: covered 100%

## Formula (standard claim)
to deductible = min(remaining deductible, allowed amount)
you pay = to deductible + (allowed - to deductible) x coinsurance %
you pay never exceeds the remaining out-of-pocket maximum

Claims are processed in date order.
