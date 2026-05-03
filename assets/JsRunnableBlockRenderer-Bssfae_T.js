const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-BJpeY9G6.js","assets/vendor-diagrams-CYdxlTtN.js","assets/vendor-react-Du8Qqd40.js"])))=>i.map(i=>d[i]);
import{p as Ue,_ as Fe}from"./vendor-diagrams-CYdxlTtN.js";import{r as s,j as t,R as Je}from"./vendor-react-Du8Qqd40.js";import{P as He}from"./vendor-editor-BMKARdr8.js";import{u as $e,Q as we,b as A,ad as Qe,a2 as qe,a3 as De,a4 as Ae,a5 as ze,a6 as ye,A as _,B as We,af as Ke}from"./index-Cfs87ec2.js";import{t as h,l as Ve,m as xe,M as be,i as ve,n as Ye,C as Ge,E as Xe,o as Ze,D as et,p as tt}from"./vendor-ui-CI3N22a5.js";import{C as rt}from"./code-security.service-DK7pbtwF.js";import"./vendor-data-Cg1t-RTV.js";import"./vendor-ai-Cpm0OBFa.js";let P=null;const ot=()=>window.llmChefQuickJS?.isReady&&window.llmChefQuickJS.QuickJS&&window.llmChefQuickJS.context?Promise.resolve({QuickJS:window.llmChefQuickJS.QuickJS,vm:window.llmChefQuickJS.context}):P||(window.llmChefQuickJS={isLoading:!0,isReady:!1,loadPromise:void 0,QuickJS:void 0,context:void 0},P=Fe(()=>import("./index-BJpeY9G6.js"),__vite__mapDeps([0,1,2])).then(async({getQuickJS:c})=>{const L=await c(),N=L.newContext();return window.llmChefQuickJS={isLoading:!1,isReady:!0,loadPromise:void 0,QuickJS:L,context:N},window.dispatchEvent(new CustomEvent("quickjs-ready",{detail:{QuickJS:L,vm:N}})),{QuickJS:L,vm:N}}).catch(c=>{throw window.llmChefQuickJS={isLoading:!1,isReady:!1,loadPromise:void 0,QuickJS:void 0,context:void 0},P=null,window.dispatchEvent(new CustomEvent("quickjs-error",{detail:c})),c}),window.llmChefQuickJS.loadPromise=P.then(()=>{}),P),nt=({code:c,isStreaming:L=!1,interactionId:N,blockId:F})=>{const{t:a}=$e("renderers"),{foldStreamingCodeBlocks:ke}=we(A(r=>({foldStreamingCodeBlocks:r.foldStreamingCodeBlocks}))),Q=we(A(r=>r.runnableBlocksEnabled)),[g,Ce]=s.useState(L?ke:!1),[m,z]=s.useState(!1),[p,W]=s.useState(c),[q,J]=s.useState(!1),[K,V]=s.useState([]),[T,j]=s.useState(!1),[y,E]=s.useState(!1),[Y,G]=s.useState(!1),[d,X]=s.useState(null),[Z,ee]=s.useState(!1),[B,I]=s.useState(0),[te,re]=s.useState(0),[x,Se]=s.useState("safe"),oe=s.useMemo(()=>F||`js-block-${Math.random().toString(36).substr(2,9)}`,[F]),[R,O]=s.useState(()=>typeof window<"u"&&window.llmChefQuickJS?window.llmChefQuickJS.isReady?"ready":window.llmChefQuickJS.isLoading?"loading":"idle":"idle"),S=s.useRef(null),n=s.useRef(null),U=s.useRef(null),ne=Qe(A(r=>Object.values(r.canvasControls)));s.useEffect(()=>{function r(){window.llmChefQuickJS?.isReady?O("ready"):window.llmChefQuickJS?.isLoading?O("loading"):O("idle")}function o(){O("ready")}function e(){O("error")}return window.addEventListener("quickjs-ready",o),window.addEventListener("quickjs-error",e),r(),()=>{window.removeEventListener("quickjs-ready",o),window.removeEventListener("quickjs-error",e)}},[]),s.useEffect(()=>{m||W(c)},[c,m]),s.useEffect(()=>{n.current&&U.current&&(!g&&y?(n.current.parentNode!==U.current&&U.current.appendChild(n.current),n.current.style.position="relative",n.current.style.top="0",n.current.style.left="0",n.current.style.width="100%",n.current.style.height="100%",n.current.style.visibility="visible",n.current.style.pointerEvents="auto",n.current.style.zIndex="1"):(n.current.parentNode===U.current&&document.body.appendChild(n.current),n.current.style.position="absolute",n.current.style.top="-9999px",n.current.style.left="-9999px",n.current.style.width="1px",n.current.style.height="1px",n.current.style.visibility="hidden",n.current.style.pointerEvents="none",n.current.style.zIndex="-1"))},[y,g]),s.useEffect(()=>{X(null),I(0),re(0)},[p]);const je=s.useCallback((r,o,e,i,u,M)=>ne.filter(b=>b.type==="codeblock"&&b.targetSlot===r&&b.renderer).map(b=>{if(b.renderer){const v={codeBlockContent:o,codeBlockEditedContent:p,codeBlockLang:"javascript",codeBlockFilepath:void 0,isFolded:u,toggleFold:M,canvasContextType:"codeblock",interactionId:N,blockId:F,onEditModeChange:z};return t.jsx(Je.Fragment,{children:b.renderer(v)},b.id)}return null}).filter(Boolean),[ne,p,N,F,z]),D=s.useCallback(()=>{if(S.current&&(m?p:c))try{S.current.style.whiteSpace!=="pre-wrap"&&(S.current.style.whiteSpace="pre-wrap"),S.current.textContent=m?p:c,He.highlightElement(S.current)}catch(r){console.error("Prism highlight error:",r),S.current.textContent=m?p:c}else S.current&&(S.current.textContent="")},[c,p,m]);s.useEffect(()=>{!g&&!T&&!y&&D()},[c,p,m,g,T,y,D]),s.useEffect(()=>()=>{if(n.current)try{n.current.querySelectorAll("iframe").forEach(o=>{const e=o.__llmchefMessageHandler;e&&(window.removeEventListener("message",e),delete o.__llmchefMessageHandler)}),n.current.innerHTML=""}catch{}},[]);const se=()=>{const r=g;Ce(o=>!o),r&&setTimeout(D,0)},Ee=s.useCallback(async()=>{ee(!0);try{const r=m?p:c,o=await rt.validateCodeSecurity(r,"javascript");X(o),o.score>90?h.error(`High-risk code detected (Score: ${o.score}/100). Please review carefully before running.`):o.score>60?h.warning(`Potentially risky code detected (Score: ${o.score}/100). Use caution when running.`):o.score>30?h.info(`Moderate-risk code detected (Score: ${o.score}/100). Review before running.`):h.success(`Code security check passed (Score: ${o.score}/100).`)}catch(r){console.error("Security check failed:",r),h.error(a("jsRunnableBlock.securityCheckFailed"))}finally{ee(!1)}},[c,p,m]),ie=s.useCallback(async(r,o)=>{const e=window.llmChefQuickJS.context;try{const i=e.newObject(),u=e.newObject(),M=e.newFunction("log",(...l)=>{const w=l.map(f=>e.dump(f));return o.push(w.join(" ")),e.undefined});e.setProp(u,"log",M),e.setProp(i,"utils",u);const b=e.newFunction("toast",l=>{const w=e.dump(l);return h(w),e.undefined});e.setProp(i,"toast",b);const v=new Map;let k=1;const de=()=>`qjsnode_${k++}`,ue=e.newFunction("__getRootId",()=>{let l=n.current.__qjs_id;return l||(l=de(),n.current.__qjs_id=l,v.set(l,n.current)),e.newString(l)});e.setProp(e.global,"__getRootId",ue);const me=e.newFunction("__createElement",l=>{const w=e.dump(l),f=document.createElement(w),C=de();return f.__qjs_id=C,v.set(C,f),e.newString(C)});e.setProp(e.global,"__createElement",me);const pe=e.newFunction("__appendChild",(l,w)=>{const f=v.get(e.dump(l)),C=v.get(e.dump(w));return f&&C&&f.appendChild(C),e.undefined});e.setProp(e.global,"__appendChild",pe);const fe=e.newFunction("__setTextContent",(l,w)=>{const f=v.get(e.dump(l));return f&&(f.textContent=e.dump(w)),e.undefined});e.setProp(e.global,"__setTextContent",fe);const ge=e.newFunction("__setInnerHTML",(l,w)=>{const f=v.get(e.dump(l));return f&&f instanceof Element&&(f.innerHTML=Ue.sanitize(e.dump(w),{USE_PROFILES:{html:!0}})),e.undefined});e.setProp(e.global,"__setInnerHTML",ge);const he=e.newFunction("__setStyle",(l,w,f)=>{const C=v.get(e.dump(l));return C&&C instanceof HTMLElement&&(C.style[e.dump(w)]=e.dump(f)),e.undefined});e.setProp(e.global,"__setStyle",he),e.setProp(e.global,"llmchef",i);const H=e.evalCode(`
        function QNode(id) { this.__id = id; }
        QNode.prototype.appendChild = function(child) { __appendChild(this.__id, child.__id); return this; };
        QNode.prototype.setStyle = function(property, value) { __setStyle(this.__id, property, value); return this; };
        Object.defineProperty(QNode.prototype, 'textContent', {
          set: function(value) { __setTextContent(this.__id, value); }
        });
        Object.defineProperty(QNode.prototype, 'innerHTML', {
          set: function(value) { __setInnerHTML(this.__id, value); }
        });
        
        function createElement(tag) { return new QNode(__createElement(tag)); }
        function getRoot() { return new QNode(__getRootId()); }
        
        // Console API
        const console = {
          log: (...args) => llmchef.utils.log(...args)
        };
      `);H.error?(console.error("API setup error:",e.dump(H.error)),H.error.dispose()):H.value.dispose();const $=e.evalCode(r);if($.error){const l=e.dump($.error);o.push(`QuickJS Error: ${l}`),$.error.dispose()}else $.value.dispose(),o.length===0&&o.push("Code executed successfully in safe mode");[M,b,ue,me,pe,fe,ge,he].forEach(l=>l.dispose()),[i,u].forEach(l=>l.dispose())}catch(i){o.push(`Safe execution error: ${i instanceof Error?i.message:String(i)}`)}},[]),ae=s.useCallback(async(r,o)=>{let e=null;try{n.current&&(n.current.innerHTML="");const i=document.createElement("iframe");i.style.width="100%",i.style.height=`${Math.floor(window.innerHeight*.67)}px`,i.style.border="none",i.style.borderRadius="8px",i.sandbox.add("allow-scripts");const u=window.crypto?.randomUUID?.()??Math.random().toString(36).slice(2),M=window.location.origin,b=JSON.stringify(r).replace(/</g,"\\u003c"),v=`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' ${M}; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; worker-src 'none'; child-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LLMChef Iframe Execution</title>
    <style>
        body { 
            margin: 0; 
            padding: 16px; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: white;
        }
        #llmchef-target { 
            width: 100%; 
            min-height: 200px; 
        }
    </style>
</head>
<body>
    <div id="llmchef-target"></div>
    
    <script type="module">
        const parentOrigin = ${JSON.stringify(M)};
        const messageToken = ${JSON.stringify(u)};
        const userCode = ${b};
        const target = document.getElementById('llmchef-target');
        const logs = [];
        const deny = (name) => () => { throw new Error(name + ' is disabled in iframe execution.'); };
        window.fetch = deny('Network access');
        window.XMLHttpRequest = undefined;
        window.WebSocket = undefined;
        window.EventSource = undefined;
        window.Worker = undefined;
        window.SharedWorker = undefined;
        if (window.URL && typeof window.URL === 'function') {
            const OriginalURL = window.URL;
            window.URL = new Proxy(OriginalURL, {
                get(targetUrl, prop, receiver) {
                    if (prop === 'createObjectURL') return deny('Object URL creation');
                    if (prop === 'revokeObjectURL') return () => undefined;
                    return Reflect.get(targetUrl, prop, receiver);
                },
            });
        }

        const postToParent = (message) => {
            window.parent.postMessage({ ...message, token: messageToken }, parentOrigin);
        };

        const assertLocalResource = (url, label) => {
            const parsed = new URL(url, parentOrigin);
            if (parsed.origin !== parentOrigin) {
                throw new Error(label + ' must be served from the LLMChef origin.');
            }
        };
        
        // Minimal LLMChef API for iframe mode
        window.llmchef = {
            target: target,
            utils: {
                log: (...args) => {
                    const formatted = args.map(arg => 
                        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
                    ).join(" ");
                    logs.push(formatted);
                    console.log(...args);
                    // Send log to parent (if needed)
                    postToParent({
                        type: 'llmchef-log',
                        message: formatted
                    });
                },
                toast: (message) => {
                    // Simple toast in iframe
                    const toast = document.createElement('div');
                    toast.style.cssText = 'position:fixed;top:16px;right:16px;background:#3b82f6;color:white;padding:12px;border-radius:8px;z-index:1000;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
                    toast.textContent = message;
                    document.body.appendChild(toast);
                    setTimeout(() => {
                        if (toast.parentNode) toast.parentNode.removeChild(toast);
                    }, 3000);
                },
                loadModule: async (moduleUrl, moduleName, globalKey, importMap) => {
                    const key = globalKey || moduleName;
                    assertLocalResource(moduleUrl, 'Module URL');
                    Object.values(importMap || {}).forEach(url => assertLocalResource(url, 'Import map URL'));
                    if (window[key]) return window[key];
                    
                    try {
                        if (importMap) {
                            const existingMap = document.querySelector('script[type="importmap"]');
                            if (existingMap) existingMap.remove();
                            
                            const mapScript = document.createElement('script');
                            mapScript.type = 'importmap';
                            mapScript.textContent = JSON.stringify({ imports: importMap });
                            document.head.appendChild(mapScript);
                            
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                        
                        const module = await import(moduleUrl);
                        window[key] = module;
                        return module;
                    } catch (error) {
                        console.error(\`Error loading module \${moduleName}:\`, error);
                        throw error;
                    }
                },
                loadModules: async (moduleConfigs) => {
                    // Simplified version for iframe
                    const loadedModules = {};
                    for (const config of moduleConfigs) {
                        const module = await window.llmchef.utils.loadModule(
                            config.url, 
                            config.name, 
                            config.globalKey, 
                            config.importMap
                        );
                        loadedModules[config.globalKey || config.name] = module;
                    }
                    return loadedModules;
                },
                loadScript: async (src) => {
                    return new Promise((resolve, reject) => {
                        try {
                            assertLocalResource(src, 'Script URL');
                        } catch (error) {
                            reject(error);
                            return;
                        }
                        if ([...document.scripts].some(s => s.src === src)) {
                            resolve();
                            return;
                        }
                        const script = document.createElement('script');
                        script.src = src;
                        script.async = true;
                        script.onload = () => resolve();
                        script.onerror = (e) => reject(new Error(\`Failed to load script: \${src}\`));
                        document.head.appendChild(script);
                    });
                }
            },
            emit: (eventName, payload) => {
                postToParent({
                    type: 'llmchef-event',
                    eventName,
                    payload
                });
            }
        };
        
        // Auto-resize iframe to content
        function resizeIframe() {
            const minHeight = Math.floor(window.parent.innerHeight * 0.67);
            const height = Math.max(document.body.scrollHeight, minHeight);
            postToParent({
                type: 'llmchef-resize',
                height: height
            });
        }
        
        // Execute user code
        try {
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
            await new AsyncFunction(userCode)();
            // Resize after code execution
            setTimeout(resizeIframe, 100);
        } catch (error) {
            console.error('Iframe execution error:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'p-4 text-red-600 bg-red-100 border border-red-200 rounded-md';
            errorDiv.textContent = \`Error: \${error.message}\`;
            target.appendChild(errorDiv);
            
            postToParent({
                type: 'llmchef-error',
                error: error.message
            });
            
            // Resize after error display
            setTimeout(resizeIframe, 100);
        }
    <\/script>
</body>
</html>`;e=k=>{if(k.source===i.contentWindow&&k.origin==="null"&&k.data?.token===u)switch(k.data.type){case"llmchef-log":o.push(k.data.message);break;case"llmchef-error":o.push(`Iframe Error: ${k.data.error}`);break;case"llmchef-resize":i.style.height=`${k.data.height}px`;break;case"llmchef-event":break}},window.addEventListener("message",e),i.srcdoc=v,n.current?.appendChild(i),i.__llmchefMessageHandler=e,await new Promise(k=>setTimeout(k,1e3)),o.length===0&&o.push("Code executed successfully in iframe mode")}catch(i){o.push(`Iframe execution error: ${i instanceof Error?i.message:String(i)}`)}},[]),le=s.useCallback(async()=>{if(x==="safe"&&(!window.llmChefQuickJS?.isReady||!window.llmChefQuickJS.context)){h.error("Safe execution environment not ready. Please try again."),J(!1);return}const r=[];if(n.current)try{n.current.innerHTML=""}catch(e){console.warn("Preview cleanup failed:",e)}const o=m?p:c;try{x==="safe"?await ie(o,r):await ae(o,r)}catch(e){r.push(`Execution Error: ${e instanceof Error?e.message:String(e)}`)}finally{if(V(r),G(!0),J(!1),x==="iframe"?(E(!0),j(!1),setTimeout(()=>{!(n.current&&(n.current.children.length>0||n.current.innerHTML.trim().length>0))&&r.length>0&&(j(!0),E(!1))},1500)):n.current&&(n.current.children.length>0||n.current.innerHTML.trim().length>0)?(E(!0),j(!1)):(j(!0),E(!1)),r.some(e=>e.includes("Error:")))h.error(a("jsRunnableBlock.executionFailed"));else{const e=a(x==="safe"?"jsRunnableBlock.safeMode":"jsRunnableBlock.iframeMode");h.success(a("jsRunnableBlock.executionSuccess",{mode:e}))}}},[c,p,m,x,ie,ae,a]),Re=s.useCallback(async()=>{if(!Q){h.error("Runnable blocks are disabled in settings.");return}if(d){const r=Date.now();r-te>3e3&&I(0),re(r);const e=B+1;if(I(e),e<d.clicksRequired){const i=d.clicksRequired-e;h.info(`Click ${i} more time${i>1?"s":""} to confirm execution (Risk: ${d.riskLevel})`);return}if(d.score>90&&!window.confirm(`This code has a very high security risk score (${d.score}/100). Are you absolutely sure you want to run it?`)){I(0);return}I(0)}if(J(!0),x==="safe"&&(!window.llmChefQuickJS?.isReady||!window.llmChefQuickJS.context))try{await ot()}catch{J(!1);return}le()},[Q,x,le,d,B,te]),Me=()=>{j(!0),E(!1)},Le=()=>{E(!0),j(!1)},Ne=()=>{j(!1),E(!1)},_e=s.useMemo(()=>c?c.split(`
`).slice(0,3).join(`
`):"",[c]),Pe=je("codeblock-header-actions",m?p:c,"javascript",void 0,g,se),Te=()=>q?a("jsRunnableBlock.running"):R==="loading"?a("jsRunnableBlock.loading"):x==="safe"&&R!=="ready"?a("jsRunnableBlock.run"):d&&B>0&&B<d.clicksRequired?a("jsRunnableBlock.clickMore",{count:d.clicksRequired-B}):a("jsRunnableBlock.run"),Be=s.useCallback(()=>{n.current&&(n.current.querySelectorAll("iframe").forEach(o=>{const e=o.__llmchefMessageHandler;e&&(window.removeEventListener("message",e),delete o.__llmchefMessageHandler)}),n.current.innerHTML=""),V([]),G(!1),j(!1),E(!1);try{document.querySelectorAll('script[data-llmchef-runnable-script="true"]').forEach(o=>{o.parentNode&&o.parentNode.removeChild(o)}),["THREE","OrbitControls","D3","moment","lodash"].forEach(o=>{window[o]&&delete window[o]})}catch(r){console.warn("Error during cleanup:",r)}h.success(a("jsRunnableBlock.previewCleared"))},[]),Ie=s.useCallback(()=>{const r=m?p:c;if(!r.trim()){h.error(a("jsRunnableBlock.noCodeToDownload"));return}const o=`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LLMChef JS Executable</title>
    <style>
        body { margin: 0; padding: 20px; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #eef2ff; }
        a { color: #2563eb; }
    </style>
</head>
<body class="m-0 p-5 bg-gradient-to-br from-indigo-500 to-purple-600 min-h-screen font-sans">
    <div class="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
        <div class="bg-gradient-to-r from-indigo-600 to-purple-700 text-white p-5 text-center">
            <h1 class="text-2xl font-bold mb-2">🚀 LLMChef Executable</h1>
        </div>
        <div class="p-5 min-h-96">
            <div id="llmchef-target" class="w-full min-h-72"></div>
        </div>
        <div class="bg-slate-50 px-5 py-4 border-t border-slate-200 text-center text-slate-600 text-sm">
            Generated by <strong>LLMChef</strong> • Visit <a href="https://wan0net.github.io/llmchef" class="text-blue-600 hover:underline">wan0net.github.io/llmchef</a>
        </div>
    </div>

    <script type="module">
        // LLMChef API Implementation
        const llmchefTarget = document.getElementById('llmchef-target');
        const capturedLogs = [];

        const assertLocalResource = (url, label) => {
            const parsed = new URL(url, window.location.origin);
            if (parsed.origin !== window.location.origin) {
                throw new Error(label + ' must be served from the LLMChef origin.');
            }
        };

        // Enhanced module loading with import map support
        async function loadModule(moduleUrl, moduleName, globalKey, importMap) {
            const key = globalKey || moduleName;
            assertLocalResource(moduleUrl, 'Module URL');
            Object.values(importMap || {}).forEach(url => assertLocalResource(url, 'Import map URL'));
            // Check if already loaded
            if (window[key]) {
                return window[key];
            }

            try {
                // Setup import map if provided
                if (importMap) {
                    // Remove any existing import map first
                    const existingMap = document.querySelector('script[type="importmap"]');
                    if (existingMap) {
                        existingMap.remove();
                    }

                    const mapScript = document.createElement('script');
                    mapScript.type = 'importmap';
                    mapScript.textContent = JSON.stringify({ imports: importMap });
                    document.head.appendChild(mapScript);

                    // Wait for the import map to be processed
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // Dynamic import
                const module = await import(moduleUrl);
                window[key] = module;

                // Dispatch ready event
                window.dispatchEvent(new CustomEvent(\`\${moduleName.toLowerCase()}-ready\`, {
                    detail: { [moduleName]: module }
                }));

                return module;
            } catch (error) {
                console.error(\`Error loading module \${moduleName}:\`, error);
                window.dispatchEvent(new CustomEvent(\`\${moduleName.toLowerCase()}-error\`, {
                    detail: error
                }));
                throw error;
            }
        }

        // Enhanced loadModules function
        async function loadModules(moduleConfigs) {
            const loadedModules = {};
            const loadPromises = {};

            // 1. Merge all import maps from module configs
            const globalImportMap = {};
            moduleConfigs.forEach(config => {
                assertLocalResource(config.url, 'Module URL');
                if (config.importMap) {
                    Object.values(config.importMap).forEach(url => assertLocalResource(url, 'Import map URL'));
                    Object.assign(globalImportMap, config.importMap);
                }
            });

            // 2. Remove any existing import map
            const existingMap = document.querySelector('script[type="importmap"]');
            if (existingMap) existingMap.remove();

            // 3. Inject the new import map
            if (Object.keys(globalImportMap).length > 0) {
                const mapScript = document.createElement('script');
                mapScript.type = 'importmap';
                mapScript.textContent = JSON.stringify({ imports: globalImportMap });
                document.head.appendChild(mapScript);

                // 4. Wait for the import map to be processed
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // 5. Helper function to load a single module
            const loadSingleModule = async (config) => {
                const key = config.globalKey || config.name;
                if (window[key]) return window[key];
                if (key in loadPromises) return loadPromises[key];

                // Wait for dependencies first
                if (config.dependencies) {
                    await Promise.all(config.dependencies.map(depKey => {
                        const depModule = moduleConfigs.find(m => (m.globalKey || m.name) === depKey);
                        if (depModule) return loadSingleModule(depModule);
                        return Promise.resolve();
                    }));
                }

                // Load the module
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

            // 6. Load all modules
            await Promise.all(moduleConfigs.map(config => loadSingleModule(config)));

            return loadedModules;
        }

        // Load script function
        async function loadScript(src) {
            return new Promise((resolve, reject) => {
                try {
                    assertLocalResource(src, 'Script URL');
                } catch (error) {
                    reject(error);
                    return;
                }
                // Check if already loaded
                if ([...document.scripts].some(s => s.src === src)) {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = src;
                script.async = true;
                script.onload = () => resolve();
                script.onerror = (e) => {
                    const errorMessage = e instanceof Error ? e.message : String(e);
                    reject(new Error(\`Failed to load script: \${src} - \${errorMessage}\`));
                };
                document.head.appendChild(script);
            });
        }

        // Toast function (simple alert fallback)
        function showToast(message) {
            // Create a simple toast notification
            const toast = document.createElement('div');
            toast.className = 'fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300';
            toast.textContent = message;
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(-20px)';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }, 3000);
        }

        // LLMChef API object
        window.llmchef = {
            utils: {
                log: (...args) => {
                    const formatted = args.map(arg => 
                        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
                    ).join(" ");
                    capturedLogs.push(formatted);
                    console.log(...args);
                },
                toast: showToast,
                error: (...args) => {
                    const formatted = args.map(arg => 
                        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
                    ).join(" ");
                    capturedLogs.push(\`Error: \${formatted}\`);
                    console.error(...args);
                },
                warn: (...args) => {
                    const formatted = args.map(arg => 
                        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
                    ).join(" ");
                    capturedLogs.push(\`Warning: \${formatted}\`);
                    console.warn(...args);
                },
                loadModule,
                loadModules,
                loadScript
            },
            target: llmchefTarget,
            emit: (eventName, payload) => {
                window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
            }
        };

        // Execute the user's code after page load
        window.addEventListener('load', async () => {
            try {
                // User's code will be inserted here
                ${r}
            } catch (error) {
                console.error('Execution error:', error);
                const errorDiv = document.createElement('div');
                errorDiv.className = 'p-4 text-red-600 bg-red-100 border border-red-200 rounded-md';
                errorDiv.textContent = \`Error: \${error.message}\`;
                llmchefTarget.appendChild(errorDiv);
            }
        });
    <\/script>
</body>
</html>`,e=new Blob([o],{type:"text/html"}),i=URL.createObjectURL(e),u=document.createElement("a");u.href=i,u.download="llmchef-executable.html",document.body.appendChild(u),u.click(),document.body.removeChild(u),URL.revokeObjectURL(i),h.success("Executable HTML file downloaded successfully!")},[c,p,m]),[Oe,ce]=s.useState(!1);return s.useEffect(()=>{if(y&&n.current){const r=()=>{const e=n.current?n.current.children.length>0||n.current.innerHTML.trim().length>0:!1;ce(e)};r();const o=new MutationObserver(r);return o.observe(n.current,{childList:!0,subtree:!0,attributes:!1,characterData:!0}),()=>o.disconnect()}else ce(!1)},[y,Y]),s.useEffect(()=>{const r=n.current;if(!r)return;r.tabIndex=0;const o=u=>{if(document.activeElement!==r)return;["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","Tab","PageUp","PageDown","Home","End"].includes(u.key)&&u.preventDefault()},e=()=>window.addEventListener("keydown",o,{capture:!0}),i=()=>window.removeEventListener("keydown",o,{capture:!0});return r.addEventListener("focus",e),r.addEventListener("blur",i),()=>{r.removeEventListener("focus",e),r.removeEventListener("blur",i),window.removeEventListener("keydown",o,{capture:!0})}},[n]),t.jsxs("div",{className:"code-block-container group/codeblock my-4 max-w-full",children:[t.jsxs("div",{className:"code-block-header sticky top-0 z-[var(--z-sticky)] flex items-center justify-between px-3 py-2 border border-b-0 border-border bg-muted/50 rounded-t-lg",children:[t.jsxs("div",{className:"flex items-center gap-1",children:[t.jsx("div",{className:"text-sm font-medium",children:a("jsRunnableBlock.header")}),R==="ready"&&t.jsx("div",{className:"text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded",children:a("jsRunnableBlock.quickjsReady")}),R==="loading"&&t.jsx("div",{className:"text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded",children:a("jsRunnableBlock.quickjsLoading")}),R==="error"&&t.jsx("div",{className:"text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded",children:a("jsRunnableBlock.quickjsError")}),t.jsx("span",{className:`text-xs px-1.5 py-0.5 rounded ${x==="safe"?"bg-green-100 text-green-700":"bg-blue-100 text-blue-700"}`,children:a(x==="safe"?"jsRunnableBlock.safe":"jsRunnableBlock.iframe")}),d&&t.jsxs("div",{className:"flex items-center gap-1 text-xs",style:{color:d.color},children:[t.jsx(Ve,{className:"h-3 w-3"}),t.jsxs("span",{children:[d.score,"/100 (",d.riskLevel,")"]})]}),t.jsx("div",{className:"flex items-center gap-0.5 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity",children:Pe})]}),t.jsxs("div",{className:"flex items-center gap-1",children:[t.jsxs(qe,{value:x,onValueChange:r=>Se(r),children:[t.jsx(De,{className:"w-24 h-7 text-xs",children:t.jsx(Ae,{})}),t.jsxs(ze,{children:[t.jsx(ye,{value:"safe",className:"text-xs",children:t.jsxs("div",{className:"flex items-center gap-1",children:[t.jsx(xe,{className:"h-3 w-3 text-green-600"}),"Safe"]})}),t.jsx(ye,{value:"iframe",className:"text-xs",children:t.jsxs("div",{className:"flex items-center gap-1",children:[t.jsx(be,{className:"h-3 w-3 text-blue-600"}),"Iframe"]})})]})]}),t.jsx(_,{tooltipText:a(d?"jsRunnableBlock.recheckSecurity":"jsRunnableBlock.checkSecurity"),onClick:Ee,disabled:Z,className:"text-xs h-7",icon:Z?t.jsx(ve,{className:"h-3 w-3 mr-1 animate-spin"}):t.jsx(xe,{className:"h-3 w-3 mr-1"})}),t.jsx(_,{tooltipText:a("jsRunnableBlock.downloadExecutable"),onClick:Ie,className:"text-xs h-7",icon:t.jsx(Ye,{className:"h-3 w-3 mr-1"})}),Y&&t.jsxs(t.Fragment,{children:[t.jsx(_,{tooltipText:a("jsRunnableBlock.showCode"),onClick:Ne,className:"text-xs h-7",icon:t.jsx(Ge,{className:"h-3 w-3 mr-1"})}),t.jsx(_,{tooltipText:a("jsRunnableBlock.showConsole"),onClick:Me,className:"text-xs h-7",icon:t.jsx(be,{className:"h-3 w-3 mr-1"})}),t.jsx(_,{tooltipText:a("jsRunnableBlock.showPreview"),onClick:Le,className:"text-xs h-7",icon:t.jsx(Xe,{className:"h-3 w-3 mr-1"})}),t.jsx(_,{tooltipText:a("jsRunnableBlock.stopAndClear"),onClick:Be,className:"text-xs h-7",icon:t.jsx(Ze,{className:"h-3 w-3 mr-1"})})]}),t.jsxs(We,{size:"sm",onClick:Re,disabled:q||R==="loading"||!Q,className:"text-xs h-7 "+(d?d.score>90?"bg-[var(--destructive)] border-[var(--destructive)] text-[var(--destructive-foreground)]":d.score>60?"bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-foreground)]":d.score>30?"bg-[var(--warning,var(--primary))] border-[var(--warning,var(--primary))] text-[var(--foreground)]":"bg-[var(--primary)] border-[var(--primary)] text-[var(--primary-foreground)]":""),children:[q||R==="loading"?t.jsx(ve,{className:"h-3 w-3 mr-1 animate-spin"}):R!=="ready"&&x==="safe"?t.jsx(et,{className:"h-3 w-3 mr-1"}):t.jsx(tt,{className:"h-3 w-3 mr-1"}),Te()]})]})]}),!g&&!T&&!y&&!m&&t.jsx("div",{className:"overflow-hidden w-full",children:t.jsx("pre",{className:"overflow-x-auto w-full relative overflow-wrap-anywhere border border-border rounded-b-lg bg-muted/20",children:t.jsx("code",{ref:S,className:"language-javascript block p-4 font-mono text-sm leading-relaxed"})})}),!g&&!T&&!y&&m&&t.jsx("div",{className:"overflow-hidden w-full border border-border rounded-b-lg bg-muted/20",children:t.jsx(Ke,{code:p,language:"javascript",onChange:W})}),!g&&T&&t.jsxs("div",{className:"output-container border border-border rounded-b-lg bg-black/90 text-green-400 p-4 font-mono text-sm",children:[t.jsx("div",{className:"output-header text-green-300 mb-2 text-xs font-semibold",children:a("jsRunnableBlock.consoleOutput")}),K.length>0?K.map((r,o)=>t.jsx("div",{className:r.startsWith("Execution Error:")||r.startsWith("Error:")?"text-red-400":r.startsWith("Warning:")?"text-yellow-400":"text-green-400",children:r},o)):t.jsx("div",{className:"text-muted-foreground",children:a("jsRunnableBlock.noOutput")})]}),t.jsx("div",{className:!g&&y?"preview-container border border-border rounded-b-lg bg-background p-4":"preview-container-hidden",style:{display:!g&&y?"block":"none",minHeight:!g&&y?"100px":"0"},suppressHydrationWarning:!0,children:!g&&y&&t.jsxs(t.Fragment,{children:[t.jsx("div",{className:"preview-header text-muted-foreground mb-2 text-xs font-semibold",children:a("jsRunnableBlock.preview")}),t.jsx("div",{ref:U,className:"preview-content min-h-[100px] border border-dashed border-muted-foreground/20 rounded p-2 relative",id:`preview-content-${oe}`,children:!Oe&&t.jsx("div",{className:"text-muted-foreground text-sm italic absolute inset-0 flex items-center justify-center pointer-events-none z-10",children:a("jsRunnableBlock.noPreviewContent")})})]})},`preview-${oe}`),t.jsx("div",{ref:n,className:"unsafe-code-target",style:{position:"absolute",top:"-9999px",left:"-9999px",width:"1px",height:"1px",visibility:"hidden",pointerEvents:"none",zIndex:"-1"},suppressHydrationWarning:!0}),g&&t.jsx("div",{className:"folded-content-preview p-4 cursor-pointer w-full box-border border border-t-0 border-border rounded-b-lg bg-muted/10 hover:bg-muted/20 transition-colors",onClick:se,children:t.jsx("pre",{className:"whitespace-pre-wrap break-words text-muted-foreground font-mono text-sm",children:_e})})]})},ft=s.memo(nt);export{ft as JsRunnableBlockRenderer};
