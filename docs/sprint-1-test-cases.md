# Sprint 1 test cases: core marketplace

Run on a phone (Android and iPhone, at 360 px wide) in demo mode first, then again after running `supabase/002_shops_products.sql`. In demo mode, an account whose email starts with `admin@` is an admin. Record failures in `docs/defect-log.md`.

| ID | Test Scenario | Test Case Description | Test Steps | Expected Result | Actual Result |
|----|---------------|-----------------------|------------|-----------------|---------------|
| S1-01 | Home | New in shows the latest products | Open Home | Search box, category chips, Studio and Run safe (Soon), and the 4 newest products with shop, town and price. "See all" opens Search. | |
| S1-02 | Search | Words search name, description and shop | Search; type "running" | Only matching products (2 in demo); the count updates as you type. | |
| S1-03 | Search | Empty result is helpful | Type "boat" | "Nothing matches "boat"…" with a Clear filters button that brings everything back. | |
| S1-04 | Categories | Chips filter | Tap Beauty | Only beauty products; the Beauty chip is pink. | |
| S1-05 | Filters and sorting | Price range and sort | In Beauty, set Max 150, then sort Price: high to low | Only products up to R150; then most expensive first. Min greater than Max is swapped. | |
| S1-06 | Product | Details and stock | Open Vilakazi Low, white | Photo, category, name, price, "Only 3 left" in amber, description, shop box with delivery R80 per shop. | |
| S1-07 | Bag | Cannot add more than stock | On that product, tap + until it stops; Add to bag; open it again | + stops at 3. After adding: "Added 3 to your bag." and the button reads "All in your bag". | |
| S1-08 | Bag | Sold out | Open Night run tee, reflective | "Sold out"; the button cannot be tapped. | |
| S1-09 | Bag across shops | Delivery per shop | Add a product from a second shop; open Bag | Grouped by shop, R80 delivery under each; Delivery (2 shops) R160; total = items + R160. Badge on the Bag tab shows the count. | |
| S1-10 | Bag | Change and remove | Tap − to 1, then Remove | Totals update at once; an empty bag says "Your bag is empty" with Start shopping. | |
| S1-11 | Checkout | Log-in needed | Signed out, tap Checkout | Log in screen; after logging in you land on Checkout. | |
| S1-12 | Checkout | Required fields | Tap Save delivery details with empty fields | An error under each of the 7 fields; focus moves to the first. Typing in a field clears its error. Postal code must be 4 digits. | |
| S1-13 | Checkout | Details remembered | Fill all fields correctly; save; leave and open Checkout again | "Saved for next time"; the next time, all fields are filled in. Pay button says payment opens in Sprint 2. | |
| S1-14 | Seller sign-up | Shop application | Sell tab; Apply to sell with empty fields, then fill in correctly | Errors under each field; then the shop shows "Waiting for approval". | |
| S1-15 | Product listing | Non-image rejected | Add a product; choose a PDF | "… is not a photo. Use JPG, PNG or WebP." Nothing added. | |
| S1-16 | Product listing | Price and stock checked | Price 2, stock -1 or 1.5 | "The lowest price is R5.00."; stock must be a whole number. "You get" shows the price less 14%. | |
| S1-17 | Product listing | Photo required, then saved | Add a JPG or PNG, fill in correctly, Add product | Product page opens with your photo; shows "Your shop is not approved yet". | |
| S1-18 | Pending shop hidden | Pending shops are not shown | Search for your product's name | Not found while your shop is waiting for approval. | |
| S1-19 | Admin | Approve | Log in as admin; Profile, Admin: approve shops; Approve your shop | The shop moves to Live; its products now show in Search. | |
| S1-20 | Admin | Suspend and restore | Suspend the shop, then Restore | Suspended: its products disappear from Search and the seller sees "Suspended" with no Add button. Restore brings them back. | |
| S1-21 | Edit and hide | Seller changes a product | Sell; Edit a product, change the price; Hide another | New price shows in Search; the hidden one disappears from Search but stays in your shop list as Hidden. Show brings it back. | |
| S1-22 | Non-admin | Admin screen locked | As a normal account open `#/admin` | "Admins only". | |
| S1-23 | Low-data mode | No photos until tapped | Profile, tick Low-data mode; open Search | Uploaded product photos show "Tap to show photo" and load only when tapped. | |
| S1-24 | Supabase | Status cannot be self-approved | As a seller, in the browser console try to update your shop's status | Refused by the database; only admins can change status (through set_shop_status). | |
| S1-25 | Supabase | Photo upload limits | Try uploading a PDF renamed .jpg through the app | Refused by the storage bucket (images only, 8 MB). | |
