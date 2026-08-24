import assert from "node:assert/strict";
import { isBrevoEmptyRecipientsError } from "../src/brevo-campaign-errors.mjs";

assert.equal(isBrevoEmptyRecipientsError(400, '{"code":"invalid_parameter","message":"There are no contacts associated with the given recipients info"}'), true);
assert.equal(isBrevoEmptyRecipientsError(400, '{"code":"invalid_parameter","message":"Other validation issue"}'), false);
assert.equal(isBrevoEmptyRecipientsError(500, '{"message":"There are no contacts associated with the given recipients info"}'), false);

console.log("Brevo empty-recipient contract passed.");
