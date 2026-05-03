import{j as p,R as h}from"./vendor-react-Djp8M_-6.js";import{A as f,a7 as u}from"./LLMChefApp-595QF8Cf.js";import{u as x,e as v,y,a3 as w,c as T}from"./index-DwFHW8J3.js";import{D as k,t as d}from"./vendor-ui-JyB7fVS_.js";import"./vendor-mermaid-BvYN64FB.js";import"./vendor-charts-BRhz9ZN5.js";import"./vendor-data-lquZhjzc.js";import"./vendor-flow-CQ_I-6pA.js";import"./vendor-ai-CJDJq_yo.js";const R=({interactionId:m,conversationId:e})=>{const{t}=x("canvas"),r=o=>{o.stopPropagation(),v.emit(u.raceResultExportRequest,{interactionId:m,conversationId:e})};return p.jsx(f,{tooltipText:t("actions.exportRaceResults","Export Race Results"),onClick:r,"aria-label":t("actions.exportRaceResultsAriaLabel","Export race results to ZIP file"),icon:p.jsx(k,{}),className:"h-5 w-5 md:h-6 md:w-6"})};class C{static getWorkingLLMChefApiScript(){return`
        const llmchefTarget = document.getElementById('llmchef-target');
        async function loadModules(moduleConfigs) {
            const loadedModules = {};
            const loadPromises = {};
            const globalImportMap = {};
            moduleConfigs.forEach(config => {
                if (config.importMap) Object.assign(globalImportMap, config.importMap);
            });
            const existingMap = document.querySelector('script[type="importmap"]');
            if (existingMap) existingMap.remove();
            if (Object.keys(globalImportMap).length > 0) {
                const mapScript = document.createElement('script');
                mapScript.type = 'importmap';
                mapScript.textContent = JSON.stringify({ imports: globalImportMap });
                document.head.appendChild(mapScript);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            const loadSingleModule = async (config) => {
                const key = config.globalKey || config.name;
                if (window[key]) return window[key];
                if (key in loadPromises) return loadPromises[key];
                if (config.dependencies) {
                    await Promise.all(config.dependencies.map(depKey => {
                        const depModule = moduleConfigs.find(m => (m.globalKey || m.name) === depKey);
                        if (depModule) return loadSingleModule(depModule);
                        return Promise.resolve();
                    }));
                }
                loadPromises[key] = (async () => {
                    try {
                        const module = await import(config.url);
                        window[key] = module;
                        loadedModules[key] = module;
                        return module;
                    } catch (error) {
                        console.error(\`Error loading module \${config.name}:\`, error);
                        throw error;
                    }
                })();
                return loadPromises[key];
            };
            await Promise.all(moduleConfigs.map(config => loadSingleModule(config)));
            return loadedModules;
        }
        window.llmchef = {
            utils: {
                log: (...args) => console.log(...args),
                toast: (message) => alert(message),
                error: (...args) => console.error(...args),
                warn: (...args) => console.warn(...args),
                loadModules,
                loadModule: async (url, name, key, importMap) => (await loadModules([{url, name, globalKey: key, importMap}]))[key || name],
            },
            target: llmchefTarget,
            emit: (eventName, payload) => window.dispatchEvent(new CustomEvent(eventName, { detail: payload })),
        };
    `}static extractInlineCSS(){const e=document.querySelectorAll("style");let t="";for(const r of e)r.textContent&&(t+=r.textContent+`
`);return t}static async getCurrentCssContent(){{const e=document.querySelector('link[rel="stylesheet"][href*="/assets/index-"]');if(e)try{const t=y(e.href,"race-export:stylesheet",[window.location.host]),r=await fetch(t);if(r.ok)return await r.text()}catch(t){console.error(t)}}return`
      * { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .container { max-width: 1200px; margin: 0 auto; }
      .bg-card { background: white; }
      .text-card-foreground { color: #333; }
      .border { border: 1px solid #e5e7eb; }
      .rounded-lg { border-radius: 0.5rem; }
      .p-4 { padding: 1rem; }
      .p-6 { padding: 1.5rem; }
      .mb-4 { margin-bottom: 1rem; }
      .text-lg { font-size: 1.125rem; }
      .font-semibold { font-weight: 600; }
      .grid { display: grid; }
      .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
      .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .gap-4 { gap: 1rem; }
      .hidden { display: none !important; }
      .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
      .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
      .bg-gray-200 { background-color: #e5e7eb; }
      .hover\\:bg-gray-300:hover { background-color: #d1d5db; }
      .rounded-md { border-radius: 0.375rem; }
      @media (min-width: 768px) {
        .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (min-width: 1024px) {
        .lg\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }
    `}static extractLastCodeBlock(e,t){if(!e)return null;let r;t==="runjs"?r=/```runjs\n([\s\S]*?)\n```/g:r=/```(?:runpy|python)\n([\s\S]*?)\n```/g;const o=[...e.matchAll(r)];return o.length>0?o[o.length-1][1]:null}static extractModelName(e){if(!e||!e.includes(":"))return null;const t=e.split(":");if(t.length<2)return null;const o=t[1].split("/");return o[o.length-1]}static getByteLength(e){return e==null?0:new TextEncoder().encode(e).length}static formatBytes(e,t=2){if(e===0||e===null||e===void 0)return"0 Bytes";const r=1024,o=t<0?0:t,a=["Bytes","KB","MB","GB","TB"],n=Math.floor(Math.log(e)/Math.log(r));return parseFloat((e/Math.pow(r,n)).toFixed(o))+" "+a[n]}static formatTime(e){return e==null?"N/A":e<1e3?`${e}ms`:`${(e/1e3).toFixed(2)}s`}static processRaceInteractions(e){const t=[];for(const r of e){const o=r.response||"";let a=this.extractLastCodeBlock(o,"runjs"),n="runjs";a||(a=this.extractLastCodeBlock(o,"runpy"),n="runpy"),a||(n="text");const i=r.metadata?.modelId;if(!i){console.warn(`Skipping interaction ${r.id}: No modelId found`);continue}const l=this.extractModelName(i);if(!l){console.warn(`Skipping interaction ${r.id}: Could not extract model name from "${i}"`);continue}const s=r.metadata||{},c=!!s.promptVariantLabel,g=s.promptVariantLabel,b=r.prompt?.content||"";t.push({modelName:l,runnableCode:a,fullResponse:o,blockType:n,isPromptRace:c,promptVariantLabel:g,promptContent:b,metadata:{responseBytes:this.getByteLength(o),codeBytes:this.getByteLength(a),completionTokens:s.completionTokens||s.outputTokens,promptTokens:s.promptTokens||s.inputTokens,timeToFirstToken:s.timeToFirstToken,generationTime:s.generationTime}})}return t}static generateModelHtmlPage(e){const t=e.fullResponse?e.fullResponse.replace(/</g,"&lt;").replace(/>/g,"&gt;"):"No response content.",r=e.isPromptRace?e.promptVariantLabel||"Unknown Variant":e.modelName,o=e.isPromptRace?`${e.promptVariantLabel} - LLMChef Prompt Race Result`:`${e.modelName} - LLMChef Race Result`,a=e.promptContent?e.promptContent.replace(/</g,"&lt;").replace(/>/g,"&gt;"):"",n=this.getWorkingLLMChefApiScript();return`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${o}</title>
    <link rel="stylesheet" href="styles.css">
    <style>
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .tab-button { 
            transition: all 0.2s ease-in-out; 
            border-bottom: 2px solid transparent; 
        }
        .tab-button.active { 
            border-bottom-color: var(--primary);
            color: var(--primary);
            background-color: var(--muted);
        }
    </style>
</head>
<body class="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8">
    <div class="max-w-7xl mx-auto container bg-card rounded-2xl shadow-lg overflow-hidden border border-border">
        <div class="header bg-card border-b border-border p-6 sm:p-8 text-center">
            <div class="flex justify-between items-center mb-4">
                <h1 class="text-3xl sm:text-4xl font-bold text-card-foreground">🚀 ${r}</h1>
                <button id="theme-toggle" class="p-2 rounded-md border border-border bg-muted hover:bg-muted/80">
                    <span class="dark:hidden">🌙</span>
                    <span class="hidden dark:inline">☀️</span>
                </button>
            </div>
            <p class="text-muted-foreground">LLMChef ${e.isPromptRace?"Prompt":"Model"} Race Result (${e.blockType.toUpperCase()})</p>
        </div>
        
        ${e.isPromptRace&&a?`
        <div class="prompt-section bg-muted/30 border-b border-border p-6">
            <h2 class="text-xl font-semibold mb-3 text-card-foreground">Prompt Variant</h2>
            <div class="bg-card border border-border rounded-lg p-4">
                <pre class="whitespace-pre-wrap text-sm text-card-foreground font-mono">${a}</pre>
            </div>
        </div>
        `:""}
        
        <div class="p-4 sm:p-6">
            <div class="border-b border-border mb-4">
                <nav class="-mb-px flex space-x-4" aria-label="Tabs">
                    ${e.runnableCode?`
                        <button class="tab-button active hover:text-primary/80 whitespace-nowrap py-3 px-4 font-medium text-sm rounded-t-md" data-tab="preview">Live Preview</button>
                        <button class="tab-button hover:text-primary/80 whitespace-nowrap py-3 px-4 font-medium text-sm rounded-t-md" data-tab="raw">Raw Response</button>
                    `:`
                        <button class="tab-button active hover:text-primary/80 whitespace-nowrap py-3 px-4 font-medium text-sm rounded-t-md" data-tab="raw">Response Content</button>
                    `}
                </nav>
            </div>

            ${e.runnableCode?`
                <div id="preview" class="tab-content active">
                    <div id="llmchef-target" class="w-full min-h-[600px] bg-muted/50 rounded-lg p-4 border border-border"></div>
                </div>
            `:""}

            <div id="raw" class="tab-content${e.runnableCode?"":" active"}">
                <div class="w-full min-h-[600px] bg-gray-900 text-white rounded-lg p-4 overflow-x-auto font-mono">
                    <pre class="whitespace-pre-wrap text-sm"><code>${t}</code></pre>
                </div>
            </div>
        </div>

        <div class="footer bg-muted/50 p-4 border-t border-border text-center text-sm text-muted-foreground">
            Generated by <strong>LLMChef</strong> • <a href="./index.html" class="text-primary hover:underline">Back to Main Page</a>
        </div>
    </div>

    <script type="module">
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        const html = document.documentElement;
        
        themeToggle?.addEventListener('click', () => {
            html.classList.toggle('dark');
            localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
        });
        
        // Load saved theme
        if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            html.classList.add('dark');
        }

        // Tab switching logic
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                const tabId = button.dataset.tab;
                tabContents.forEach(content => content.id === tabId ? content.classList.add('active') : content.classList.remove('active'));
            });
        });
        
        ${e.runnableCode?`
        // --- LLMCHEF MOCK API ---
        ${n}

        // --- EXECUTE CODE ---
        try {
            ${e.blockType==="runjs"?e.runnableCode:`
                // Python code execution placeholder - would need pyodide or similar
                const codeDiv = document.createElement('div');
                codeDiv.className = 'p-4 bg-blue-100 border border-blue-200 rounded-md';
                codeDiv.innerHTML = '<h3 class="font-bold text-blue-800 mb-2">Python Code:</h3>' +
                                   '<pre class="bg-blue-50 p-2 rounded text-sm overflow-x-auto"><code>${e.runnableCode?.replace(/'/g,"\\'").replace(/\n/g,"\\n")}</code></pre>' +
                                   '<p class="text-blue-600 text-sm mt-2">Python execution not available in exported HTML. Code is displayed above.</p>';
                document.getElementById('llmchef-target').appendChild(codeDiv);
            `}
        } catch (error) {
            console.error('Execution error:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'p-4 text-red-600 bg-red-100 border border-red-200 rounded-md';
            errorDiv.textContent = 'Execution Error: ' + error.message;
            document.getElementById('llmchef-target').appendChild(errorDiv);
        }
        `:""}
    <\/script>
</body>
</html>`}static generateResultsList(e){return e.map(t=>{const r=t.isPromptRace?t.promptVariantLabel||"Unknown Variant":t.modelName,o=t.isPromptRace?(t.promptVariantLabel||"unknown").replace(/[^a-zA-Z0-9\-_]/g,"_"):t.modelName;return`
        <li class="bg-card rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border border-border">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-card-foreground">${r}</h3>
                <div class="flex items-center gap-2">
                    <span class="inline-flex items-center px-2 py-1 text-xs font-medium rounded ${t.blockType==="runjs"?"bg-green-100 text-green-700":t.blockType==="runpy"?"bg-blue-100 text-blue-700":"bg-gray-100 text-gray-700"}">
                        ${t.blockType.toUpperCase()}
                    </span>
                    <a href="./${o}.html" target="_blank" rel="noopener noreferrer" 
                       class="inline-flex items-center px-3 py-2 text-sm font-medium text-primary-foreground bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary/90">
                        View Result
                    </a>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                    <span class="font-medium">Response Size:</span><br>
                    <span class="text-card-foreground">${this.formatBytes(t.metadata.responseBytes)}</span>
                </div>
                <div>
                    <span class="font-medium">Code Size:</span><br>
                    <span class="text-card-foreground">${this.formatBytes(t.metadata.codeBytes)}</span>
                </div>
                <div>
                    <span class="font-medium">Tokens (Out/In):</span><br>
                    <span class="text-card-foreground">${t.metadata.completionTokens??"N/A"} / ${t.metadata.promptTokens??"N/A"}</span>
                </div>
                <div>
                    <span class="font-medium">TTFT:</span><br>
                    <span class="text-card-foreground">${this.formatTime(t.metadata.timeToFirstToken)}</span>
                </div>
                <div class="col-span-2">
                    <span class="font-medium">Total Time:</span><br>
                    <span class="text-card-foreground">${this.formatTime(t.metadata.generationTime)}</span>
                </div>
            </div>
        </li>
    `}).join(`
`)}static generateResultsTable(e){return e.map(t=>{const r=t.isPromptRace?t.promptVariantLabel||"Unknown Variant":t.modelName;return`
        <tr class="hover:bg-muted/50">
            <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                    <a href="./${t.isPromptRace?(t.promptVariantLabel||"unknown").replace(/[^a-zA-Z0-9\-_]/g,"_"):t.modelName}.html" target="_blank" rel="noopener noreferrer" 
                       class="text-primary hover:underline font-medium">${r}</a>
                    <span class="inline-flex items-center px-2 py-1 text-xs font-medium rounded ${t.blockType==="runjs"?"bg-green-100 text-green-700":t.blockType==="runpy"?"bg-blue-100 text-blue-700":"bg-gray-100 text-gray-700"}">
                        ${t.blockType.toUpperCase()}
                    </span>
                </div>
            </td>
            <td class="px-4 py-3" data-sort="${t.metadata.responseBytes||0}">${this.formatBytes(t.metadata.responseBytes)}</td>
            <td class="px-4 py-3" data-sort="${t.metadata.codeBytes||0}">${this.formatBytes(t.metadata.codeBytes)}</td>
            <td class="px-4 py-3" data-sort="${t.metadata.completionTokens||0}">${t.metadata.completionTokens??"N/A"}</td>
            <td class="px-4 py-3" data-sort="${t.metadata.promptTokens||0}">${t.metadata.promptTokens??"N/A"}</td>
            <td class="px-4 py-3" data-sort="${t.metadata.timeToFirstToken||0}">${this.formatTime(t.metadata.timeToFirstToken)}</td>
            <td class="px-4 py-3" data-sort="${t.metadata.generationTime||0}">${this.formatTime(t.metadata.generationTime)}</td>
        </tr>
    `}).join(`
`)}static generateIndexHtml(e,t="Race interaction results"){const r=this.generateResultsList(e),o=this.generateResultsTable(e);return`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LLMChef Race Results</title>
    <link rel="stylesheet" href="styles.css">
    <style>
        /* DataTable theming */
        .dataTable-table {
            background: var(--card) !important;
            border: 1px solid var(--border) !important;
            border-radius: 0.5rem !important;
            overflow: hidden !important;
        }
        .dataTable-table thead th {
            background: var(--muted) !important;
            color: var(--card-foreground) !important;
            border-bottom: 1px solid var(--border) !important;
            padding: 12px 16px !important;
        }
        .dataTable-table tbody td {
            color: var(--card-foreground) !important;
            border-bottom: 1px solid var(--border) !important;
            padding: 12px 16px !important;
        }
        .dataTable-table tbody tr:hover {
            background: color-mix(in srgb, var(--muted) 50%, transparent) !important;
        }
        .dataTable-search input,
        .dataTable-selector select {
            background: var(--card) !important;
            border: 2px solid var(--primary) !important;
            color: var(--card-foreground) !important;
            border-radius: 0.5rem !important;
            padding: 0.75rem 1.25rem !important;
        }
        .dataTable-pagination a {
            background: var(--card) !important;
            border: 2px solid var(--primary) !important;
            color: var(--primary) !important;
            border-radius: 0.5rem !important;
            padding: 0.75rem 1.25rem !important;
        }
        .dataTable-pagination a:hover {
            background: var(--primary) !important;
            color: var(--primary-foreground) !important;
        }
    </style>
</head>
<body class="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8">
    <div class="max-w-7xl mx-auto container bg-card rounded-2xl shadow-lg overflow-hidden border border-border">
        <div class="header bg-card border-b border-border p-6 sm:p-8 text-center">
            <div class="flex justify-between items-center mb-4">
                <h1 class="text-3xl sm:text-4xl font-bold text-card-foreground">🚀 LLMChef Race Results</h1>
                <button id="theme-toggle" class="p-2 rounded-md border border-border bg-muted hover:bg-muted/80">
                    <span class="dark:hidden">🌙</span>
                    <span class="hidden dark:inline">☀️</span>
                </button>
            </div>
            <p class="text-muted-foreground">Comparing code generation capabilities of various models.</p>
        </div>
        <div class="content p-6 sm:p-8">
            <div class="prompt-container mb-8">
                <h2 class="text-2xl font-bold mb-4 text-card-foreground">Prompt</h2>
                <div class="markdown-content bg-muted/50 p-4 rounded-lg border border-border">
                    <div class="text-card-foreground prose prose-sm max-w-none" id="prompt-content">${t}</div>
                </div>
            </div>
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-card-foreground">Results</h2>
                <button id="view-toggle" class="px-3 py-1 text-sm font-medium bg-muted hover:bg-muted/80 rounded-md border border-border">View as Table</button>
            </div>
            <ul id="results-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${r}</ul>
            <div id="results-table-container" class="hidden">
                <table id="results-table" class="w-full">
                    <thead>
                        <tr>
                            <th class="text-left">Model</th>
                            <th class="text-left">Response Size</th>
                            <th class="text-left">Code Size</th>
                            <th class="text-left">Completion Tokens</th>
                            <th class="text-left">Prompt Tokens</th>
                            <th class="text-left">TTFT</th>
                            <th class="text-left">Total Time</th>
                        </tr>
                    </thead>
                    <tbody>${o}</tbody>
                </table>
            </div>
        </div>
        <div class="footer bg-muted/50 p-4 border-t border-border text-center text-sm text-muted-foreground">
            Generated by <strong>LLMChef</strong> • Visit <a href="https://wan0net.github.io/llmchef" class="text-primary hover:underline">wan0net.github.io/llmchef</a>
        </div>
    </div>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Theme toggle
            const themeToggle = document.getElementById('theme-toggle');
            const html = document.documentElement;
            
            themeToggle?.addEventListener('click', () => {
                html.classList.toggle('dark');
                localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
            });
            
            // Load saved theme
            if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                html.classList.add('dark');
            }

            // Format prompt as markdown
            const promptContent = document.getElementById('prompt-content');
            if (promptContent) {
                let content = promptContent.innerHTML;
                content = content.replace(/\\n/g, '<br>');
                content = content.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
                content = content.replace(/\\*(.*?)\\*/g, '<em>$1</em>');
                content = content.replace(/\`(.*?)\`/g, '<code class="bg-muted px-1 rounded">\\$1</code>');
                promptContent.innerHTML = content;
            }

            let dataTable = null;
            const btn = document.getElementById('view-toggle');
            const grid = document.getElementById('results-grid');
            const tableContainer = document.getElementById('results-table-container');
            const table = document.getElementById('results-table');
            
            function initDataTable() {
                try {
                    if (dataTable) {
                        dataTable.destroy();
                        dataTable = null;
                    }
                    
                    const dataTables = window.simpleDatatables;
                    if (!table || !dataTables?.DataTable) {
                        return;
                    }
                    
                    dataTable = new dataTables.DataTable(table, {
                        searchable: true,
                        sortable: true,
                        perPage: 25,
                        perPageSelect: [10, 25, 50, 100],
                        fixedHeight: false,
                        labels: {
                            placeholder: "Search models...",
                            perPage: "Show {select} models per page",
                            noRows: "No models found",
                            info: "Showing {start} to {end} of {rows} models"
                        }
                    });
                } catch (error) {
                    // Silent fallback
                }
            }
            
            if (btn) {
                btn.addEventListener('click', () => {
                    const isCurrentlyGrid = !grid.classList.contains('hidden');
                    
                    if (isCurrentlyGrid) {
                        grid.classList.add('hidden');
                        tableContainer.classList.remove('hidden');
                        btn.textContent = 'View as Grid';
                        setTimeout(initDataTable, 100);
                    } else {
                        tableContainer.classList.add('hidden');
                        grid.classList.remove('hidden');
                        btn.textContent = 'View as Table';
                        if (dataTable) {
                            dataTable.destroy();
                            dataTable = null;
                        }
                    }
                });
            }
        });
    <\/script>
</body>
</html>`}static async exportRaceResults(e,t){const r=this.processRaceInteractions(e);if(r.length===0)throw new Error("No valid race results found to export");const o=await this.getCurrentCssContent(),a=new w;a.file("styles.css",o);for(const i of r){const l=this.generateModelHtmlPage(i),s=i.isPromptRace?(i.promptVariantLabel||"unknown").replace(/[^a-zA-Z0-9\-_]/g,"_"):i.modelName;a.file(`${s}.html`,l)}const n=this.generateIndexHtml(r,t);return a.file("index.html",n),await a.generateAsync({type:"blob"})}}class D{id="core-canvas-race-result-export";async initialize(e){const t=e.on(u.raceResultExportRequest,async r=>{await this.handleRaceResultExport(r.interactionId,r.conversationId)});this.unsubscribeRaceExport=t}unsubscribeRaceExport;register(e){e.registerCanvasControl({id:this.id,type:"interaction",targetSlot:"actions",renderer:t=>{if(!t.interactionId||!t.interaction)return null;const r=t.interaction;if(!this.isRaceInteraction(r)||r.status!=="COMPLETED")return null;const o=this.getMainRaceInteractionId(r);return h.createElement(R,{interactionId:o,conversationId:r.conversationId})}})}destroy(){this.unsubscribeRaceExport&&(this.unsubscribeRaceExport(),this.unsubscribeRaceExport=void 0)}isRaceInteraction(e){return e.metadata?.raceTab===!0||e.metadata?.isRaceCombining===!0||e.metadata?.raceMainInteractionId!==void 0}isMainRaceInteraction(e){return e.metadata?.isRaceCombining===!0||e.metadata?.raceMainInteractionId===e.id||e.parentId===null&&this.isRaceInteraction(e)}getMainRaceInteractionId(e){return this.isMainRaceInteraction(e)?e.id:e.parentId?e.parentId:e.metadata?.raceMainInteractionId&&e.metadata.raceMainInteractionId!==e.id?e.metadata.raceMainInteractionId:e.id}getRaceInteractions(e){const r=T.getState().interactions,o=r.find(n=>n.id===e);if(!o)return[];const a=[];if(o.metadata?.isRaceCombining){a.push(o);const n=r.filter(i=>i.parentId===e);a.push(...n)}else{a.push(o);const n=r.filter(i=>i.parentId===e);a.push(...n)}return a}async handleRaceResultExport(e,t){try{d.info("Preparing race results for export...");const r=this.getRaceInteractions(e);if(r.length===0){d.error("No race interactions found to export");return}const o=r.filter(c=>!(c.metadata?.isRaceCombining&&!c.response));if(o.length===0){d.error("No participant interactions found to export");return}const n=r[0].prompt?.content||"Race interaction results",i=await C.exportRaceResults(o,n),l=URL.createObjectURL(i),s=document.createElement("a");s.href=l,s.download=`llmchef-race-results-${new Date().toISOString().slice(0,19).replace(/[:.]/g,"-")}.zip`,document.body.appendChild(s),s.click(),document.body.removeChild(s),URL.revokeObjectURL(l),d.success(`Race results exported! Downloaded ZIP with ${o.length} model results.`)}catch(r){const o=r instanceof Error?r.message:String(r);d.error(`Failed to export race results: ${o}`),console.error("Race result export error:",r)}}}export{D as RaceResultExportControlModule};
