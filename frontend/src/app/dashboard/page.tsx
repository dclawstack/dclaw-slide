"use client";

import { useState } from "react";
import { Presentation } from "lucide-react";

export default function Dashboard() {
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState("Pitch");
  const [results, setResults] = useState<{
    slides: { title: string; content: string }[];
    speakerNotes: string[];
    durationMinutes: number;
  } | null>(null);

  const handleGenerate = () => {
    setResults({
      slides: [
        { title: "Title Slide", content: `Welcome to ${title || "Presentation"}` },
        { title: "Problem", content: "Define the core problem being solved." },
        { title: "Solution", content: "Explain how we solve it." },
        { title: "Roadmap", content: "Next steps and timeline." },
      ],
      speakerNotes: [
        "Introduce yourself and the agenda.",
        "Use a relatable example to set the stage.",
        "Highlight the unique value proposition.",
        "End with a clear call to action.",
      ],
      durationMinutes: Math.floor(Math.random() * 26) + 5,
    });
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-[#EAB308] px-6 py-4 flex items-center gap-3">
        <Presentation className="h-6 w-6 text-white" />
        <h1 className="text-xl font-semibold text-white">DClaw Slide</h1>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Deck Builder</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Presentation title</label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-[#EAB308] focus:ring-1 focus:ring-[#EAB308] outline-none"
              placeholder="Q4 Roadmap"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
            <select
              className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-[#EAB308] focus:ring-1 focus:ring-[#EAB308] outline-none bg-white"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            >
              <option>Pitch</option>
              <option>Report</option>
              <option>Training</option>
            </select>
          </div>
          <button
            onClick={handleGenerate}
            className="rounded-md bg-[#EAB308] px-6 py-3 text-white font-medium hover:bg-[#ca8a04] transition-colors"
          >
            Generate Outline
          </button>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Results</h2>
          {results ? (
            <div className="space-y-6">
              <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Slides</h3>
                <ul className="space-y-3">
                  {results.slides.map((slide, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-semibold text-gray-900">{i + 1}. {slide.title}</span>
                      <p className="text-gray-600 mt-1">{slide.content}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Speaker Notes</h3>
                <ul className="space-y-2">
                  {results.speakerNotes.map((note, i) => (
                    <li key={i} className="text-gray-800 text-sm">• {note}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Estimated Duration</h3>
                <p className="text-3xl font-bold text-[#EAB308]">{results.durationMinutes} min</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-white p-12 shadow-sm border border-gray-200 text-center text-gray-500">
              Generate an outline to see results
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
