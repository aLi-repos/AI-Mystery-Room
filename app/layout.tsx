import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import WorkspaceBackdrop from "@/components/WorkspaceBackdrop";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MysteryAI — AI Investigation Assistant",
  description:
    "Create an investigation, upload case evidence, and get AI findings with evidence references, timelines and a structured report.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text">
        <WorkspaceBackdrop />
        {children}
      </body>
    </html>
  );
}
