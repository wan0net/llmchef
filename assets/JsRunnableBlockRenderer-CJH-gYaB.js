const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-BZQwoAcW.js","assets/vendor-diagrams-CI-VGAdS.js","assets/vendor-react-Du8Qqd40.js"])))=>i.map(i=>d[i]);
import{p as purify,_ as __vitePreload}from"./vendor-diagrams-CI-VGAdS.js";import{r as reactExports,j as jsxRuntimeExports,R as React}from"./vendor-react-Du8Qqd40.js";import{P as Prism}from"./vendor-editor-BMKARdr8.js";import{u as useTranslation,Q as useSettingsStore,b as useShallow,ad as useControlRegistryStore,a2 as Select,a3 as SelectTrigger,a4 as SelectValue,a5 as SelectContent,a6 as SelectItem,A as ActionTooltipButton,B as Button,af as InlineCodeEditor}from"./index-BbLUXGN7.js";import{t as toast,l as Shield,m as ShieldCheck,M as MonitorSpeaker,i as LoaderCircle,n as Rocket,C as Code,E as Eye,o as Square,D as Download,p as Play}from"./vendor-ui-CI3N22a5.js";import{C as CodeSecurityService}from"./code-security.service-Cuu4hko5.js";import"./vendor-data-Cg1t-RTV.js";import"./vendor-ai-Cpm0OBFa.js";let quickJSLoadPromise=null;const waitForQuickJS=()=>window.llmChefQuickJS?.isReady&&window.llmChefQuickJS.QuickJS&&window.llmChefQuickJS.context?Promise.resolve({QuickJS:window.llmChefQuickJS.QuickJS,vm:window.llmChefQuickJS.context}):quickJSLoadPromise||(window.llmChefQuickJS={isLoading:!0,isReady:!1,loadPromise:void 0,QuickJS:void 0,context:void 0},quickJSLoadPromise=__vitePreload(()=>import("./index-BZQwoAcW.js"),__vite__mapDeps([0,1,2])).then(async({getQuickJS:o})=>{const r=await o(),e=r.newContext();return window.llmChefQuickJS={isLoading:!1,isReady:!0,loadPromise:void 0,QuickJS:r,context:e},window.dispatchEvent(new CustomEvent("quickjs-ready",{detail:{QuickJS:r,vm:e}})),{QuickJS:r,vm:e}}).catch(o=>{throw window.llmChefQuickJS={isLoading:!1,isReady:!1,loadPromise:void 0,QuickJS:void 0,context:void 0},quickJSLoadPromise=null,window.dispatchEvent(new CustomEvent("quickjs-error",{detail:o})),o}),window.llmChefQuickJS.loadPromise=quickJSLoadPromise.then(()=>{}),quickJSLoadPromise),JsRunnableBlockRendererComponent=({code,isStreaming=!1,interactionId,blockId,module})=>{const{t}=useTranslation("renderers"),{foldStreamingCodeBlocks}=useSettingsStore(useShallow(o=>({foldStreamingCodeBlocks:o.foldStreamingCodeBlocks}))),runnableBlocksEnabled=useSettingsStore(useShallow(o=>o.runnableBlocksEnabled)),[isFolded,setIsFolded]=reactExports.useState(isStreaming?foldStreamingCodeBlocks:!1),[isEditing,setIsEditing]=reactExports.useState(!1),[editedCode,setEditedCode]=reactExports.useState(code),[isRunning,setIsRunning]=reactExports.useState(!1),[output,setOutput]=reactExports.useState([]),[showOutput,setShowOutput]=reactExports.useState(!1),[showPreview,setShowPreview]=reactExports.useState(!1),[hasRun,setHasRun]=reactExports.useState(!1),[securityResult,setSecurityResult]=reactExports.useState(null),[isCheckingSecurity,setIsCheckingSecurity]=reactExports.useState(!1),[clickCount,setClickCount]=reactExports.useState(0),[lastClickTime,setLastClickTime]=reactExports.useState(0),[executionMode,setExecutionMode]=reactExports.useState("safe"),blockUniqueId=reactExports.useMemo(()=>blockId||`js-block-${Math.random().toString(36).substr(2,9)}`,[blockId]),[quickjsStatus,setQuickjsStatus]=reactExports.useState(()=>typeof window<"u"&&window.llmChefQuickJS?window.llmChefQuickJS.isReady?"ready":window.llmChefQuickJS.isLoading?"loading":"idle":"idle"),codeRef=reactExports.useRef(null),previewRef=reactExports.useRef(null),previewContentRef=reactExports.useRef(null),canvasControls=useControlRegistryStore(useShallow(o=>Object.values(o.canvasControls)));reactExports.useEffect(()=>{function o(){window.llmChefQuickJS?.isReady?setQuickjsStatus("ready"):window.llmChefQuickJS?.isLoading?setQuickjsStatus("loading"):setQuickjsStatus("idle")}function r(){setQuickjsStatus("ready")}function e(){setQuickjsStatus("error")}return window.addEventListener("quickjs-ready",r),window.addEventListener("quickjs-error",e),o(),()=>{window.removeEventListener("quickjs-ready",r),window.removeEventListener("quickjs-error",e)}},[]),reactExports.useEffect(()=>{isEditing||setEditedCode(code)},[code,isEditing]),reactExports.useEffect(()=>{previewRef.current&&previewContentRef.current&&(!isFolded&&showPreview?(previewRef.current.parentNode!==previewContentRef.current&&previewContentRef.current.appendChild(previewRef.current),previewRef.current.style.position="relative",previewRef.current.style.top="0",previewRef.current.style.left="0",previewRef.current.style.width="100%",previewRef.current.style.height="100%",previewRef.current.style.visibility="visible",previewRef.current.style.pointerEvents="auto",previewRef.current.style.zIndex="1"):(previewRef.current.parentNode===previewContentRef.current&&document.body.appendChild(previewRef.current),previewRef.current.style.position="absolute",previewRef.current.style.top="-9999px",previewRef.current.style.left="-9999px",previewRef.current.style.width="1px",previewRef.current.style.height="1px",previewRef.current.style.visibility="hidden",previewRef.current.style.pointerEvents="none",previewRef.current.style.zIndex="-1"))},[showPreview,isFolded]),reactExports.useEffect(()=>{setSecurityResult(null),setClickCount(0),setLastClickTime(0)},[editedCode]);const renderSlotForCodeBlock=reactExports.useCallback((o,r,e,s,i,c)=>canvasControls.filter(d=>d.type==="codeblock"&&d.targetSlot===o&&d.renderer).map(d=>{if(d.renderer){const m={codeBlockContent:r,codeBlockEditedContent:editedCode,codeBlockLang:"javascript",codeBlockFilepath:void 0,isFolded:i,toggleFold:c,canvasContextType:"codeblock",interactionId,blockId,onEditModeChange:setIsEditing};return jsxRuntimeExports.jsx(React.Fragment,{children:d.renderer(m)},d.id)}return null}).filter(Boolean),[canvasControls,editedCode,interactionId,blockId,setIsEditing]),highlightCode=reactExports.useCallback(()=>{if(codeRef.current&&(isEditing?editedCode:code))try{codeRef.current.style.whiteSpace!=="pre-wrap"&&(codeRef.current.style.whiteSpace="pre-wrap"),codeRef.current.textContent=isEditing?editedCode:code,Prism.highlightElement(codeRef.current)}catch(o){console.error("Prism highlight error:",o),codeRef.current.textContent=isEditing?editedCode:code}else codeRef.current&&(codeRef.current.textContent="")},[code,editedCode,isEditing]);reactExports.useEffect(()=>{!isFolded&&!showOutput&&!showPreview&&highlightCode()},[code,editedCode,isEditing,isFolded,showOutput,showPreview,highlightCode]),reactExports.useEffect(()=>()=>{if(previewRef.current)try{previewRef.current.querySelectorAll("iframe").forEach(r=>{const e=r.__llmchefMessageHandler;e&&(window.removeEventListener("message",e),delete r.__llmchefMessageHandler)}),previewRef.current.innerHTML=""}catch{}},[]);const toggleFold=()=>{const o=isFolded;setIsFolded(r=>!r),o&&setTimeout(highlightCode,0)},checkSecurity=reactExports.useCallback(async()=>{setIsCheckingSecurity(!0);try{const o=isEditing?editedCode:code,r=await CodeSecurityService.validateCodeSecurity(o,"javascript");setSecurityResult(r),r.score>90?toast.error(`High-risk code detected (Score: ${r.score}/100). Please review carefully before running.`):r.score>60?toast.warning(`Potentially risky code detected (Score: ${r.score}/100). Use caution when running.`):r.score>30?toast.info(`Moderate-risk code detected (Score: ${r.score}/100). Review before running.`):toast.success(`Code security check passed (Score: ${r.score}/100).`)}catch(o){console.error("Security check failed:",o),toast.error(t("jsRunnableBlock.securityCheckFailed"))}finally{setIsCheckingSecurity(!1)}},[code,editedCode,isEditing]),executeSafeMode=reactExports.useCallback(async(o,r)=>{const e=window.llmChefQuickJS.context;try{const s=e.newObject(),i=e.newObject(),c=e.newFunction("log",(...n)=>{const l=n.map(a=>e.dump(a));return r.push(l.join(" ")),e.undefined});e.setProp(i,"log",c),e.setProp(s,"utils",i);const d=e.newFunction("toast",n=>{const l=e.dump(n);return toast(l),e.undefined});e.setProp(s,"toast",d);const m=new Map;let R=1;const h=()=>`qjsnode_${R++}`,x=e.newFunction("__getRootId",()=>{let n=previewRef.current.__qjs_id;return n||(n=h(),previewRef.current.__qjs_id=n,m.set(n,previewRef.current)),e.newString(n)});e.setProp(e.global,"__getRootId",x);const g=e.newFunction("__createElement",n=>{const l=e.dump(n),a=document.createElement(l),u=h();return a.__qjs_id=u,m.set(u,a),e.newString(u)});e.setProp(e.global,"__createElement",g);const w=e.newFunction("__appendChild",(n,l)=>{const a=m.get(e.dump(n)),u=m.get(e.dump(l));return a&&u&&a.appendChild(u),e.undefined});e.setProp(e.global,"__appendChild",w);const v=e.newFunction("__setTextContent",(n,l)=>{const a=m.get(e.dump(n));return a&&(a.textContent=e.dump(l)),e.undefined});e.setProp(e.global,"__setTextContent",v);const y=e.newFunction("__setInnerHTML",(n,l)=>{const a=m.get(e.dump(n));return a&&a instanceof Element&&(a.innerHTML=purify.sanitize(e.dump(l),{USE_PROFILES:{html:!0}})),e.undefined});e.setProp(e.global,"__setInnerHTML",y);const b=e.newFunction("__setStyle",(n,l,a)=>{const u=m.get(e.dump(n));return u&&u instanceof HTMLElement&&(u.style[e.dump(l)]=e.dump(a)),e.undefined});e.setProp(e.global,"__setStyle",b),e.setProp(e.global,"llmchef",s);const p=e.evalCode(`
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
      `);p.error?(console.error("API setup error:",e.dump(p.error)),p.error.dispose()):p.value.dispose();const f=e.evalCode(o);if(f.error){const n=e.dump(f.error);r.push(`QuickJS Error: ${n}`),f.error.dispose()}else f.value.dispose(),r.length===0&&r.push("Code executed successfully in safe mode");[c,d,x,g,w,v,y,b].forEach(n=>n.dispose()),[s,i].forEach(n=>n.dispose())}catch(s){r.push(`Safe execution error: ${s instanceof Error?s.message:String(s)}`)}},[]),executeUnsafeMode=reactExports.useCallback(async(codeToRun,capturedLogs)=>{try{let contextObj={};module&&module.getEnhancedContext?(contextObj=module.getEnhancedContext(capturedLogs,previewRef.current),contextObj.llmchef&&contextObj.llmchef.utils&&(contextObj.llmchef.utils.error=contextObj.llmchef.utils.error||console.error,contextObj.llmchef.utils.warn=contextObj.llmchef.utils.warn||console.warn,contextObj.llmchef.utils.log=contextObj.llmchef.utils.log||console.log,contextObj.llmchef.utils.toast=contextObj.llmchef.utils.toast||(o=>toast(o)))):contextObj={llmchef:{utils:{log:(...o)=>{const r=o.map(e=>typeof e=="object"?JSON.stringify(e):String(e)).join(" ");capturedLogs.push(r),console.log(...o)},toast:o=>toast(o),error:(...o)=>{const r=o.map(e=>typeof e=="object"?JSON.stringify(e):String(e)).join(" ");capturedLogs.push(`Error: ${r}`),console.error(...o)},warn:(...o)=>{const r=o.map(e=>typeof e=="object"?JSON.stringify(e):String(e)).join(" ");capturedLogs.push(`Warning: ${r}`),console.warn(...o)}},target:previewRef.current||document.createElement("div")}};const originalLLMChef=window.llmchef;window.llmchef=contextObj.llmchef;const wrappedCode=`
        (async () => { 
          const llmchef = window.llmchef;
          console.log('llmchef.target in execution context:', llmchef.target);
          ${codeToRun} 
        })()
      `,result=eval(wrappedCode);result&&typeof result.then=="function"&&await result,capturedLogs.length===0&&capturedLogs.push("Code executed successfully in unsafe mode - use llmchef.utils.log() for captured output"),originalLLMChef!==void 0?window.llmchef=originalLLMChef:delete window.llmchef}catch(o){capturedLogs.push(`Execution Error: ${o instanceof Error?o.message:String(o)}`)}},[module]),executeIframeMode=reactExports.useCallback(async(o,r)=>{let e=null;try{previewRef.current&&(previewRef.current.innerHTML="");const s=document.createElement("iframe");s.style.width="100%",s.style.height=`${Math.floor(window.innerHeight*.67)}px`,s.style.border="none",s.style.borderRadius="8px",s.sandbox.add("allow-scripts");const i=`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
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
        const target = document.getElementById('llmchef-target');
        const logs = [];

        const assertLocalResource = (url, label) => {
            const parsed = new URL(url, window.location.origin);
            if (parsed.origin !== window.location.origin) {
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
                    window.parent.postMessage({
                        type: 'llmchef-log',
                        message: formatted
                    }, '*');
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
                window.parent.postMessage({
                    type: 'llmchef-event',
                    eventName,
                    payload
                }, '*');
            }
        };
        
        // Auto-resize iframe to content
        function resizeIframe() {
            const minHeight = Math.floor(window.parent.innerHeight * 0.67);
            const height = Math.max(document.body.scrollHeight, minHeight);
            window.parent.postMessage({
                type: 'llmchef-resize',
                height: height
            }, '*');
        }
        
        // Execute user code
        try {
            ${o}
            // Resize after code execution
            setTimeout(resizeIframe, 100);
        } catch (error) {
            console.error('Iframe execution error:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'p-4 text-red-600 bg-red-100 border border-red-200 rounded-md';
            errorDiv.textContent = \`Error: \${error.message}\`;
            target.appendChild(errorDiv);
            
            window.parent.postMessage({
                type: 'llmchef-error',
                error: error.message
            }, '*');
            
            // Resize after error display
            setTimeout(resizeIframe, 100);
        }
    <\/script>
</body>
</html>`;e=c=>{if(c.source===s.contentWindow)switch(c.data.type){case"llmchef-log":r.push(c.data.message);break;case"llmchef-error":r.push(`Iframe Error: ${c.data.error}`);break;case"llmchef-resize":s.style.height=`${c.data.height}px`;break;case"llmchef-event":break}},window.addEventListener("message",e),s.srcdoc=i,previewRef.current?.appendChild(s),s.__llmchefMessageHandler=e,await new Promise(c=>setTimeout(c,1e3)),r.length===0&&r.push("Code executed successfully in iframe mode")}catch(s){r.push(`Iframe execution error: ${s instanceof Error?s.message:String(s)}`)}},[]),executeCode=reactExports.useCallback(async()=>{if(executionMode==="safe"&&(!window.llmChefQuickJS?.isReady||!window.llmChefQuickJS.context)){toast.error("Safe execution environment not ready. Please try again."),setIsRunning(!1);return}const o=[];if(previewRef.current)try{previewRef.current.innerHTML=""}catch(e){console.warn("Preview cleanup failed:",e)}const r=isEditing?editedCode:code;try{switch(executionMode){case"safe":await executeSafeMode(r,o);break;case"iframe":await executeIframeMode(r,o);break;case"unsafe":await executeUnsafeMode(r,o);break}}catch(e){o.push(`Execution Error: ${e instanceof Error?e.message:String(e)}`)}finally{if(setOutput(o),setHasRun(!0),setIsRunning(!1),executionMode==="unsafe"||executionMode==="iframe"?(setShowPreview(!0),setShowOutput(!1),setTimeout(()=>{!(previewRef.current&&(previewRef.current.children.length>0||previewRef.current.innerHTML.trim().length>0))&&o.length>0&&(setShowOutput(!0),setShowPreview(!1))},executionMode==="iframe"?1500:200)):previewRef.current&&(previewRef.current.children.length>0||previewRef.current.innerHTML.trim().length>0)?(setShowPreview(!0),setShowOutput(!1)):(setShowOutput(!0),setShowPreview(!1)),o.some(e=>e.includes("Error:")))toast.error(t("jsRunnableBlock.executionFailed"));else{const e=t(executionMode==="safe"?"jsRunnableBlock.safeMode":executionMode==="iframe"?"jsRunnableBlock.iframeMode":"jsRunnableBlock.unsafeMode");toast.success(t("jsRunnableBlock.executionSuccess",{mode:e}))}}},[code,editedCode,isEditing,executionMode,executeSafeMode,executeIframeMode,executeUnsafeMode]),handleRunClick=reactExports.useCallback(async()=>{if(!runnableBlocksEnabled){toast.error("Runnable blocks are disabled in settings.");return}if(securityResult){const o=Date.now();o-lastClickTime>3e3&&setClickCount(0),setLastClickTime(o);const e=clickCount+1;if(setClickCount(e),e<securityResult.clicksRequired){const s=securityResult.clicksRequired-e;toast.info(`Click ${s} more time${s>1?"s":""} to confirm execution (Risk: ${securityResult.riskLevel})`);return}if(securityResult.score>90&&!window.confirm(`This code has a very high security risk score (${securityResult.score}/100). Are you absolutely sure you want to run it?`)){setClickCount(0);return}setClickCount(0)}if(setIsRunning(!0),executionMode==="safe"&&(!window.llmChefQuickJS?.isReady||!window.llmChefQuickJS.context))try{await waitForQuickJS()}catch{setIsRunning(!1);return}executeCode()},[runnableBlocksEnabled,executionMode,executeCode,securityResult,clickCount,lastClickTime]),toggleConsole=()=>{setShowOutput(!0),setShowPreview(!1)},togglePreview=()=>{setShowPreview(!0),setShowOutput(!1)},toggleCode=()=>{setShowOutput(!1),setShowPreview(!1)},foldedPreviewText=reactExports.useMemo(()=>code?code.split(`
`).slice(0,3).join(`
`):"",[code]),codeBlockHeaderActions=renderSlotForCodeBlock("codeblock-header-actions",isEditing?editedCode:code,"javascript",void 0,isFolded,toggleFold),getRunButtonText=()=>isRunning?t("jsRunnableBlock.running"):quickjsStatus==="loading"?t("jsRunnableBlock.loading"):executionMode==="safe"&&quickjsStatus!=="ready"?t("jsRunnableBlock.run"):securityResult&&clickCount>0&&clickCount<securityResult.clicksRequired?t("jsRunnableBlock.clickMore",{count:securityResult.clicksRequired-clickCount}):t("jsRunnableBlock.run"),handleStop=reactExports.useCallback(()=>{previewRef.current&&(previewRef.current.querySelectorAll("iframe").forEach(r=>{const e=r.__llmchefMessageHandler;e&&(window.removeEventListener("message",e),delete r.__llmchefMessageHandler)}),previewRef.current.innerHTML=""),setOutput([]),setHasRun(!1),setShowOutput(!1),setShowPreview(!1);try{document.querySelectorAll('script[data-llmchef-runnable-script="true"]').forEach(r=>{r.parentNode&&r.parentNode.removeChild(r)}),["THREE","OrbitControls","D3","moment","lodash"].forEach(r=>{window[r]&&delete window[r]})}catch(o){console.warn("Error during cleanup:",o)}toast.success(t("jsRunnableBlock.previewCleared"))},[]),handleDownloadExecutable=reactExports.useCallback(()=>{const o=isEditing?editedCode:code;if(!o.trim()){toast.error(t("jsRunnableBlock.noCodeToDownload"));return}const r=`<!DOCTYPE html>
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
                ${o}
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
</html>`,e=new Blob([r],{type:"text/html"}),s=URL.createObjectURL(e),i=document.createElement("a");i.href=s,i.download="llmchef-executable.html",document.body.appendChild(i),i.click(),document.body.removeChild(i),URL.revokeObjectURL(s),toast.success("Executable HTML file downloaded successfully!")},[code,editedCode,isEditing]),[hasPreviewContent,setHasPreviewContent]=reactExports.useState(!1);return reactExports.useEffect(()=>{if(showPreview&&previewRef.current){const o=()=>{const e=previewRef.current?previewRef.current.children.length>0||previewRef.current.innerHTML.trim().length>0:!1;setHasPreviewContent(e)};o();const r=new MutationObserver(o);return r.observe(previewRef.current,{childList:!0,subtree:!0,attributes:!1,characterData:!0}),()=>r.disconnect()}else setHasPreviewContent(!1)},[showPreview,hasRun]),reactExports.useEffect(()=>{const o=previewRef.current;if(!o)return;o.tabIndex=0;const r=i=>{if(document.activeElement!==o)return;["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","Tab","PageUp","PageDown","Home","End"].includes(i.key)&&i.preventDefault()},e=()=>window.addEventListener("keydown",r,{capture:!0}),s=()=>window.removeEventListener("keydown",r,{capture:!0});return o.addEventListener("focus",e),o.addEventListener("blur",s),()=>{o.removeEventListener("focus",e),o.removeEventListener("blur",s),window.removeEventListener("keydown",r,{capture:!0})}},[previewRef]),jsxRuntimeExports.jsxs("div",{className:"code-block-container group/codeblock my-4 max-w-full",children:[jsxRuntimeExports.jsxs("div",{className:"code-block-header sticky top-0 z-[var(--z-sticky)] flex items-center justify-between px-3 py-2 border border-b-0 border-border bg-muted/50 rounded-t-lg",children:[jsxRuntimeExports.jsxs("div",{className:"flex items-center gap-1",children:[jsxRuntimeExports.jsx("div",{className:"text-sm font-medium",children:t("jsRunnableBlock.header")}),quickjsStatus==="ready"&&jsxRuntimeExports.jsx("div",{className:"text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded",children:t("jsRunnableBlock.quickjsReady")}),quickjsStatus==="loading"&&jsxRuntimeExports.jsx("div",{className:"text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded",children:t("jsRunnableBlock.quickjsLoading")}),quickjsStatus==="error"&&jsxRuntimeExports.jsx("div",{className:"text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded",children:t("jsRunnableBlock.quickjsError")}),jsxRuntimeExports.jsx("span",{className:`text-xs px-1.5 py-0.5 rounded ${executionMode==="safe"?"bg-green-100 text-green-700":executionMode==="iframe"?"bg-blue-100 text-blue-700":"bg-orange-100 text-orange-700"}`,children:t(executionMode==="safe"?"jsRunnableBlock.safe":executionMode==="iframe"?"jsRunnableBlock.iframe":"jsRunnableBlock.unsafe")}),securityResult&&jsxRuntimeExports.jsxs("div",{className:"flex items-center gap-1 text-xs",style:{color:securityResult.color},children:[jsxRuntimeExports.jsx(Shield,{className:"h-3 w-3"}),jsxRuntimeExports.jsxs("span",{children:[securityResult.score,"/100 (",securityResult.riskLevel,")"]})]}),jsxRuntimeExports.jsx("div",{className:"flex items-center gap-0.5 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity",children:codeBlockHeaderActions})]}),jsxRuntimeExports.jsxs("div",{className:"flex items-center gap-1",children:[jsxRuntimeExports.jsxs(Select,{value:executionMode,onValueChange:o=>setExecutionMode(o),children:[jsxRuntimeExports.jsx(SelectTrigger,{className:"w-24 h-7 text-xs",children:jsxRuntimeExports.jsx(SelectValue,{})}),jsxRuntimeExports.jsxs(SelectContent,{children:[jsxRuntimeExports.jsx(SelectItem,{value:"safe",className:"text-xs",children:jsxRuntimeExports.jsxs("div",{className:"flex items-center gap-1",children:[jsxRuntimeExports.jsx(ShieldCheck,{className:"h-3 w-3 text-green-600"}),"Safe"]})}),jsxRuntimeExports.jsx(SelectItem,{value:"iframe",className:"text-xs",children:jsxRuntimeExports.jsxs("div",{className:"flex items-center gap-1",children:[jsxRuntimeExports.jsx(MonitorSpeaker,{className:"h-3 w-3 text-blue-600"}),"Iframe"]})}),jsxRuntimeExports.jsx(SelectItem,{value:"unsafe",className:"text-xs",children:jsxRuntimeExports.jsxs("div",{className:"flex items-center gap-1",children:[jsxRuntimeExports.jsx(Shield,{className:"h-3 w-3 text-orange-600"}),"Unsafe"]})})]})]}),jsxRuntimeExports.jsx(ActionTooltipButton,{tooltipText:t(securityResult?"jsRunnableBlock.recheckSecurity":"jsRunnableBlock.checkSecurity"),onClick:checkSecurity,disabled:isCheckingSecurity,className:"text-xs h-7",icon:isCheckingSecurity?jsxRuntimeExports.jsx(LoaderCircle,{className:"h-3 w-3 mr-1 animate-spin"}):jsxRuntimeExports.jsx(ShieldCheck,{className:"h-3 w-3 mr-1"})}),jsxRuntimeExports.jsx(ActionTooltipButton,{tooltipText:t("jsRunnableBlock.downloadExecutable"),onClick:handleDownloadExecutable,className:"text-xs h-7",icon:jsxRuntimeExports.jsx(Rocket,{className:"h-3 w-3 mr-1"})}),hasRun&&jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment,{children:[jsxRuntimeExports.jsx(ActionTooltipButton,{tooltipText:t("jsRunnableBlock.showCode"),onClick:toggleCode,className:"text-xs h-7",icon:jsxRuntimeExports.jsx(Code,{className:"h-3 w-3 mr-1"})}),jsxRuntimeExports.jsx(ActionTooltipButton,{tooltipText:t("jsRunnableBlock.showConsole"),onClick:toggleConsole,className:"text-xs h-7",icon:jsxRuntimeExports.jsx(MonitorSpeaker,{className:"h-3 w-3 mr-1"})}),jsxRuntimeExports.jsx(ActionTooltipButton,{tooltipText:t("jsRunnableBlock.showPreview"),onClick:togglePreview,className:"text-xs h-7",icon:jsxRuntimeExports.jsx(Eye,{className:"h-3 w-3 mr-1"})}),jsxRuntimeExports.jsx(ActionTooltipButton,{tooltipText:t("jsRunnableBlock.stopAndClear"),onClick:handleStop,className:"text-xs h-7",icon:jsxRuntimeExports.jsx(Square,{className:"h-3 w-3 mr-1"})})]}),jsxRuntimeExports.jsxs(Button,{size:"sm",onClick:handleRunClick,disabled:isRunning||quickjsStatus==="loading"||!runnableBlocksEnabled,className:"text-xs h-7 "+(securityResult?securityResult.score>90?"bg-[var(--destructive)] border-[var(--destructive)] text-[var(--destructive-foreground)]":securityResult.score>60?"bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-foreground)]":securityResult.score>30?"bg-[var(--warning,var(--primary))] border-[var(--warning,var(--primary))] text-[var(--foreground)]":"bg-[var(--primary)] border-[var(--primary)] text-[var(--primary-foreground)]":""),children:[isRunning||quickjsStatus==="loading"?jsxRuntimeExports.jsx(LoaderCircle,{className:"h-3 w-3 mr-1 animate-spin"}):quickjsStatus!=="ready"&&executionMode==="safe"?jsxRuntimeExports.jsx(Download,{className:"h-3 w-3 mr-1"}):jsxRuntimeExports.jsx(Play,{className:"h-3 w-3 mr-1"}),getRunButtonText()]})]})]}),!isFolded&&!showOutput&&!showPreview&&!isEditing&&jsxRuntimeExports.jsx("div",{className:"overflow-hidden w-full",children:jsxRuntimeExports.jsx("pre",{className:"overflow-x-auto w-full relative overflow-wrap-anywhere border border-border rounded-b-lg bg-muted/20",children:jsxRuntimeExports.jsx("code",{ref:codeRef,className:"language-javascript block p-4 font-mono text-sm leading-relaxed"})})}),!isFolded&&!showOutput&&!showPreview&&isEditing&&jsxRuntimeExports.jsx("div",{className:"overflow-hidden w-full border border-border rounded-b-lg bg-muted/20",children:jsxRuntimeExports.jsx(InlineCodeEditor,{code:editedCode,language:"javascript",onChange:setEditedCode})}),!isFolded&&showOutput&&jsxRuntimeExports.jsxs("div",{className:"output-container border border-border rounded-b-lg bg-black/90 text-green-400 p-4 font-mono text-sm",children:[jsxRuntimeExports.jsx("div",{className:"output-header text-green-300 mb-2 text-xs font-semibold",children:t("jsRunnableBlock.consoleOutput")}),output.length>0?output.map((o,r)=>jsxRuntimeExports.jsx("div",{className:o.startsWith("Execution Error:")||o.startsWith("Error:")?"text-red-400":o.startsWith("Warning:")?"text-yellow-400":"text-green-400",children:o},r)):jsxRuntimeExports.jsx("div",{className:"text-muted-foreground",children:t("jsRunnableBlock.noOutput")})]}),jsxRuntimeExports.jsx("div",{className:!isFolded&&showPreview?"preview-container border border-border rounded-b-lg bg-background p-4":"preview-container-hidden",style:{display:!isFolded&&showPreview?"block":"none",minHeight:!isFolded&&showPreview?"100px":"0"},suppressHydrationWarning:!0,children:!isFolded&&showPreview&&jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment,{children:[jsxRuntimeExports.jsx("div",{className:"preview-header text-muted-foreground mb-2 text-xs font-semibold",children:t("jsRunnableBlock.preview")}),jsxRuntimeExports.jsx("div",{ref:previewContentRef,className:"preview-content min-h-[100px] border border-dashed border-muted-foreground/20 rounded p-2 relative",id:`preview-content-${blockUniqueId}`,children:!hasPreviewContent&&jsxRuntimeExports.jsx("div",{className:"text-muted-foreground text-sm italic absolute inset-0 flex items-center justify-center pointer-events-none z-10",children:t("jsRunnableBlock.noPreviewContent")})})]})},`preview-${blockUniqueId}`),jsxRuntimeExports.jsx("div",{ref:previewRef,className:"unsafe-code-target",style:{position:"absolute",top:"-9999px",left:"-9999px",width:"1px",height:"1px",visibility:"hidden",pointerEvents:"none",zIndex:"-1"},suppressHydrationWarning:!0}),isFolded&&jsxRuntimeExports.jsx("div",{className:"folded-content-preview p-4 cursor-pointer w-full box-border border border-t-0 border-border rounded-b-lg bg-muted/10 hover:bg-muted/20 transition-colors",onClick:toggleFold,children:jsxRuntimeExports.jsx("pre",{className:"whitespace-pre-wrap break-words text-muted-foreground font-mono text-sm",children:foldedPreviewText})})]})},JsRunnableBlockRenderer=reactExports.memo(JsRunnableBlockRendererComponent);export{JsRunnableBlockRenderer};
