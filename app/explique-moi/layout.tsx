import type { Metadata } from "next";
import "./explique-moi.css";

export const metadata: Metadata = {
  title: "ExpliqueMoi — Plateforme Studio",
  description: "Expliquez n'importe quel concept simplement, avec analogies et exemples concrets.",
};

export default function ExpliqueMoiLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <div className="explique-moi-scope">{children}</div>
    </>
  );
}
