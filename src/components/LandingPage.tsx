import {
  ArrowRightIcon,
  CheckIcon,
  Code2Icon,
  DownloadIcon,
  FileTextIcon,
  GithubIcon,
  LockKeyholeIcon,
  MessageSquareIcon,
  PaperclipIcon,
  PlayIcon,
  SlidersHorizontalIcon,
  ShieldCheckIcon,
  WorkflowIcon,
} from "lucide-react";

interface LandingPageProps {
  appHref: string;
  downloadHref: string;
}

const featureGroups = [
  {
    icon: LockKeyholeIcon,
    title: "Within your control",
    text: "The browser app, your project data, and your configured AI endpoint stay explicit and inspectable.",
    points: ["Local app bundle", "No telemetry", "Configured endpoints only"],
  },
  {
    icon: WorkflowIcon,
    title: "Project-focused chat",
    text: "Every conversation belongs somewhere: a project, a prompt setup, a set of files, and a trail of outputs.",
    points: ["Project context", "Files and VFS", "Conversation history"],
  },
  {
    icon: ShieldCheckIcon,
    title: "LLM workbench",
    text: "Use chat as the front door, then bring in prompt recipes, tools, runnable blocks, and workflows when needed.",
    points: ["Prompt controls", "Runnable blocks", "Workflow handoffs"],
  },
];

const steps = [
  ["Download the bundle", "Use the release ZIP or host the built dist folder yourself."],
  ["Point to your LLM host", "Configure Ollama, LM Studio, or another provider endpoint."],
  ["Open chat and cook", "Start with conversation, then pull in files, tools, and recipes as needed."],
];

