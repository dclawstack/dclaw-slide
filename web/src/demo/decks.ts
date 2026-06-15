import type { DeckJson } from "@/lib/deck/types";

/** Demo decks shown when the dataset is seeded. Part of the removable demo module. */
export interface DemoDeck {
  prompt: string;
  views: number;
  presents: number;
  shareViews: number;
  deck: DeckJson;
}

export const DEMO_DECKS: DemoDeck[] = [
  {
    prompt:
      "Series A investor pitch for BrewCycle, a sustainable coffee subscription with refillable pods.",
    views: 42,
    presents: 7,
    shareViews: 19,
    deck: {
      version: 1,
      title: "BrewCycle — Series A",
      theme: { id: "dark-investor", accent: "#A78BFA", background: "dark", font: "sans" },
      slides: [
        {
          id: "s1",
          layout: "title",
          blocks: [
            { type: "heading", text: "BrewCycle" },
            { type: "subheading", text: "Great coffee. Zero waste. Delivered." },
          ],
          speakerNotes:
            "Open warm. We're the subscription that makes specialty coffee effortless and waste-free.",
        },
        {
          id: "s2",
          layout: "content",
          blocks: [
            { type: "heading", text: "Coffee has a waste problem" },
            {
              type: "bullets",
              items: [
                "59 billion single-use pods landfilled each year",
                "Subscribers churn when refills are a chore",
                "Eco-guilt is now a purchase blocker for 64% of buyers",
              ],
            },
            { type: "image", prompt: "discarded coffee pods landfill sustainability", alt: "Coffee pod waste" },
          ],
          speakerNotes: "Three pains we measure, not one fuzzy one.",
        },
        {
          id: "s3",
          layout: "content",
          blocks: [
            { type: "heading", text: "Refillable pods, on autopilot" },
            {
              type: "bullets",
              items: [
                "Returnable, dishwasher-safe pods",
                "AI reorder that learns your pace",
                "Carbon-neutral last-mile delivery",
              ],
            },
            { type: "image", prompt: "elegant refillable coffee pod product shot", alt: "BrewCycle pod" },
          ],
          speakerNotes: "Solution maps one-to-one to the three pains.",
        },
        {
          id: "s4",
          layout: "stats",
          blocks: [
            { type: "heading", text: "A market waking up" },
            { type: "stat", value: "$48B", label: "global coffee subscriptions" },
            { type: "stat", value: "23%", label: "CAGR through 2030" },
            { type: "stat", value: "64%", label: "buyers prefer sustainable" },
          ],
          speakerNotes: "Big, growing, and tailwind-aligned.",
        },
        {
          id: "s5",
          layout: "stats",
          blocks: [
            { type: "heading", text: "Traction" },
            { type: "stat", value: "12k", label: "active subscribers" },
            { type: "stat", value: "$1.4M", label: "ARR" },
            { type: "stat", value: "3.1%", label: "monthly churn" },
          ],
          speakerNotes: "Numbers first. Let them breathe.",
        },
        {
          id: "s6",
          layout: "quote",
          blocks: [
            {
              type: "quote",
              text: "BrewCycle is the first subscription my whole team actually kept.",
              attribution: "Priya N., Head of Ops, Atlas",
            },
          ],
          speakerNotes: "Social proof before the ask.",
        },
        {
          id: "s7",
          layout: "closing",
          blocks: [
            { type: "heading", text: "Raising $4M to scale" },
            { type: "paragraph", text: "Doubling cities, automating fulfillment, and launching B2B." },
          ],
          speakerNotes: "Clear ask, clear use of funds. Stop talking.",
        },
      ],
    },
  },
  {
    prompt: "Q3 business review for our biggest retail customer, Northwind, focused on adoption and renewal.",
    views: 28,
    presents: 4,
    shareViews: 11,
    deck: {
      version: 1,
      title: "Q3 Business Review — Northwind",
      theme: { id: "report-minimal", accent: "#0EA5E9", background: "light", font: "sans" },
      slides: [
        {
          id: "s1",
          layout: "title",
          blocks: [
            { type: "heading", text: "Q3 Business Review" },
            { type: "subheading", text: "Northwind Retail × your team" },
          ],
          speakerNotes: "Lead with their outcome, not our product.",
        },
        {
          id: "s2",
          layout: "stats",
          blocks: [
            { type: "heading", text: "The quarter in numbers" },
            { type: "stat", value: "+38%", label: "active users QoQ" },
            { type: "stat", value: "94%", label: "feature adoption" },
            { type: "stat", value: "4.6/5", label: "CSAT" },
          ],
          speakerNotes: "Open with their wins.",
        },
        {
          id: "s3",
          layout: "content",
          blocks: [
            { type: "heading", text: "What drove the lift" },
            {
              type: "bullets",
              items: [
                "Rolled out to 11 new store regions",
                "Automated reporting saved ~120 hrs/month",
                "Two integrations live ahead of schedule",
              ],
            },
          ],
          speakerNotes: "Attribute the wins to concrete actions.",
        },
        {
          id: "s4",
          layout: "content",
          blocks: [
            { type: "heading", text: "Watch-items" },
            {
              type: "bullets",
              items: [
                "Mobile usage lagging desktop by 22%",
                "One integration pending IT sign-off",
              ],
            },
          ],
          speakerNotes: "Be honest about risks; it builds trust before renewal.",
        },
        {
          id: "s5",
          layout: "closing",
          blocks: [
            { type: "heading", text: "Renewal + expansion" },
            { type: "paragraph", text: "Renew 24 months, add the analytics tier, pilot mobile in Q4." },
          ],
          speakerNotes: "Make the ask specific and time-bound.",
        },
      ],
    },
  },
  {
    prompt: "Friendly new-hire onboarding deck explaining how our team works.",
    views: 65,
    presents: 12,
    shareViews: 8,
    deck: {
      version: 1,
      title: "Welcome to the Team",
      theme: { id: "training-warm", accent: "#F97316", background: "light", font: "sans" },
      slides: [
        {
          id: "s1",
          layout: "title",
          blocks: [
            { type: "heading", text: "Welcome aboard 🎉" },
            { type: "subheading", text: "Your first week, made simple" },
          ],
          speakerNotes: "Warm and human. They're nervous; put them at ease.",
        },
        {
          id: "s2",
          layout: "content",
          blocks: [
            { type: "heading", text: "How we work" },
            {
              type: "bullets",
              items: [
                "Async by default, meetings with an agenda",
                "Write things down — docs over memory",
                "Ship small, ship often",
              ],
            },
            { type: "image", prompt: "diverse happy team collaborating office", alt: "Our team" },
          ],
          speakerNotes: "Set cultural expectations early.",
        },
        {
          id: "s3",
          layout: "content",
          blocks: [
            { type: "heading", text: "Your toolkit" },
            {
              type: "bullets",
              items: [
                "Slack for chat, Linear for work",
                "GitHub for code, Notion for docs",
                "1:1 with your buddy every Friday",
              ],
            },
          ],
          speakerNotes: "Concrete tools reduce day-one anxiety.",
        },
        {
          id: "s4",
          layout: "closing",
          blocks: [
            { type: "heading", text: "You've got this" },
            { type: "paragraph", text: "Ask anything. No question is too small in week one." },
          ],
          speakerNotes: "End encouraging.",
        },
      ],
    },
  },
];
