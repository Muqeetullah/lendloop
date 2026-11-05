const encoder = new TextEncoder();
const maximumAgeMs = 5 * 60 * 1000;

async function key(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function signMessage(secret: string, message: string) {
  return bytesToHex(
    await crypto.subtle.sign(
      "HMAC",
      await key(secret),
      encoder.encode(message),
    ),
  );
}

export async function verifySignedRequest(
  secret: string | undefined,
  timestamp: string | null,
  signature: string | null,
  method: string,
  path: string,
  body: string,
  now = Date.now(),
) {
  if (
    !secret ||
    !timestamp ||
    !/^\d{13}$/.test(timestamp) ||
    !signature ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    Math.abs(now - Number(timestamp)) > maximumAgeMs
  )
    return false;
  const signatureBytes = new Uint8Array(
    signature.match(/../g)!.map((pair) => parseInt(pair, 16)),
  );
  return await crypto.subtle.verify(
    "HMAC",
    await key(secret),
    signatureBytes,
    encoder.encode(`v1.${timestamp}.${method}.${path}.${body}`),
  );
}
