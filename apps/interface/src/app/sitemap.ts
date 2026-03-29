import type { MetadataRoute } from "next";
import { fetchAllCampaigns } from "@/lib/soroban";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fund-my-cause.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/campaigns`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
  ];

  try {
    const campaigns = await fetchAllCampaigns();
    const campaignRoutes: MetadataRoute.Sitemap = campaigns.map((c) => ({
      url: `${BASE_URL}/campaigns/${c.contractId}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    }));
    return [...staticRoutes, ...campaignRoutes];
  } catch {
    return staticRoutes;
  }
}
