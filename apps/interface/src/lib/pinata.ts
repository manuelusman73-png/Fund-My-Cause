/**
 * Uploads a file to IPFS via Pinata's pinning service.
 * Requires NEXT_PUBLIC_PINATA_API_KEY and NEXT_PUBLIC_PINATA_SECRET_API_KEY env vars.
 * @param {File} file - File to upload
 * @returns {Promise<string>} IPFS URI (ipfs://hash)
 * @throws {Error} If Pinata API keys are not configured or upload fails
 */
export async function uploadToPinata(file: File): Promise<string> {
  const key = process.env.NEXT_PUBLIC_PINATA_API_KEY;
  const secret = process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY;
  if (!key || !secret) throw new Error("Pinata API keys not configured.");

  const body = new FormData();
  body.append("file", file);

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { pinata_api_key: key, pinata_secret_api_key: secret },
    body,
  });

  if (!res.ok) throw new Error(`Pinata upload failed: ${res.statusText}`);
  const { IpfsHash } = await res.json();
  return `ipfs://${IpfsHash}`;
}
