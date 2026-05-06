import Link from "next/link";
import { Presentation } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <Presentation className="h-16 w-16 text-[#EAB308] mb-6" />
      <h1 className="text-4xl font-bold text-[#EAB308] mb-4">DClaw Slide</h1>
      <p className="text-lg text-gray-600 mb-8">AI-generated decks</p>
      <Link
        href="/dashboard"
        className="rounded-md bg-[#EAB308] px-6 py-3 text-white font-medium hover:bg-[#ca8a04] transition-colors"
      >
        Open Dashboard
      </Link>
    </main>
  );
}
