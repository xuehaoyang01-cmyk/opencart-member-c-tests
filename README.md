# OpenCart shopping cart tests — Haoyang Xue

Automated tests for the OpenCart demonstration store at https://opencart.abstracta.us/.

## Test coverage

| Function | Test case | Scenarios |
| --- | --- | --- |
| F7 — Add Products to the Cart | T007 | Add one iPhone; add the same product again; reject Canon EOS 5D without its required option |
| F8 — Modify Cart Quantity | T008 | Increase quantity from 1 to 3; decrease from 3 to 1; set quantity to zero |
| F9 — Remove Products from the Cart | T009 | Remove the only product; remove iPhone while retaining MacBook; remove a line containing three units |

Each scenario prepares its own cart contents in a guest session. Checks cover product rows, quantities, amounts, required-option feedback, and persistence after page reload. Quantity zero is treated as removal under the test specification. Checkout and payment are outside the test scope.

## Files

- `cart_suite.mjs`: shared scenario definitions, browser actions, assertions and result handling.
- `run.mjs`: standalone Playwright runner for local execution.
- `cua_adapter.mjs`: adapter for the browser interface used in the recorded execution; requires an existing compatible CUA tab and an output directory.
- `package.json`: runtime requirements, pinned Playwright dependency and test command.

## Run locally

Install Node.js 22 or later and npm. Open a terminal in this repository and run:

```sh
npm install
npx playwright install chromium
npm test
```

To display the browser or run one test case:

```sh
node run.mjs --headed
node run.mjs T007
node run.mjs T008
node run.mjs T009
```

Options can be combined, for example `node run.mjs T008 --headed`.

## Results and evidence

Each local run writes a timestamped directory under `runs/`, containing:

- `results.json`: scenario outcomes and observed cart values; monetary values use integer cents.
- `environment.json`: runtime, operating system, architecture and browser information.
- Scenario screenshots and page text.
- `trace.zip`: Playwright trace for reviewing the local execution.

The process exits with code 1 if any scenario fails or encounters an execution error. Generated results and installed dependencies are excluded from version control.

## Recorded execution and verification scope

The shared suite was executed through the CUA browser adapter on 26 October 2026 (Australia/Sydney), with 9 PASS, 0 FAIL and 0 ERROR. The submitted report contains the corresponding recorded results and screenshot evidence.

The standalone Playwright runner has been syntax-checked; its local Chromium execution has not been verified. Run it locally before treating its output as a new test result. The public demonstration site's content, availability and configuration may change, so a later run may differ from the recorded results.

Passing assertions concern the specified cart behaviour. They do not establish stock availability, successful checkout, or the absence of other website defects.
