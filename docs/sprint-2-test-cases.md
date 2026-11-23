# Sprint 2 test cases: trust before going live

Run on a phone in demo mode first, then again after running `supabase/003_trust.sql`. In demo mode, an account whose email starts with `admin@` is an admin. Record failures in `docs/defect-log.md`.

| ID | Test Scenario | Test Case Description | Test Steps | Expected Result | Actual Result |
|----|---------------|-----------------------|------------|-----------------|---------------|
| S2-01 | Seller application | All 3 photos required | Sell; fill the shop details; tap Apply to sell without photos | An error under each: ID photo, selfie holding the ID, products with the "Hamba" note. No shop is opened. | |
| S2-02 | Seller application | Only photos accepted | Choose a PDF as the ID photo | "… is not a photo. Use JPG, PNG or WebP." | |
| S2-03 | Seller application | Application sent | Add all 3 photos (a preview shows for each); Apply to sell | Shop shows "Waiting for approval", with the New seller limits box. | |
| S2-04 | Seller application | Photos missing after a failed upload | Open a shop whose photos did not arrive | Sell shows "Photos needed" with the 3 pickers and Send photos. | |
| S2-05 | Admin: shop check | Photos and call guide | Admin; Shops | The pending shop shows the ID, selfie and stock photo (tap to open large), a Call button with the number, and the 3 call questions: what they sell, where they make or buy it, how they courier. | |
| S2-06 | Admin: shop check | Call notes are kept | Type notes while on the call; leave the page and come back | "Notes saved" appears; the notes are still there. | |
| S2-07 | Admin: shop check | Approve needs every tick | Tick 3 of the 4 checks | Approve shop stays greyed out until all 4 are ticked. | |
| S2-08 | Admin: shop check | Approving deletes ID photos | Tick all 4; Approve shop | Shop moves to Live with "checked [date], ID photos deleted" and the call notes. The photos can no longer be opened. | |
| S2-09 | Admin: shop check | Decline | Decline a pending shop | It moves to Suspended or declined; photos deleted; notes kept. | |
| S2-10 | Categories | Departments and types | Add a product; choose Clothing | A Type list appears (Tops & tees, Dresses, Traditional & heritage wear…) with "Something else (type your own)" at the end. | |
| S2-11 | Categories | Never boxed in | Choose "Something else (type your own)", or the Something else department | A box asks "What kind of product is it?"; the seller's own words become the product's type and show on the product page. | |
| S2-12 | Categories | Who it is for | Set Who is it for to Women | Search with "Women" chosen shows it; "Everyone" products also show for Women and for Men. | |
| S2-13 | Photo crop | Cropper opens after choosing a photo | Add photo; choose a wide photo | "Crop your photo" opens with the photo filling a square. | |
| S2-14 | Photo crop | Move and zoom | Drag the photo; slide the zoom; pinch on a phone; tap Show whole photo, then Fill the square | The square is always covered when zoomed in; Show whole photo shows it all on white. | |
| S2-15 | Photo crop | Result | Tap Use photo | The tile shows the cropped square; saved photos are 1200 × 1200. Cancel adds nothing. "Make main" moves a photo to first. | |
| S2-16 | Brand check | Big-brand warning | Type "Nike" in the name or description | A warning says proof is needed (invoice or reseller letter); it goes when the brand is removed. | |
| S2-17 | Product approval | New products wait | Save a new product | "Waiting for review" on the product and in the seller's list; it does not show in Search, even in a live shop. | |
| S2-18 | Product approval | Admin approves | Admin; Products to review; Approve | The product shows in Search. | |
| S2-19 | Product approval | Admin rejects with a reason | Tap Reject with no note, then with a note | No note: "Say what the seller must fix…". With a note: the seller sees "Not approved" and "To fix: …". | |
| S2-20 | Product approval | Changes that need review | Edit a live product's price or stock | Stays live. | |
| S2-21 | Product approval | Changes that need review | Edit a live product's name, description, category or photos | Goes back to "Waiting for review" and disappears from Search until approved. | |
| S2-22 | New seller limits | 20 products | As a new seller, add a 21st product (rejected ones do not count) | "Product limit reached"; the Add a product button is replaced by a warning. | |
| S2-23 | New seller limits | Limits shown | Open Sell | The New seller limits box lists 20 products, R5 000 in sales, tracked courier only, lifting after 5 delivered orders. | |
| S2-24 | Supabase | Sellers cannot approve their own products | As a seller, in the browser console, update a product's status to approved | Refused (sellers cannot write the status column). | |
| S2-25 | Supabase | ID photos are private | As a seller or a shopper, open a seller-checks file address | Refused; only admins can open them, through links that expire after 10 minutes. | |
