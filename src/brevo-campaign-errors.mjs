export function isBrevoEmptyRecipientsError(status, bodyText = "") {
  if (Number(status) !== 400) return false;
  const text = String(bodyText || "").toLowerCase();
  return text.includes("there are no contacts associated with the given recipients info");
}