export function LandingPage({ appHref, downloadHref }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#ffffff] text-[#1a1a1a]">
      <header className="border-b border-[#e8e8e6] bg-white">
        <div className="mx-auto flex h-[50px] max-w-7xl items-center justify-between px-6">
          <a className="flex items-center gap-3" href="./" aria-label="LLMChef home">
            <span className="grid h-8 w-8 place-items-center rounded-md border border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]">
              <MessageSquareIcon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-normal">LLMChef</span>
          </a>
          <nav className="hidden items-center gap-6 text-[13px] font-medium text-[#57534e] md:flex">
            <a className="hover:text-[#1a1a1a]" href="#local-first">Control</a>
            <a className="hover:text-[#1a1a1a]" href="#features">Projects</a>
            <a className="hover:text-[#1a1a1a]" href="#security">Run local</a>
            <a className="hover:text-[#1a1a1a]" href="https://github.com/wan0net/llmchef">GitHub</a>
          </nav>
          <a
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#16a34a] px-4 text-[13px] font-semibold text-white hover:bg-[#15803d]"
            href={appHref}
          >
            <PlayIcon className="h-4 w-4" aria-hidden="true" />
            Open App
          </a>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-8 px-6 pb-10 pt-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:pb-12">
          <div>
            <h1 className="max-w-2xl text-[42px] font-bold leading-tight tracking-normal text-[#1a1a1a] sm:text-[54px]">
              Chat with your LLM, your files, and your projects.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] font-semibold leading-7 text-[#57534e]">
              Everything you want to do with an LLM, from a chat interface.
            </p>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#57534e]">
              All processing within your control. Your local machine, and your AI endpoint.
              LLMChef keeps the familiar chat shape, then adds project context, files, prompt
              controls, and workflows around it.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#16a34a] px-5 text-[13px] font-semibold text-white hover:bg-[#15803d]"
                href={appHref}
              >
                <MessageSquareIcon className="h-4 w-4" aria-hidden="true" />
                Open App
              </a>
              <a
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d4d4d0] bg-white px-5 text-[13px] font-semibold text-[#1a1a1a] hover:bg-[#f3f3f2]"
                href={downloadHref}
              >
                <DownloadIcon className="h-4 w-4" aria-hidden="true" />
                Download Local Bundle
              </a>
            </div>
            <div className="mt-7 grid gap-2 text-[13px] text-[#57534e] sm:grid-cols-3">
              {["Local after download", "Project-focused", "Open source"].map((item) => (
                <div className="flex items-center gap-2" key={item}>
                  <CheckIcon className="h-4 w-4 text-[#16a34a]" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[430px]">
            <div className="overflow-hidden rounded-lg border border-[#d4d4d0] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04)]">
              <div className="flex h-11 items-center justify-between border-b border-[#e8e8e6] bg-[#ffffff] px-3 text-[13px]">
                <div className="flex items-center gap-2 font-semibold text-[#1a1a1a]">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#16a34a]" />
                  LLMChef
                </div>
                <div className="flex items-center gap-2">
                  <button className="hidden h-8 rounded-md border border-[#e8e8e6] px-3 text-xs text-[#57534e] sm:block">
                    Project: Research
                  </button>
                  <button className="inline-flex h-8 items-center gap-1 rounded-md bg-[#16a34a] px-3 text-xs font-semibold text-white">
                    <PlayIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    Send
                  </button>
                </div>
              </div>
              <div className="grid min-h-[430px] grid-cols-[145px_1fr] sm:grid-cols-[180px_1fr_240px]">
                <aside className="border-r border-[#e8e8e6] bg-[#f8f8f7] p-3">
                  <p className="text-xs font-bold uppercase text-[#5b655e]">Context</p>
                  <ContextItem icon={MessageSquareIcon} label="Chat" active />
                  <ContextItem icon={FileTextIcon} label="Files" />
                  <ContextItem icon={WorkflowIcon} label="Prompts" />
                  <ContextItem icon={SlidersHorizontalIcon} label="Tools" />
                  <div className="mt-6 border-t border-[#e8e8e6] pt-3">
                    <p className="text-[11px] font-bold uppercase text-[#a8a29e]">Projects</p>
                    <p className="mt-2 rounded-md bg-[#ebebea] px-2 py-1.5 text-xs font-medium">Research</p>
                    <p className="mt-1 px-2 py-1.5 text-xs text-[#57534e]">Recipes</p>
                  </div>
                </aside>
                <div className="flex flex-col bg-white p-4">
                  <div className="rounded-md border border-[#e8e8e6] bg-[#ffffff] p-4">
                    <p className="text-[11px] font-bold uppercase tracking-normal text-[#a8a29e]">Conversation</p>
                    <ChatBubble
                      role="You"
                      text="Summarize these notes, extract the decisions, then draft the next prompt."
                    />
                    <ChatBubble
                      role="LLMChef"
                      text="I found three decisions, two open risks, and a reusable prompt recipe. Want the recipe saved to this project?"
                      assistant
                    />
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <MiniPanel title="Attached files" body="notes.txt, roadmap.md" />
                      <MiniPanel title="Project prompt" body="Decision extractor" />
                    </div>
                  </div>
                  <div className="mt-auto pt-4">
                    <div className="flex items-center gap-2 rounded-md border border-[#d4d4d0] bg-white p-2">
                      <PaperclipIcon className="h-4 w-4 text-[#a8a29e]" aria-hidden="true" />
                      <span className="flex-1 px-2 text-[13px] text-[#a8a29e]">Ask from this project...</span>
                      <button className="rounded-md bg-[#16a34a] px-3 py-2 text-xs font-semibold text-white">Send</button>
                    </div>
                  </div>
                </div>
                <aside className="hidden border-l border-[#e8e8e6] bg-[#f8f8f7] p-4 sm:block">
                  <p className="text-sm font-bold">Model Host</p>
                  <Field label="Host" value="http://127.0.0.1:11434" />
                  <Field label="Model" value="mistral:7b-instruct" />
                  <Field label="Temperature" value="0.2" />
                  <div className="mt-5 rounded-md border border-[#e8e8e6] bg-white p-3 font-mono text-xs leading-5 text-[#57534e]">
                    <p>&gt; local chat</p>
                    <p>Context loaded</p>
                    <p>Provider allowed</p>
                    <p>No telemetry</p>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </section>

        <section id="local-first" className="border-y border-[#e8e8e6] bg-[#f8f8f7]">
          <div className="mx-auto grid max-w-7xl gap-0 px-6 md:grid-cols-3" id="features">
            {featureGroups.map((feature) => (
              <article className="border-[#e8e8e6] py-7 md:border-r md:px-7 first:md:pl-0 last:md:border-r-0" key={feature.title}>
                <feature.icon className="h-7 w-7 text-[#16a34a]" aria-hidden="true" />
                <h2 className="mt-4 text-[18px] font-bold">{feature.title}</h2>
                <p className="mt-3 min-h-16 text-[13px] leading-6 text-[#57534e]">{feature.text}</p>
                <ul className="mt-4 space-y-2 text-[13px] text-[#57534e]">
                  {feature.points.map((point) => (
                    <li className="flex items-center gap-2" key={point}>
                      <CheckIcon className="h-4 w-4 text-[#16a34a]" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="security" className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-[26px] font-bold tracking-normal">Get it running</h2>
            <p className="mt-4 max-w-md text-[14px] leading-6 text-[#57534e]">
              Use the hosted page to inspect the project, or download the release bundle and serve
              it locally when you want a CyberChef-style chat tool.
            </p>
            <a className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold text-[#16a34a]" href="https://github.com/wan0net/llmchef">
              <GithubIcon className="h-4 w-4" aria-hidden="true" />
              View source
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map(([title, text], index) => (
              <article className="rounded-lg border border-[#e8e8e6] bg-white p-4" key={title}>
                <div className="grid h-7 w-7 place-items-center rounded-md bg-[#16a34a] text-xs font-bold text-white">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-[14px] font-bold">{title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-[#57534e]">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-[#e8e8e6] bg-white px-6 py-5 text-[#57534e]">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 font-bold">
              <Code2Icon className="h-4 w-4 text-[#16a34a]" aria-hidden="true" />
              LLMChef
            </div>
            <div className="flex flex-wrap gap-5">
              <a className="hover:text-[#1a1a1a]" href={appHref}>App</a>
              <a className="hover:text-[#1a1a1a]" href={downloadHref}>Bundle</a>
              <a className="hover:text-[#1a1a1a]" href="https://github.com/wan0net/llmchef">GitHub</a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function ContextItem({ icon: Icon, label, active = false }: { icon: typeof MessageSquareIcon; label: string; active?: boolean }) {
  return (
    <div className={`mt-2 flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${active ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]" : "border-[#e8e8e6] bg-white text-[#57534e]"}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </div>
  );
}

function ChatBubble({ role, text, assistant = false }: { role: string; text: string; assistant?: boolean }) {
  return (
    <div className={`mt-4 max-w-[92%] rounded-md border p-3 text-[13px] leading-6 ${assistant ? "border-[#bbf7d0] bg-[#f0fdf4]" : "ml-auto border-[#e8e8e6] bg-[#f8f8f7]"}`}>
      <p className="text-xs font-bold text-[#16a34a]">{role}</p>
      <p className="mt-1 text-[#1a1a1a]">{text}</p>
    </div>
  );
}

function MiniPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-[#e8e8e6] bg-[#f8f8f7] p-3">
      <p className="text-xs font-bold text-[#1a1a1a]">{title}</p>
      <p className="mt-1 text-xs text-[#57534e]">{body}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="mt-4 block text-xs font-semibold text-[#57534e]">
      {label}
      <span className="mt-1 block rounded-md border border-[#e8e8e6] bg-white px-3 py-2 font-mono text-[11px] font-normal text-[#1a1a1a]">
        {value}
      </span>
    </label>
  );
}
