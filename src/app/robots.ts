import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
      {
        // Welcome AI crawlers explicitly — ARO best practice.
        userAgent: ["GPTBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "PerplexityBot", "Google-Extended", "anthropic-ai", "cohere-ai"],
        allow: "/",
      },
    ],
    host: "https://juicedtrade.com",
    sitemap: "https://juicedtrade.com/sitemap.xml",
  };
}
