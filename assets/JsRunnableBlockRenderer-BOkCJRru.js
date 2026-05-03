const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-CYm8zA_f.js","assets/vendor-mermaid-DwXa6Eyb.js","assets/vendor-charts-CArcARi2.js","assets/vendor-react-Djp8M_-6.js","assets/vendor-data-lquZhjzc.js","assets/vendor-flow-_1wjQnr3.js","assets/vendor-flow-n9x2b4FL.css"])))=>i.map(i=>d[i]);
import{p as Ie,_ as Fe}from"./vendor-mermaid-DwXa6Eyb.js";import{r as s,j as t,R as Je}from"./vendor-react-Djp8M_-6.js";import{P as He}from"./vendor-editor-nq9poU1u.js";import{u as $e,f as we,p as Qe,B as qe}from"./index-DhKSEdSg.js";import{u as D,w as Ae,x as De,y as ze,z as We,B as ye,A as _}from"./LLMChefApp-BEwf1jZy.js";import{t as w,n as Ge,e as be,M as xe,j as ve,o as Ke,l as Ve,E as Ye,p as Xe,D as Ze,q as et}from"./vendor-ui-DMIFaxEv.js";import{I as tt}from"./LLMChefControlModules-NzbEZ9X5.js";import{C as rt}from"./code-security.service-CE25wxTN.js";import"./vendor-charts-CArcARi2.js";import"./vendor-data-lquZhjzc.js";import"./vendor-flow-_1wjQnr3.js";import"./vendor-ai-j9wUExha.js";import"./pwa.service-DG3nu8bN.js";let P=null;const ot=()=>window.llmChefQuickJS?.isReady&&window.llmChefQuickJS.QuickJS&&window.llmChefQuickJS.context?Promise.resolve({QuickJS:window.llmChefQuickJS.QuickJS,vm:window.llmChefQuickJS.context}):P||(window.llmChefQuickJS={isLoading:!0,isReady:!1,loadPromise:void 0,QuickJS:void 0,context:void 0},P=Fe(()=>import("./index-CYm8zA_f.js"),__vite__mapDeps([0,1,2,3,4,5,6])).then(async({getQuickJS:l})=>{const M=await l(),N=M.newContext();return window.llmChefQuickJS={isLoading:!1,isReady:!0,loadPromise:void 0,QuickJS:M,context:N},window.dispatchEvent(new CustomEvent("quickjs-ready",{detail:{QuickJS:M,vm:N}})),{QuickJS:M,vm:N}}).catch(l=>{throw window.llmChefQuickJS={isLoading:!1,isReady:!1,loadPromise:void 0,QuickJS:void 0,context:void 0},P=null,window.dispatchEvent(new CustomEvent("quickjs-error",{detail:l})),l}),window.llmChefQuickJS.loadPromise=P.then(()=>{}),P),nt=({code:l,isStreaming:M=!1,interactionId:N,blockId:F})=>{const{t:a}=$e("renderers"),{foldStreamingCodeBlocks:ke}=we(D(r=>({foldStreamingCodeBlocks:r.foldStreamingCodeBlocks}))),Q=we(D(r=>r.runnableBlocksEnabled)),[f,Ce]=s.useState(M?ke:!1),[u,z]=s.useState(!1),[m,W]=s.useState(l),[q,J]=s.useState(!1),[G,K]=s.useState([]),[T,R]=s.useState(!1),[b,E]=s.useState(!1),[V,Y]=s.useState(!1),[d,X]=s.useState(null),[Z,ee]=s.useState(!1),[O,B]=s.useState(0),[te,re]=s.useState(0),[x,Se]=s.useState("safe"),oe=s.useMemo(()=>F||`js-block-${Math.random().toString(36).substr(2,9)}`,[F]),[L,U]=s.useState(()=>typeof window<"u"&&window.llmChefQuickJS?window.llmChefQuickJS.isReady?"ready":window.llmChefQuickJS.isLoading?"loading":"idle":"idle"),j=s.useRef(null),n=s.useRef(null),I=s.useRef(null),ne=Qe(D(r=>Object.values(r.canvasControls)));s.useEffect(()=>{function r(){window.llmChefQuickJS?.isReady?U("ready"):window.llmChefQuickJS?.isLoading?U("loading"):U("idle")}function o(){U("ready")}function e(){U("error")}return window.addEventListener("quickjs-ready",o),window.addEventListener("quickjs-error",e),r(),()=>{window.removeEventListener("quickjs-ready",o),window.removeEventListener("quickjs-error",e)}},[]),s.useEffect(()=>{u||W(l)},[l,u]),s.useEffect(()=>{n.current&&I.current&&(!f&&b?(n.current.parentNode!==I.current&&I.current.appendChild(n.current),n.current.style.position="relative",n.current.style.top="0",n.current.style.left="0",n.current.style.width="100%",n.current.style.height="100%",n.current.style.visibility="visible",n.current.style.pointerEvents="auto",n.current.style.zIndex="1"):(n.current.parentNode===I.current&&document.body.appendChild(n.current),n.current.style.position="absolute",n.current.style.top="-9999px",n.current.style.left="-9999px",n.current.style.width="1px",n.current.style.height="1px",n.current.style.visibility="hidden",n.current.style.pointerEvents="none",n.current.style.zIndex="-1"))},[b,f]),s.useEffect(()=>{X(null),B(0),re(0)},[m]);const je=s.useCallback((r,o,e,i,g,h)=>ne.filter(v=>v.type==="codeblock"&&v.targetSlot===r&&v.renderer).map(v=>{if(v.renderer){const k={codeBlockContent:o,codeBlockEditedContent:m,codeBlockLang:"javascript",codeBlockFilepath:void 0,isFolded:g,toggleFold:h,canvasContextType:"codeblock",interactionId:N,blockId:F,onEditModeChange:z};return t.jsx(Je.Fragment,{children:v.renderer(k)},v.id)}return null}).filter(Boolean),[ne,m,N,F,z]),A=s.useCallback(()=>{if(j.current&&(u?m:l))try{j.current.style.whiteSpace!=="pre-wrap"&&(j.current.style.whiteSpace="pre-wrap"),j.current.textContent=u?m:l,He.highlightElement(j.current)}catch(r){console.error("Prism highlight error:",r),j.current.textContent=u?m:l}else j.current&&(j.current.textContent="")},[l,m,u]);s.useEffect(()=>{!f&&!T&&!b&&A()},[l,m,u,f,T,b,A]),s.useEffect(()=>{const r=n.current;return()=>{if(r)try{r.querySelectorAll("iframe").forEach(e=>{const i=e.__llmchefMessageHandler;i&&(window.removeEventListener("message",i),delete e.__llmchefMessageHandler)}),r.innerHTML=""}catch{}}},[]);const se=()=>{const r=f;Ce(o=>!o),r&&setTimeout(A,0)},Re=s.useCallback(async()=>{ee(!0);try{const r=u?m:l,o=await rt.validateCodeSecurity(r,"javascript");X(o),o.score>90?w.error(`High-risk code detected (Score: ${o.score}/100). Please review carefully before running.`):o.score>60?w.warning(`Potentially risky code detected (Score: ${o.score}/100). Use caution when running.`):o.score>30?w.info(`Moderate-risk code detected (Score: ${o.score}/100). Review before running.`):w.success(`Code security check passed (Score: ${o.score}/100).`)}catch(r){console.error("Security check failed:",r),w.error(a("jsRunnableBlock.securityCheckFailed"))}finally{ee(!1)}},[l,m,u,a]),ie=s.useCallback(async(r,o)=>{const e=window.llmChefQuickJS.context;try{const i=e.newObject(),g=e.newObject(),h=e.newFunction("log",(...c)=>{const y=c.map(p=>e.dump(p));return o.push(y.join(" ")),e.undefined});e.setProp(g,"log",h),e.setProp(i,"utils",g);const v=e.newFunction("toast",c=>{const y=e.dump(c);return w(y),e.undefined});e.setProp(i,"toast",v);const k=new Map;let C=1;const de=()=>`qjsnode_${C++}`,ue=e.newFunction("__getRootId",()=>{let c=n.current.__qjs_id;return c||(c=de(),n.current.__qjs_id=c,k.set(c,n.current)),e.newString(c)});e.setProp(e.global,"__getRootId",ue);const me=e.newFunction("__createElement",c=>{const y=e.dump(c),p=document.createElement(y),S=de();return p.__qjs_id=S,k.set(S,p),e.newString(S)});e.setProp(e.global,"__createElement",me);const pe=e.newFunction("__appendChild",(c,y)=>{const p=k.get(e.dump(c)),S=k.get(e.dump(y));return p&&S&&p.appendChild(S),e.undefined});e.setProp(e.global,"__appendChild",pe);const fe=e.newFunction("__setTextContent",(c,y)=>{const p=k.get(e.dump(c));return p&&(p.textContent=e.dump(y)),e.undefined});e.setProp(e.global,"__setTextContent",fe);const ge=e.newFunction("__setInnerHTML",(c,y)=>{const p=k.get(e.dump(c));return p&&p instanceof Element&&(p.innerHTML=Ie.sanitize(e.dump(y),{USE_PROFILES:{html:!0}})),e.undefined});e.setProp(e.global,"__setInnerHTML",ge);const he=e.newFunction("__setStyle",(c,y,p)=>{const S=k.get(e.dump(c));return S&&S instanceof HTMLElement&&(S.style[e.dump(y)]=e.dump(p)),e.undefined});e.setProp(e.global,"__setStyle",he),e.setProp(e.global,"llmchef",i);const H=e.evalCode(`
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
      `);H.error?(console.error("API setup error:",e.dump(H.error)),H.error.dispose()):H.value.dispose();const $=e.evalCode(r);if($.error){const c=e.dump($.error);o.push(`QuickJS Error: ${c}`),$.error.dispose()}else $.value.dispose(),o.length===0&&o.push("Code executed successfully in safe mode");[h,v,ue,me,pe,fe,ge,he].forEach(c=>c.dispose()),[i,g].forEach(c=>c.dispose())}catch(i){o.push(`Safe execution error: ${i instanceof Error?i.message:String(i)}`)}},[]),ae=s.useCallback(async(r,o)=>{let e=null;try{n.current&&(n.current.innerHTML="");const i=document.createElement("iframe");i.style.width="100%",i.style.height=`${Math.floor(window.innerHeight*.67)}px`,i.style.border="none",i.style.borderRadius="8px",i.sandbox.add("allow-scripts");const g=window.crypto?.randomUUID?.()??Math.random().toString(36).slice(2),h=window.location.origin,v=JSON.stringify(r).replace(/</g,"\\u003c"),k=`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' ${h}; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; worker-src 'none'; child-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
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
        const parentOrigin = ${JSON.stringify(h)};
        const messageToken = ${JSON.stringify(g)};
        const userCode = ${v};
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
</html>`;e=C=>{if(C.source===i.contentWindow&&C.origin==="null"&&C.data?.token===g)switch(C.data.type){case"llmchef-log":o.push(C.data.message);break;case"llmchef-error":o.push(`Iframe Error: ${C.data.error}`);break;case"llmchef-resize":i.style.height=`${C.data.height}px`;break;case"llmchef-event":break}},window.addEventListener("message",e),i.srcdoc=k,n.current?.appendChild(i),i.__llmchefMessageHandler=e,await new Promise(C=>setTimeout(C,1e3)),o.length===0&&o.push("Code executed successfully in iframe mode")}catch(i){o.push(`Iframe execution error: ${i instanceof Error?i.message:String(i)}`)}},[]),ce=s.useCallback(async()=>{if(x==="safe"&&(!window.llmChefQuickJS?.isReady||!window.llmChefQuickJS.context)){w.error("Safe execution environment not ready. Please try again."),J(!1);return}const r=[];if(n.current)try{n.current.innerHTML=""}catch(e){console.warn("Preview cleanup failed:",e)}const o=u?m:l;try{x==="safe"?await ie(o,r):await ae(o,r)}catch(e){r.push(`Execution Error: ${e instanceof Error?e.message:String(e)}`)}finally{if(K(r),Y(!0),J(!1),x==="iframe"?(E(!0),R(!1),setTimeout(()=>{!(n.current&&(n.current.children.length>0||n.current.innerHTML.trim().length>0))&&r.length>0&&(R(!0),E(!1))},1500)):n.current&&(n.current.children.length>0||n.current.innerHTML.trim().length>0)?(E(!0),R(!1)):(R(!0),E(!1)),r.some(e=>e.includes("Error:")))w.error(a("jsRunnableBlock.executionFailed"));else{const e=a(x==="safe"?"jsRunnableBlock.safeMode":"jsRunnableBlock.iframeMode");w.success(a("jsRunnableBlock.executionSuccess",{mode:e}))}}},[l,m,u,x,ie,ae,a]),Ee=s.useCallback(async()=>{if(!Q){w.error("Runnable blocks are disabled in settings.");return}if(d){const r=Date.now();r-te>3e3&&B(0),re(r);const e=O+1;if(B(e),e<d.clicksRequired){const i=d.clicksRequired-e;w.info(`Click ${i} more time${i>1?"s":""} to confirm execution (Risk: ${d.riskLevel})`);return}if(d.score>90&&!window.confirm(`This code has a very high security risk score (${d.score}/100). Are you absolutely sure you want to run it?`)){B(0);return}B(0)}if(J(!0),x==="safe"&&(!window.llmChefQuickJS?.isReady||!window.llmChefQuickJS.context))try{await ot()}catch{J(!1);return}ce()},[Q,x,ce,d,O,te]),Le=()=>{R(!0),E(!1)},Me=()=>{E(!0),R(!1)},Ne=()=>{R(!1),E(!1)},_e=s.useMemo(()=>l?l.split(`
`).slice(0,3).join(`
`):"",[l]),Pe=je("codeblock-header-actions",u?m:l,"javascript",void 0,f,se),Te=()=>q?a("jsRunnableBlock.running"):L==="loading"?a("jsRunnableBlock.loading"):x==="safe"&&L!=="ready"?a("jsRunnableBlock.run"):d&&O>0&&O<d.clicksRequired?a("jsRunnableBlock.clickMore",{count:d.clicksRequired-O}):a("jsRunnableBlock.run"),Oe=s.useCallback(()=>{n.current&&(n.current.querySelectorAll("iframe").forEach(o=>{const e=o.__llmchefMessageHandler;e&&(window.removeEventListener("message",e),delete o.__llmchefMessageHandler)}),n.current.innerHTML=""),K([]),Y(!1),R(!1),E(!1);try{document.querySelectorAll('script[data-llmchef-runnable-script="true"]').forEach(o=>{o.parentNode&&o.parentNode.removeChild(o)}),["THREE","OrbitControls","D3","moment","lodash"].forEach(o=>{window[o]&&delete window[o]})}catch(r){console.warn("Error during cleanup:",r)}w.success(a("jsRunnableBlock.previewCleared"))},[a]),Be=s.useCallback(()=>{const r=u?m:l;if(!r.trim()){w.error(a("jsRunnableBlock.noCodeToDownload"));return}const e=`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; worker-src 'none'; child-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; media-src 'none'; font-src 'none'; manifest-src 'none'">
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
            Generated by <strong>LLMChef</strong> • Visit <a href="https://wan0.net/llmchef" class="text-blue-600 hover:underline">wan0.net/llmchef</a>
        </div>
    </div>

    <script type="module">
        // LLMChef API Implementation
        const llmchefTarget = document.getElementById('llmchef-target');
        const capturedLogs = [];
        const userCode = ${JSON.stringify(r).replace(/</g,"\\u003c")};
        const deny = (name) => () => { throw new Error(name + ' is disabled in this local LLMChef executable.'); };
        const disableGlobal = (name, value) => {
            try {
                Object.defineProperty(window, name, { value, configurable: true, writable: true });
            } catch {
                try { window[name] = value; } catch {}
            }
        };
        disableGlobal('fetch', deny('Network access'));
        disableGlobal('XMLHttpRequest', undefined);
        disableGlobal('WebSocket', undefined);
        disableGlobal('EventSource', undefined);
        disableGlobal('Worker', undefined);
        disableGlobal('SharedWorker', undefined);
        disableGlobal('localStorage', undefined);
        disableGlobal('sessionStorage', undefined);
        disableGlobal('indexedDB', undefined);
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
                const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
                await new AsyncFunction(userCode)();
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
</html>`,i=new Blob([e],{type:"text/html"}),g=URL.createObjectURL(i),h=document.createElement("a");h.href=g,h.download="llmchef-executable.html",document.body.appendChild(h),h.click(),document.body.removeChild(h),URL.revokeObjectURL(g),w.success("Executable HTML file downloaded successfully!")},[l,m,u,a]),[Ue,le]=s.useState(!1);return s.useEffect(()=>{if(b&&n.current){const r=()=>{const e=n.current?n.current.children.length>0||n.current.innerHTML.trim().length>0:!1;le(e)};r();const o=new MutationObserver(r);return o.observe(n.current,{childList:!0,subtree:!0,attributes:!1,characterData:!0}),()=>o.disconnect()}else le(!1)},[b,V]),s.useEffect(()=>{const r=n.current;if(!r)return;r.tabIndex=0;const o=g=>{if(document.activeElement!==r)return;["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","Tab","PageUp","PageDown","Home","End"].includes(g.key)&&g.preventDefault()},e=()=>window.addEventListener("keydown",o,{capture:!0}),i=()=>window.removeEventListener("keydown",o,{capture:!0});return r.addEventListener("focus",e),r.addEventListener("blur",i),()=>{r.removeEventListener("focus",e),r.removeEventListener("blur",i),window.removeEventListener("keydown",o,{capture:!0})}},[n]),t.jsxs("div",{className:"code-block-container group/codeblock my-4 max-w-full",children:[t.jsxs("div",{className:"code-block-header sticky top-0 z-[var(--z-sticky)] flex items-center justify-between px-3 py-2 border border-b-0 border-border bg-muted/50 rounded-t-lg",children:[t.jsxs("div",{className:"flex items-center gap-1",children:[t.jsx("div",{className:"text-sm font-medium",children:a("jsRunnableBlock.header")}),L==="ready"&&t.jsx("div",{className:"text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded",children:a("jsRunnableBlock.quickjsReady")}),L==="loading"&&t.jsx("div",{className:"text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded",children:a("jsRunnableBlock.quickjsLoading")}),L==="error"&&t.jsx("div",{className:"text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded",children:a("jsRunnableBlock.quickjsError")}),t.jsx("span",{className:`text-xs px-1.5 py-0.5 rounded ${x==="safe"?"bg-green-100 text-green-700":"bg-blue-100 text-blue-700"}`,children:a(x==="safe"?"jsRunnableBlock.safe":"jsRunnableBlock.iframe")}),d&&t.jsxs("div",{className:"flex items-center gap-1 text-xs",style:{color:d.color},children:[t.jsx(Ge,{className:"h-3 w-3"}),t.jsxs("span",{children:[d.score,"/100 (",d.riskLevel,")"]})]}),t.jsx("div",{className:"flex items-center gap-0.5 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity",children:Pe})]}),t.jsxs("div",{className:"flex items-center gap-1",children:[t.jsxs(Ae,{value:x,onValueChange:r=>Se(r),children:[t.jsx(De,{className:"w-24 h-7 text-xs",children:t.jsx(ze,{})}),t.jsxs(We,{children:[t.jsx(ye,{value:"safe",className:"text-xs",children:t.jsxs("div",{className:"flex items-center gap-1",children:[t.jsx(be,{className:"h-3 w-3 text-green-600"}),"Safe"]})}),t.jsx(ye,{value:"iframe",className:"text-xs",children:t.jsxs("div",{className:"flex items-center gap-1",children:[t.jsx(xe,{className:"h-3 w-3 text-blue-600"}),"Iframe"]})})]})]}),t.jsx(_,{tooltipText:a(d?"jsRunnableBlock.recheckSecurity":"jsRunnableBlock.checkSecurity"),onClick:Re,disabled:Z,className:"text-xs h-7",icon:Z?t.jsx(ve,{className:"h-3 w-3 mr-1 animate-spin"}):t.jsx(be,{className:"h-3 w-3 mr-1"})}),t.jsx(_,{tooltipText:a("jsRunnableBlock.downloadExecutable"),onClick:Be,className:"text-xs h-7",icon:t.jsx(Ke,{className:"h-3 w-3 mr-1"})}),V&&t.jsxs(t.Fragment,{children:[t.jsx(_,{tooltipText:a("jsRunnableBlock.showCode"),onClick:Ne,className:"text-xs h-7",icon:t.jsx(Ve,{className:"h-3 w-3 mr-1"})}),t.jsx(_,{tooltipText:a("jsRunnableBlock.showConsole"),onClick:Le,className:"text-xs h-7",icon:t.jsx(xe,{className:"h-3 w-3 mr-1"})}),t.jsx(_,{tooltipText:a("jsRunnableBlock.showPreview"),onClick:Me,className:"text-xs h-7",icon:t.jsx(Ye,{className:"h-3 w-3 mr-1"})}),t.jsx(_,{tooltipText:a("jsRunnableBlock.stopAndClear"),onClick:Oe,className:"text-xs h-7",icon:t.jsx(Xe,{className:"h-3 w-3 mr-1"})})]}),t.jsxs(qe,{size:"sm",onClick:Ee,disabled:q||L==="loading"||!Q,className:"text-xs h-7 "+(d?d.score>90?"bg-[var(--destructive)] border-[var(--destructive)] text-[var(--destructive-foreground)]":d.score>60?"bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-foreground)]":d.score>30?"bg-[var(--warning,var(--primary))] border-[var(--warning,var(--primary))] text-[var(--foreground)]":"bg-[var(--primary)] border-[var(--primary)] text-[var(--primary-foreground)]":""),children:[q||L==="loading"?t.jsx(ve,{className:"h-3 w-3 mr-1 animate-spin"}):L!=="ready"&&x==="safe"?t.jsx(Ze,{className:"h-3 w-3 mr-1"}):t.jsx(et,{className:"h-3 w-3 mr-1"}),Te()]})]})]}),!f&&!T&&!b&&!u&&t.jsx("div",{className:"overflow-hidden w-full",children:t.jsx("pre",{className:"overflow-x-auto w-full relative overflow-wrap-anywhere border border-border rounded-b-lg bg-muted/20",children:t.jsx("code",{ref:j,className:"language-javascript block p-4 font-mono text-sm leading-relaxed"})})}),!f&&!T&&!b&&u&&t.jsx("div",{className:"overflow-hidden w-full border border-border rounded-b-lg bg-muted/20",children:t.jsx(tt,{code:m,language:"javascript",onChange:W})}),!f&&T&&t.jsxs("div",{className:"output-container border border-border rounded-b-lg bg-black/90 text-green-400 p-4 font-mono text-sm",children:[t.jsx("div",{className:"output-header text-green-300 mb-2 text-xs font-semibold",children:a("jsRunnableBlock.consoleOutput")}),G.length>0?G.map((r,o)=>t.jsx("div",{className:r.startsWith("Execution Error:")||r.startsWith("Error:")?"text-red-400":r.startsWith("Warning:")?"text-yellow-400":"text-green-400",children:r},o)):t.jsx("div",{className:"text-muted-foreground",children:a("jsRunnableBlock.noOutput")})]}),t.jsx("div",{className:!f&&b?"preview-container border border-border rounded-b-lg bg-background p-4":"preview-container-hidden",style:{display:!f&&b?"block":"none",minHeight:!f&&b?"100px":"0"},suppressHydrationWarning:!0,children:!f&&b&&t.jsxs(t.Fragment,{children:[t.jsx("div",{className:"preview-header text-muted-foreground mb-2 text-xs font-semibold",children:a("jsRunnableBlock.preview")}),t.jsx("div",{ref:I,className:"preview-content min-h-[100px] border border-dashed border-muted-foreground/20 rounded p-2 relative",id:`preview-content-${oe}`,children:!Ue&&t.jsx("div",{className:"text-muted-foreground text-sm italic absolute inset-0 flex items-center justify-center pointer-events-none z-10",children:a("jsRunnableBlock.noPreviewContent")})})]})},`preview-${oe}`),t.jsx("div",{ref:n,className:"unsafe-code-target",style:{position:"absolute",top:"-9999px",left:"-9999px",width:"1px",height:"1px",visibility:"hidden",pointerEvents:"none",zIndex:"-1"},suppressHydrationWarning:!0}),f&&t.jsx("div",{className:"folded-content-preview p-4 cursor-pointer w-full box-border border border-t-0 border-border rounded-b-lg bg-muted/10 hover:bg-muted/20 transition-colors",onClick:se,children:t.jsx("pre",{className:"whitespace-pre-wrap break-words text-muted-foreground font-mono text-sm",children:_e})})]})},bt=s.memo(nt);export{bt as JsRunnableBlockRenderer};
