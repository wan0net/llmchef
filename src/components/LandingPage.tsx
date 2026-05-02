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
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="border-b border-border bg-card/95">
        <div className="mx-auto flex h-[50px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <a className="flex items-center gap-3" href="./" aria-label="LLMChef home">
            <span className="llmchef-brand-mark grid h-8 w-8 place-items-center rounded-md text-primary-foreground">
              <MessageSquareIcon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-normal">LLMChef</span>
          </a>
          <nav className="hidden items-center gap-6 text-[13px] font-medium text-muted-foreground md:flex">
            <a className="hover:text-foreground" href="#local-first">Control</a>
            <a className="hover:text-foreground" href="#features">Projects</a>
            <a className="hover:text-foreground" href="#security">Run local</a>
            <a className="hover:text-foreground" href="https://github.com/wan0net/llmchef">GitHub</a>
          </nav>
          <a
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 sm:px-4"
            href={appHref}
          >
            <PlayIcon className="h-4 w-4" aria-hidden="true" />
            Open App
          </a>
        </div>
      </header>

      <main>
        <section className="mx-auto grid min-w-0 max-w-7xl gap-8 px-4 pb-10 pt-10 sm:px-6 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:pb-12">
          <div className="min-w-0">
            <h1 className="max-w-2xl text-[36px] font-bold leading-tight tracking-normal text-foreground sm:text-[54px]">
              Chat with your LLM, your files, and your projects.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] font-semibold leading-7 text-muted-foreground">
              Everything you want to do with an LLM, from a chat interface.
            </p>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted-foreground">
              All processing within your control. Your local machine, and your AI endpoint.
              LLMChef keeps the familiar chat shape, then adds project context, files, prompt
              controls, and workflows around it.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
                href={appHref}
              >
                <MessageSquareIcon className="h-4 w-4" aria-hidden="true" />
                Open App
              </a>
              <a
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-5 text-[13px] font-semibold text-foreground hover:bg-[var(--link42-bg-hover)]"
                href={downloadHref}
              >
                <DownloadIcon className="h-4 w-4" aria-hidden="true" />
                Download Local Bundle
              </a>
            </div>
            <div className="mt-7 grid gap-2 text-[13px] text-muted-foreground sm:grid-cols-3">
              {["Local after download", "Project-focused", "Open source"].map((item) => (
                <div className="flex items-center gap-2" key={item}>
                  <CheckIcon className="h-4 w-4 text-[var(--link42-accent-teal)]" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[430px] min-w-0">
            <div className="max-w-full overflow-hidden rounded-md border border-[var(--link42-border-strong)] bg-card shadow-[var(--link42-shadow-md)]">
              <div className="flex h-11 items-center justify-between border-b border-border bg-card px-3 text-[13px]">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[var(--link42-accent-cyan)]" />
                  LLMChef
                </div>
                <div className="flex items-center gap-2">
                  <button className="hidden h-8 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-[var(--link42-bg-hover)] sm:block">
                    Project: Research
                  </button>
                  <button className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                    <PlayIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    Send
                  </button>
                </div>
              </div>
              <div className="grid min-h-[430px] grid-cols-[128px_minmax(0,1fr)] sm:grid-cols-[180px_1fr_240px]">
                <aside className="border-r border-border bg-[var(--link42-bg-subtle)] p-3">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Context</p>
                  <ContextItem icon={MessageSquareIcon} label="Chat" active />
                  <ContextItem icon={FileTextIcon} label="Files" />
                  <ContextItem icon={WorkflowIcon} label="Prompts" />
                  <ContextItem icon={SlidersHorizontalIcon} label="Tools" />
                  <div className="mt-6 border-t border-border pt-3">
                    <p className="text-[11px] font-bold uppercase text-[var(--link42-text-dim)]">Projects</p>
                    <p className="mt-2 rounded-md bg-[var(--link42-bg-active)] px-2 py-1.5 text-xs font-medium">Research</p>
                    <p className="mt-1 px-2 py-1.5 text-xs text-muted-foreground">Recipes</p>
                  </div>
                </aside>
                <div className="flex min-w-0 flex-col bg-background p-4">
                  <div className="rounded-md border border-border bg-card p-4">
                    <p className="text-[11px] font-bold uppercase tracking-normal text-[var(--link42-text-dim)]">Conversation</p>
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
                    <div className="flex items-center gap-2 rounded-md border border-[var(--link42-border-strong)] bg-card p-2">
                      <PaperclipIcon className="h-4 w-4 text-[var(--link42-text-dim)]" aria-hidden="true" />
                      <span className="flex-1 px-2 text-[13px] text-[var(--link42-text-dim)]">Ask from this project...</span>
                      <button className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Send</button>
                    </div>
                  </div>
                </div>
                <aside className="hidden border-l border-border bg-[var(--link42-bg-subtle)] p-4 sm:block">
                  <p className="text-sm font-bold">Model Host</p>
                  <Field label="Host" value="http://127.0.0.1:11434" />
                  <Field label="Model" value="mistral:7b-instruct" />
                  <Field label="Temperature" value="0.2" />
                  <div className="mt-5 rounded-md border border-border bg-card p-3 font-mono text-xs leading-5 text-muted-foreground">
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

        <section id="local-first" className="border-y border-border bg-[var(--link42-bg-subtle)]">
          <div className="mx-auto grid max-w-7xl gap-0 px-4 sm:px-6 md:grid-cols-3" id="features">
            {featureGroups.map((feature) => (
              <article className="border-border py-7 md:border-r md:px-7 first:md:pl-0 last:md:border-r-0" key={feature.title}>
                <feature.icon className="h-7 w-7 text-[var(--link42-accent-cyan)]" aria-hidden="true" />
                <h2 className="mt-4 text-[18px] font-bold">{feature.title}</h2>
                <p className="mt-3 min-h-16 text-[13px] leading-6 text-muted-foreground">{feature.text}</p>
                <ul className="mt-4 space-y-2 text-[13px] text-muted-foreground">
                  {feature.points.map((point) => (
                    <li className="flex items-center gap-2" key={point}>
                      <CheckIcon className="h-4 w-4 text-[var(--link42-accent-teal)]" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="security" className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-[26px] font-bold tracking-normal">Get it running</h2>
            <p className="mt-4 max-w-md text-[14px] leading-6 text-muted-foreground">
              Use the hosted page to inspect the project, or download the release bundle and serve
              it locally when you want a CyberChef-style chat tool.
            </p>
            <a className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold text-primary" href="https://github.com/wan0net/llmchef">
              <GithubIcon className="h-4 w-4" aria-hidden="true" />
              View source
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map(([title, text], index) => (
              <article className="rounded-md border border-border bg-card p-4" key={title}>
                <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-[14px] font-bold">{title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-card px-6 py-5 text-muted-foreground">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 font-bold">
              <Code2Icon className="h-4 w-4 text-[var(--link42-accent-cyan)]" aria-hidden="true" />
              LLMChef
            </div>
            <div className="flex flex-wrap gap-5">
              <a className="hover:text-foreground" href={appHref}>App</a>
              <a className="hover:text-foreground" href={downloadHref}>Bundle</a>
              <a className="hover:text-foreground" href="https://github.com/wan0net/llmchef">GitHub</a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function ContextItem({ icon: Icon, label, active = false }: { icon: typeof MessageSquareIcon; label: string; active?: boolean }) {
  return (
    <div className={`mt-2 flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${active ? "border-primary/35 bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground"}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </div>
  );
}

function ChatBubble({ role, text, assistant = false }: { role: string; text: string; assistant?: boolean }) {
  return (
    <div className={`mt-4 max-w-[92%] rounded-md border p-3 text-[13px] leading-6 ${assistant ? "border-primary/35 bg-accent" : "ml-auto border-border bg-[var(--link42-bg-subtle)]"}`}>
      <p className="text-xs font-bold text-primary">{role}</p>
      <p className="mt-1 text-foreground">{text}</p>
    </div>
  );
}

function MiniPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-border bg-[var(--link42-bg-subtle)] p-3">
      <p className="text-xs font-bold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="mt-4 block text-xs font-semibold text-muted-foreground">
      {label}
      <span className="mt-1 block rounded-md border border-border bg-card px-3 py-2 font-mono text-[11px] font-normal text-foreground">
        {value}
      </span>
    </label>
  );
}
