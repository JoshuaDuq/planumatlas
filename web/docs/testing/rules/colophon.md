# Colophon rules

Scope: chunk H4 (#42), the colophon: the status bar at the foot of a wide window. It holds the not-clinical statement, a description of what is loaded, the region or bundle count, Feedback and the Provenance opener. The feedback form, which the ⋯ menu also opens as a dialog on a phone, and the Worker it posts to are under Feedback below. The Provenance dialog is in `provenance.md`. What feeds it (status, the tract reference, whether the data bar shows a download) is the composition's (`regions.md`). Legacy sources: the root `index.html:592-597`, `viewer/ui/chrome/header.js:78-90, 536-542`, `viewer/styles/masthead.css:453-492`, `viewer/styles/phone.css:48-49`, `viewer/ui/chrome/chrome.contract.test.js:283-303`. New code: `web/src/features/colophon/{Colophon.svelte,region-count.ts,FeedbackMenu.svelte,FeedbackDialog.svelte,FeedbackForm.svelte,feedback.ts}`, the Worker `workers/feedback/src/index.ts`, `colophonParts` in `web/src/lib/core/panels/header.ts`, the coarse-pointer `--footer-height` rule in `web/src/app/layout.css`. Deviation: `h4-coarse-target.md`.

Copy quoted is the English interface text unless marked FR. English sets a percent close up ("25%"). French puts a narrow no-break space before it ("25 %").

## Content

### COLO-01 · The status bar opens with the not-clinical statement, which never gives way

- **Rule:** The status bar reads, in order: the statement that this is not clinical anatomy, the description of what is loaded, the count, then the Provenance button. The statement never truncates. The description is what gives way, with an ellipsis.
- **Kind:** behaviour
- **Level:** browser: text order and layout (truncation)
- **Source:** `index.html:592-596`; `chrome.contract.test.js:283-296` (the statement leads, ahead of the description that truncates); `viewer/styles/masthead.css:453-492`
- **Expected:** text "Not clinical anatomy Bert · one individual’s MRI reconstruction 12 visible regions Provenance" (FR statement "Pas une anatomie clinique"). With a description wider than the bar, the statement's `scrollWidth === clientWidth` and the description has `text-overflow: ellipsis` with `scrollWidth > clientWidth`.
- **Covered by:** `src/lib/core/panels/header.test.ts` (R, `COLO-01`: the statement in each language and state); `src/features/provenance/provenance.svelte.test.ts` (R, order and the French statement); truncation is uncovered

### COLO-02 · The description names what is loaded, as the masthead names it

- **Rule:** The description names the subject as the masthead names it (MAST-28), then what kind of anatomy it is. A tract reference is named as reference data. Before anything has loaded there is no description, and the statement stays in every state.
- **Kind:** behaviour
- **Level:** unit (view-model `colophonParts`)
- **Source:** `header.js:78-84`; `chrome.contract.test.js:283-296`
- **Expected:** `{display_name:'SNAIL “subj_1”', individual:true}` → "SNAIL subj_1 · one individual’s MRI reconstruction" (FR "SNAIL subj_1 · reconstruction IRM d’un individu"). `individual:false` → "… · averaged reference template" (FR "gabarit de référence moyenné"). `reference {label:'Ref'}` → "Ref · reference data" (FR "Ref · données de référence"). Nothing loaded → `''`. Statement "Not clinical anatomy" / "Pas une anatomie clinique" in all three cases. The published build shows "MGH CDMD sub_013 · one individual’s MRI reconstruction".
- **Covered by:** `src/lib/core/panels/header.test.ts` (R, `COLO-02`: the exact description for an individual, a template and a reference, in both languages); `src/features/provenance/provenance.svelte.test.ts` (R)

### COLO-03 · The count says how many regions are visible, in each language's plural

- **Rule:** On the anatomy the count is the number of regions drawn, said to be the visible ones, with the right plural. In Tracts mode it names the bundles instead, whatever is loading. Before the first model is ready there is no count.
- **Kind:** behaviour
- **Level:** unit (`regionCountText`)
- **Source:** `header.js:537-541`; `chrome.contract.test.js:298-303`
- **Expected:** 1 → "1 visible region"; 3 → "3 visible regions"; 228 → "228 visible regions"; FR 3 → "3 régions visibles", 1 → "1 région visible". Tracts text "72 bundles" with status `switching` → "72 bundles". Status `loading` → `''`.
- **Covered by:** `src/features/colophon/region-count.test.ts` (R)

### COLO-04 · A download the data bar is not showing is shown in the count

- **Rule:** While a download runs that the data bar is not already showing in one of its fields (a link, or a command from elsewhere), the count shows its progress. When a data-bar field holds the pending choice, the count keeps counting regions.
- **Kind:** behaviour
- **Level:** unit (`regionCountText`); the `choosing` flag comes from the data bar through the composition (REGION-17)
- **Source:** `header.js:537-541`
- **Expected:** status `switching`, progress 1/4, `choosing:false` → "Loading 25%" (FR "Chargement 25 %"); no total → "Loading…". `choosing:true` → "3 visible regions".
- **Covered by:** `src/features/colophon/region-count.test.ts` (R; the progress case only matches `/25/`)

## The opener and the bar

### COLO-05 · The Provenance button opens a dialog, once one can be opened

- **Rule:** The status bar ends with a "Provenance" button that says it opens a dialog. It is there only when the page can open the sheet. Legacy shipped it hidden until boot.
- **Kind:** accessibility
- **Level:** browser: role and attribute
- **Source:** `index.html:595`; `chrome.contract.test.js:311-315` (a dialog, not a raw JSON file); `viewer/ui/panels/provenance.js:183-186`
- **Expected:** button "Provenance" (FR "Provenance") with `aria-haspopup="dialog"`. With no opener supplied, no button.
- **Covered by:** `src/features/provenance/provenance.svelte.test.ts` (R for the name and attribute; I for "only when the owner supplies an opener", a component-prop contract)

### COLO-06 · The Provenance target is 24 px on a fine pointer and 44 px on a coarse one

- **Rule:** With a fine pointer the status bar is 32 px tall and the button 24 px. With a coarse pointer, at any width, the bar is 45 px: a 1 px rule above a 44 px button that fills it. The page does not scroll because of it.
- **Kind:** accessibility
- **Level:** browser: layout under touch emulation
- **Source:** deviation `h4-coarse-target.md`; legacy `viewer/styles/masthead.css` (`#provenance` 24 px at every width)
- **Expected:** fine pointer at 1280×800 → button height 24. Touch emulation at 1180×820 inside `#app` → footer height 45, button height 44, button top = footer top + 1, `elementFromPoint` inside the button hits it, `scrollHeight ≤ clientHeight`.
- **Covered by:** `src/features/provenance/provenance.svelte.test.ts` (R, 2 cases)

### COLO-07 · The status bar is a plain footer, not a live region

- **Rule:** The status bar is the page's `contentinfo` landmark and is not live. Its count changes are visual; mode and selection changes are said by the announcer.
- **Kind:** accessibility
- **Level:** browser: roles
- **Source:** `index.html:592`; `web/src/features/colophon/Colophon.svelte` header note
- **Expected:** `footer#colophon` is the one `contentinfo`; neither it nor any descendant has `role="status"` or `aria-live`.
- **Covered by:** uncovered (the footer's presence only, in `provenance.svelte.test.ts`)

### COLO-08 · On a phone the status bar gives way

- **Rule:** Under the phone query the status bar is hidden. The statement moves to the sheet's grip and Provenance to the ⋯ menu.
- **Kind:** behaviour
- **Level:** browser: CSS computed style
- **Source:** `viewer/styles/phone.css:48-49`; the sheet's statement is SHEET's, the menu item MAST-19
- **Expected:** 390×844 → `#colophon` `display: none`; no `contentinfo` in the accessibility tree.
- **Covered by:** `src/app/App.svelte.test.ts` (R, the real footer at 390 px)

## Feedback

The form in the status bar's Feedback popover and in the phone menu's Feedback dialog (`FeedbackForm.svelte`), and the Worker that mails what it sends to the owner (`workers/feedback`, deployed by hand with `npx wrangler deploy` from that folder). No test posts to the relay: the form's run over a mocked `fetch`, the Worker's under Node's runner (`node --test 'workers/feedback/**/*.test.ts'`), which strips their types; CI's `feedback-worker` job then type-checks the Worker and its tests with `web/`'s TypeScript (`node web/node_modules/typescript/bin/tsc -p workers/feedback`). A change to the Worker alone also runs `web-check`, whose unit project holds the form to the Worker's address pattern and length (COLO-10, `feedback.test.ts`); it does not start the browser shards.

### COLO-09 · A message of spaces alone, or an address the relay would refuse, is said at its field

- **Rule:** Send checks the form before anything is sent, in the reader's language rather than with the browser's bubbles (the form is `novalidate`). A message that is empty once trimmed, or a reply address COLO-10 refuses, sends nothing. The field gets `aria-invalid="true"` and an error under it that its `aria-describedby` names first, and it takes focus (the address first, as it comes first). Editing the field takes its error away. The message is sent trimmed.
- **Kind:** accessibility
- **Level:** browser: request count, attributes and focus over a mocked `fetch`
- **Source:** review handoff U14
- **Expected:** message `"   \n\t  "` → no request; the textarea has `aria-invalid="true"`, is described by "Write your feedback before sending." (FR "Écrivez vos commentaires avant d’envoyer.") and is focused; typing "Hi" → `aria-invalid="false"` and no `aria-describedby`. An empty message in French → no request and the French error. `"  The cut is lovely.\n "` → `message: "The cut is lovely."`.
- **Covered by:** `src/features/colophon/FeedbackForm.svelte.test.ts` (R, 3 cases); `src/app/regions/StatusRegion.svelte.test.ts` (R, an empty message through the popover)

### COLO-10 · The reply address is optional, goes only to the owner, and becomes the mail's Reply-To

- **Rule:** Between the name and the message, an optional "Your email (optional)" field (`type="email"`, `autocomplete="email"`, `maxlength="254"`) says beside it, and through `aria-describedby`, that it is sent only to Planum's maintainer with the message, for a reply. A blank address is left out of the request; a given one is sent trimmed and stays in the draft for the next message, as the name does. The form accepts exactly what the Worker accepts: at most 254 characters (RFC 5321's longest path) matching the HTML standard's valid e-mail address, so one `@`, ASCII only, and no space, control character, quote, comma, semicolon, colon or angle bracket that could end the header or add a recipient; a test holds the two patterns and lengths equal. The Worker sets an accepted address as the mail's `replyTo` and adds a "Reply to:" line after the name. Any other value, an empty string or a non-string included, is a 400 and nothing is mailed; the value is never trimmed or repaired on its way to a header. Without the field the mail has no Reply-To and its text is unchanged. A Worker deployed before this rule ignores the field, so the message arrives without the address until the Worker is deployed again.
- **Kind:** behaviour
- **Level:** browser (the field, over a mocked `fetch`); unit (`isEmail`, and parity with the Worker's source); Node (the Worker)
- **Source:** review handoff U14, paired with SEC1
- **Expected:** the field's `type`, `autocomplete`, `maxLength` and `required` are `email`, `email`, 254 and false, and it is described by "Sent only to Planum’s maintainer, with your message, for a reply." (FR label "Votre courriel (facultatif)", note "Transmis uniquement au responsable de Planum, avec votre message, pour vous répondre."). `"  ada@example.org "` is sent as `email: "ada@example.org"`; `"   "` sends no `email` key; through the popover, a sent address and name are still in their fields when it opens again, and the message field is empty. "ada@", "Ada <ada@example.org>", "ada@example.org, someone@example.com" and FR "adà@example.org" → no request, `aria-invalid="true"`, described by "Enter one address, such as name@example.org, or leave this empty." (FR "Saisissez une seule adresse, comme nom@example.org, ou laissez ce champ vide.") then the note, and focused. Worker: `email: "ada.lovelace+planum@example.org"` → 204 and a mail whose `replyTo` is that address and whose text is `"Hi\n\nAda\nReply to: ada.lovelace+planum@example.org\nView: …\n"`; a 254-character address is mailed and a 255-character one is a 400; "", "ada@@example.org", " ada@example.org", `"ada"@example.org`, "adà@example.org", 42, null and an array are 400s; `"ada@example.org\r\nBcc: someone@example.com"`, the same with `\n` or `\r` alone, `\u0000` or `\u2028`, "ada@example.org, someone@example.com", "ada@example.org;someone@example.com" and the group "someone:ada@example.org;" are 400s with nothing mailed; no `email` → no `replyTo` key and the text `"Hi\n\nNo name given\nView: …\n"`.
- **Covered by:** `src/features/colophon/FeedbackForm.svelte.test.ts` (R, 7 cases); `src/features/colophon/feedback.test.ts` (R, `isEmail` and parity); `workers/feedback/src/index.test.ts` (R, 5 cases); `src/app/regions/StatusRegion.svelte.test.ts` (R, the three lengths; the address sent and kept through the popover)

### COLO-11 · A failed send says what happened and what the reader can do, for each outcome

- **Rule:** A send is one request under `AbortSignal.timeout(15000)`, and nothing retries it: the message stays in its field and Send is offered again. Fifteen seconds is what a working connection needs for the largest request the form makes (about 40 KB of three-byte text crosses a 50 kbit/s link in under 7 s), with room for the connection, the CORS preflight and Email Routing's send. Each outcome has its own words, followed by the owner's address as its own copy button: 400 (refused), 413 (too long), 429 (too many from this connection, with the wait in seconds when the relay sends `Retry-After` as a positive whole number; the Worker sends its rate limit's period, 60, and exposes the header to the page), 502 or any other status (the relay could not pass it on), the timeout (it may not have arrived), and a request that could not be made (offline when `navigator.onLine` is false, otherwise the server could not be reached). The announcer says the words with the address, and says them again when the same failure repeats; the paragraph is not also an alert. Any other exception is a fault, thrown as it is. The next send clears the failure.
- **Kind:** behaviour
- **Level:** unit (`sendFeedback` over a stubbed `fetch`); browser (the words and the announcer over a mocked `fetch`, with the browser's own timeout signal shortened)
- **Source:** review handoff U14; SEC1 for the statuses the Worker answers
- **Expected:** after "Hello" and Send, the paragraph reads the words then the address, and the announcer the same: 400 "The feedback server refused this message. You can send it by email to"; 413 "The message is too long for the feedback server. Shorten it and try again, or write to"; 429 with `Retry-After: 60` "Too many messages were sent from this connection. Try again in 60 seconds, or write to", without it "… Try again later, or write to" (FR "Trop de messages ont été envoyés depuis cette connexion. Réessayez dans 60 secondes, ou écrivez à"); 502 "The feedback server could not pass the message on. Try again later, or write to"; the timeout "The feedback server did not answer in time, so the message may not have arrived. Check the connection and try again, or write to"; offline "This device is offline, so nothing was sent. Try again once it is connected, or write to"; unreachable "The feedback server could not be reached. Check the connection and try again, or write to" (FR "Le serveur de commentaires est injoignable. Vérifiez la connexion et réessayez, ou écrivez à"). One request each, no `role="alert"`, and "Hello" still in the field. `AbortSignal.timeout` is called once, with 15000. 500 and 503 are the relay's failure; a `Retry-After` of "0", "soon" or a date gives no figure; a `RangeError` from `fetch` is rethrown.
- **Covered by:** `src/features/colophon/FeedbackForm.svelte.test.ts` (R, 11 cases); `src/features/colophon/feedback.test.ts` (R); `workers/feedback/src/index.test.ts` (R, the 429's headers); `src/app/regions/StatusRegion.svelte.test.ts` (R, the address offered after a 400)

### COLO-12 · After a send, focus moves to the thanks

- **Rule:** The thanks replaces the form and takes focus (`tabindex="-1"`), so focus does not fall to the page with the Send button: it stays in the popover or dialog, and a screen reader reads the thanks there. The announcer does not say it again. When the panel was closed while the message was sending, there is nothing to focus and the announcer says it.
- **Kind:** accessibility
- **Level:** browser: `document.activeElement`
- **Source:** review handoff U14
- **Expected:** a 204 → the focused element is `p.feedback-said[tabindex="-1"]` reading "Thank you, your feedback was sent." (FR "Merci, vos commentaires ont été envoyés."), there is no form, and the announcer is empty. The same through the status bar's popover and the phone menu's dialog.
- **Covered by:** `src/features/colophon/FeedbackForm.svelte.test.ts` (R); `src/app/regions/StatusRegion.svelte.test.ts` (R, the popover); `src/app/regions/MastheadRegion.svelte.test.ts` (R, the phone dialog). The closed-panel case is uncovered.

### COLO-13 · The form passes axe with its errors and a failure shown, and on the thanks

- **Rule:** axe finds nothing in light and dark, 1280 and 390 px wide, with both field errors and a rate-limited failure shown, and on the thanks. The error text and an invalid field's border are `--danger`, which passes 4.5:1 on every panel ground (`src/styles/contrast.test.ts`).
- **Kind:** accessibility
- **Level:** browser: axe-core (wcag2a, wcag2aa, wcag21aa, wcag22aa)
- **Source:** review handoff U14
- **Expected:** no violation in any of the four runs of either state.
- **Covered by:** `src/features/colophon/FeedbackForm.svelte.test.ts` (R, 2 cases)
