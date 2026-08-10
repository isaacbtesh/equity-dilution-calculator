import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dilution 3000 — VC Investment Calculator",
    short_name: "Dilution 3000",
    description:
      "Model venture returns through dilution, fees and carry. Round by round or quick estimate.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#241a12",
    theme_color: "#2b2b2e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
