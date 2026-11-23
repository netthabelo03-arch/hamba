# Sprint 0 test cases: app shell and accounts

Run on a phone (Android and iPhone, at 360 px wide) in demo mode first, then again after Hamba is connected to Supabase (README, step 2). Record failures in `docs/defect-log.md`.

| ID | Test Scenario | Test Case Description | Test Steps | Expected Result | Actual Result |
|----|---------------|-----------------------|------------|-----------------|---------------|
| S0-01 | Home, signed out | Home matches the Hamba design | Open the app | Black screen, pink Hamba logo, Log in button, "Local brands. Your streets.", search box, Studio and Run safe cards marked Soon, "New in" with "The first shops open soon" and Create a free account. Tab bar: Home, Search, Bag, Orders, Sell. | |
| S0-02 | Tabs | Unbuilt tabs are greyed out | Tap Search, Bag, Orders and Sell | Nothing happens; each is greyed out. Home stays pink. | |
| S0-03 | Sign up | Terms must be agreed | Create a free account; enter a new email and a strong password; leave the terms box unticked; tap Create account | "Agree to the terms and privacy policy to continue." No account is created. | |
| S0-04 | Sign up | Weak password refused | Enter a password with no symbol, such as Passw0rd | The checklist shows "A symbol" still needed; the account is not created. | |
| S0-05 | Sign up | Account created | Enter a strong password (e.g. Run-Jozi-1), tick the terms, tap Create account | You land on Home, signed in: "Hi" plus your email name, a pink round button with your initial. | |
| S0-06 | Sign up | Duplicate email | Log out; sign up again with the same email | "An account with this email already exists. Log in instead." | |
| S0-07 | Log in | Wrong then right password | Log in with a wrong password, then the right one | Wrong: "Email or password is incorrect." Right: Home, signed in. | |
| S0-08 | Forgot password | Reset link | Log out; Forgot password?; enter your email; open the link (demo mode opens it at once) | The "Choose a new password" screen opens; after saving, you are on Home, signed in. Logging in with the old password then fails. | |
| S0-09 | Forgot password | No account revealed | Enter an email that has no account | The same "If an account exists…" message; no other hint. | |
| S0-10 | Profile | Save name, cell and role | Tap your initial; enter a name and 082 123 4567; choose Shop and sell; Save changes | "Saved."; the round button shows your name's initial. Reload: all still saved. | |
| S0-11 | Profile | Bad cell number | Enter 011 123 4567; Save changes | "Enter a South African cell number, like 082 123 4567." Nothing saved. | |
| S0-12 | Home as seller | Seller empty state | Go Home after choosing Shop and sell | "Get your shop ready" with what to prepare. | |
| S0-13 | Protected screen | Log-in needed for Profile | Log out; open `#/profile` | You are sent to Log in ("Log in to carry on"); after logging in you land on Profile. | |
| S0-14 | Low-data mode | No web fonts | Profile; tick Low-data mode; reload | Headings switch to the phone's own font; no font files load (check in the browser's network list on desktop). Untick to undo. | |
| S0-15 | Offline | Opens without a connection | Open the app once online; turn on airplane mode; reload | The app opens from its saved copy and shows the yellow offline bar. | |
| S0-16 | Terms and Privacy | Draft pages | Open the Terms and Privacy links | Each says it is a draft; Terms mentions the 14% commission; Privacy mentions POPIA. | |
| S0-17 | Demo mode | Demo strip | Before connecting Supabase, open Log in | A yellow strip says accounts are kept only in this browser. After connecting, the strip is gone. | |
| S0-18 | Supabase | Profile row created | After connecting, sign up; in Supabase open Table Editor, profiles | One row for the new account, role "buyer". | |
| S0-19 | Supabase | Cannot make yourself admin | In the browser console, try to update your profile's role to "admin" | Refused by the database (check constraint); role unchanged. | |
