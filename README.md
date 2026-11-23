# Hamba

Shop South African brands and makers, vote on new designs in Studio, and run safe with your crew. Black and pink, phone first, low-data friendly.

Phone-first web app: plain HTML, CSS and JavaScript (no build step), Supabase for accounts and data (free plan to start), GitHub Pages for hosting. Built sprint by sprint, like Street Property.

## Sprint 2 (this version): trust before going live

- **Seller checks:** applying to sell needs a photo of the ID, a selfie holding the ID, and a photo of the products with a "Hamba" + date note. These are private (admins only) and deleted as soon as the shop is approved or declined (POPIA).
- **Admin shop check:** the photos, a Call button, the call guide (what they sell, where they make or buy it, how they courier), a call notes box that saves itself, and a 4-point checklist. Approve stays greyed out until every point is ticked. Notes and the checklist are kept.
- **Every product is reviewed:** new products wait in "Products to review". Changing a live product's name, description, category or photos sends it back; price, stock and hiding do not. Rejections need a reason, which the seller sees.
- **Big-brand flag:** listings that mention Nike, Adidas, Gucci and other often-faked brands show a warning to the seller and to the reviewer.
- **Categories like Shein:** 12 departments with their own types, "Who is it for" (optional), and "Something else" with the seller's own words, so nobody is boxed in. Search has type chips and a Women/Men/Kids filter.
- **Photo cropping:** each photo opens in a cropper (drag, pinch or slide to zoom, Show whole photo, Fill the square) and is saved as a 1200 × 1200 square. "Make main" reorders photos.
- **New seller limits:** up to 20 products now; R5 000 in sales and tracked courier only apply once orders open. They lift after 5 delivered orders.
- Database: `supabase/003_trust.sql`. Test cases: `docs/sprint-2-test-cases.md`. Automated checks: `npm test` (52 tests).

## Sprint 1: core marketplace

- **Search** (Shop): words, category chips, a price range and sorting; a helpful message when nothing matches.
- **Products:** photos you can swipe, price, stock ("Only 3 left", "Sold out"), shop and delivery.
- **Bag across several shops:** grouped by shop, R80 delivery per shop, never more than the stock, totals that update as you change it. A badge on the Bag tab shows the count.
- **Checkout, step 1:** delivery details (all required, South African cell number, 4-digit postal code, province), remembered for the next order. Paying arrives in Sprint 2.
- **Sell:** apply to open a shop (it waits for approval), add and edit products with up to 4 photos (JPG, PNG or WebP, up to 8 MB, shrunk before upload), see what you keep after the 14% commission, hide and show products.
- **Admin:** approve, decline, suspend and restore shops. Pending and suspended shops are hidden from shoppers.
- **Low-data mode:** uploaded product photos wait for a tap.
- Demo mode has 4 sample shops and 10 products. An account whose email starts with `admin@` is an admin in demo mode.
- Database: `supabase/002_shops_products.sql`. Test cases: `docs/sprint-1-test-cases.md`.

## Sprint 0: app shell and accounts

- **Home** as in the Hamba screens: logo, search box, Studio and Run safe cards (marked Soon), "New in" with an empty state that changes for visitors, buyers and sellers. Tab bar: Home, Search, Bag, Orders, Sell (the last four greyed out until their sprint).
- **Accounts:** sign up (email, strong password with a live checklist, agree to terms), log in, log out, forgot password, choose a new password.
- **Profile:** name, South African cell number, "Shop" or "Shop and sell", order emails on or off.
- **Low-data mode** (Profile, "This phone"): loads no web fonts; from Sprint 1 it also holds back product photos until tapped.
- **Works offline** once opened, with a yellow bar while offline. Installable on the home screen.
- **Draft Terms and Privacy** pages (to be replaced by lawyer-reviewed versions in Sprint 4).
- **Demo mode:** until `src/config.js` is filled in, accounts are kept only in the browser, so every screen can be tried now.
- Database: `supabase/001_profiles.sql`. Test cases: `docs/sprint-0-test-cases.md`.

## Setup

1. **Put the code on GitHub.** Create an empty public repository called `hamba`, upload these files, then in Settings, Pages choose "Deploy from a branch", `main`, `/ (root)`. The app goes live at `https://<your-user>.github.io/hamba/`.
2. **Connect Supabase (free plan).**
   - Create a project at supabase.com (region: closest to South Africa).
   - SQL Editor: paste `supabase/001_profiles.sql`, Run. Then the same for `supabase/002_shops_products.sql` and `supabase/003_trust.sql`, in that order (they also make the photo storage buckets).
   - Authentication, URL Configuration: set the Site URL to the live address from step 1 and add it under Redirect URLs.
   - Project Settings, API Keys: copy the Project URL and the **publishable** key into `src/config.js`. Never the secret key.
   - Run `npm run stamp`, then upload the changed files.
3. **Make yourself an admin** (for approving shops from Sprint 1): Authentication, Users, copy your user id, then in the SQL Editor:
   `insert into public.admins (user_id) values ('<your user id>');`

Before every upload: `npm test`, then `npm run stamp` if any file in `src/` changed (a test fails if you forget).

## Coming next

- **Sprint 3:** PayFast and Paystack checkout, wallets, payouts (with the bank name checked against the ID), refunds, order emails, and the R5 000 and tracked-courier limits.
- **Sprint 4:** Studio (designs, votes, royalties) and Run safe (crews, safe routes, live location, SOS).
