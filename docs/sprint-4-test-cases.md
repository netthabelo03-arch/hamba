# Sprint 4 test cases: Studio and Run safe

Run on two phones (or a phone and a computer) in demo mode first, then again after running `supabase/004_community.sql`. Live location must be tested on the live app on real phones, outdoors. In demo mode, an email starting with `admin@` is an admin, and a buddy link only works in the browser that started the share.

| ID | Test Scenario | Test Case Description | Test Steps | Expected Result | Actual Result |
|----|---------------|-----------------------|------------|-----------------|---------------|
| S4-01 | Studio | Opens from Home | Tap the Studio card | Studio shows designs with votes "of 500", a pink progress bar, Vote buttons and the "made and selling" banner. | |
| S4-02 | Studio | Log in to vote | Signed out, tap Vote | Log in screen; after logging in you come back to Studio. | |
| S4-03 | Studio | One vote per member | Tap Vote, then tap Voted | Count goes up by 1 and the button turns pink "Voted"; tapping again takes the vote back. Reload: still correct. | |
| S4-04 | Studio | No self-votes | Open Studio as the designer of an open design | The button says "Yours" and cannot be tapped. | |
| S4-05 | Studio | Sort | Tap Newest, then Most votes | Order changes. | |
| S4-06 | Submit design | Required fields | Submit with nothing filled in | Errors for picture, name, kind, description and the own-work tick. | |
| S4-07 | Submit design | Crop and send | Add a picture (cropper opens), fill in, tick own work, Send for review | Back on Studio; "Your designs" shows it as "Waiting for review". It is not in the vote list yet. | |
| S4-08 | Admin: designs | Open for votes / reject | Admin, Designs; Open for votes on one, Reject another (a note is required) | Opened design appears in Studio. Rejected shows "Not approved" and "To fix: …" to the designer. | |
| S4-09 | Admin: designs | Goal reached | When a design reaches 500 votes | Admin sees "Reached the goal" and Mark as made; once made, Studio shows "… is made and selling" and the designer earns 5% (paid out once payments open). | |
| S4-10 | Run safe | Opens from Home | Tap the Run safe card | Share my run card, area filter, crews and rated routes. | |
| S4-11 | Crews | Join and leave | Tap Join, then Joined | Runner count goes up by 1, then back down. | |
| S4-12 | Crews | Start a crew | Start a crew with no days, then fill in correctly | "Choose at least one day"; then the crew shows with its schedule (e.g. "Sat 05:30") and you as its first runner. | |
| S4-13 | Routes | % felt safe, one answer each | Tap Yes on a route, then No | The % and count change; changing your answer does not add a second one. | |
| S4-14 | Routes | Add a route | Add a route with distance "5,5" | Shows 5.5 km and "0 of 3 answers"; the % appears after 3 runners answer. | |
| S4-15 | Live share | Start | Run safe, Start sharing my location, Start sharing; allow location | "Sharing live", last sent time and accuracy; a private link with Copy and Send on WhatsApp. | |
| S4-16 | Live share | Buddy sees the run | Open the link on another phone (no account) | "[Name]'s run", "Updated just now", the coordinates, a map and Open in Google Maps. Updates within 30 seconds as the runner moves. | |
| S4-17 | SOS | Alert | Tap SOS | Runner sees "SOS is on" with 10111, 112 and 10177. Within 10 seconds the buddy page shows a red "SOS: [Name] needs help" box. "I'm safe" removes it. | |
| S4-18 | Live share | Signal lost | Runner locks the phone for 3 minutes | Buddy page shows "No update for a while…". | |
| S4-19 | Live share | End deletes the location | Tap End sharing and delete my location | Within 10 seconds the buddy page says "This run has ended". In Supabase, the live_shares row is gone. | |
| S4-20 | Live share | Wrong or old link | Open a made-up link, or one older than 4 hours | "This run has ended". | |
| S4-21 | Reports | Report a design, crew or route | Tap Report, choose a reason, Send report | "Thanks. Hamba will look at it." The same member cannot report the same item twice. | |
| S4-22 | Reports | Hidden after 3 reports | Report one route from 3 accounts | It disappears from Run safe and shows in Admin, Reports as hidden. | |
| S4-23 | Admin: reports | Decide | Tap Keep it (or Hide it) | Keep it brings it back; Hide it keeps it hidden. The report leaves the list. | |
| S4-24 | Supabase | Privacy | As a shopper, try to read design_votes, crew_members or route_ratings of other members | Only your own rows come back; totals come from the count functions. | |
| S4-25 | Supabase | Share privacy | Call get_live_share with a wrong code | Nothing returned; the account id is never returned. | |
