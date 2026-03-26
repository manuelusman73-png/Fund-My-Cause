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
