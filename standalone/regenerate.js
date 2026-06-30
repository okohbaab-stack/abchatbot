const fs = require('fs');

// Build the HTML using array join to avoid template literal escaping issues
const parts = [];

parts.push('<!DOCTYPE html>');
parts.push('<html lang="en">');
parts.push('<head>');
parts.push('<meta charset="utf-8">');
parts.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
parts.push('<title>ABchatbot</title>');
parts.push('<style>');
parts.push('*{margin:0;padding:0;box-sizing:border-box;font-family:Segoe UI,system-ui,sans-serif}');
parts.push(':root{--bg:#0f0f1a;--bg2:#1a1a2e;--bg3:#16213e;--text:#e8e8f0;--text2:#a0a0b8;--text3:#6c6c8a;--accent:#6c63ff;--border:#2a2a4a;--card:#1e1e3a;--success:#22c55e}');
parts.push('body{background:var(--bg);color:var(--text);min-height:100vh}');
parts.push('.app{display:flex;height:100vh;overflow:hidden}');
parts.push('.sidebar{width:260px;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0}');
parts.push('.sidebar h2{padding:20px;font-size:20px;background:linear-gradient(135deg,#6c63ff,#4a90d9);-webkit-background-clip:text;-webkit-text-fill-color:transparent;border-bottom:1px solid var(--border)}');
parts.push('.sidebar .new-btn{margin:12px;padding:10px;border-radius:8px;background:var(--accent);color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer}');
parts.push('.sidebar .new-btn:hover{opacity:.9}');
parts.push('.chat-list{flex:1;overflow-y:auto;padding:8px}');
parts.push('.chat-item{padding:10px 12px;border-radius:8px;cursor:pointer;margin-bottom:2px;font-size:13px}');
parts.push('.chat-item:hover{background:var(--bg3)}');
parts.push('.chat-item.active{background:rgba(108,99,255,.2);border:1px solid var(--accent)}');
parts.push('.chat-item .title{color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
parts.push('.chat-item .date{font-size:11px;color:var(--text3);margin-top:3px}');
parts.push('.sidebar-user{padding:12px 16px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;font-size:13px}');
parts.push('.main{flex:1;display:flex;flex-direction:column}');
parts.push('.nav{display:flex;gap:4px;padding:0 20px;background:var(--bg2);border-bottom:1px solid var(--border)}');
parts.push('.nav button{padding:10px 16px;font-size:13px;font-weight:500;background:transparent;border:none;color:var(--text2);cursor:pointer;border-bottom:2px solid transparent}');
parts.push('.nav button.active{color:var(--accent);border-bottom-color:var(--accent)}');
parts.push('.nav button:hover{color:var(--text)}');
parts.push('.chat-area{flex:1;display:flex;flex-direction:column}');
parts.push('.chat-header{padding:12px 20px;border-bottom:1px solid var(--border);font-size:14px;font-weight:600;background:var(--bg2)}');
parts.push('.messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px}');
parts.push('.msg{display:flex;gap:10px;max-width:80%;animation:fadeIn .3s}');
parts.push('@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}');
parts.push('.msg.user{align-self:flex-end;flex-direction:row-reverse}');
parts.push('.msg-avatar{width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600}');
parts.push('.msg.user .msg-avatar{background:var(--accent)}');
parts.push('.msg.assistant .msg-avatar{background:#4a90d9}');
parts.push('.msg-bubble{padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.5}');
parts.push('.msg.user .msg-bubble{background:var(--accent);color:#fff;border-bottom-right-radius:4px}');
parts.push('.msg.assistant .msg-bubble{background:var(--card);border:1px solid var(--border);border-bottom-left-radius:4px;color:var(--text)}');
parts.push('.input-area{padding:12px 20px;border-top:1px solid var(--border);background:var(--bg2)}');
parts.push('.model-row{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}');
parts.push('.model-chip{padding:4px 12px;border-radius:16px;font-size:11px;font-weight:500;background:var(--bg);border:1px solid var(--border);color:var(--text2);cursor:pointer}');
parts.push('.model-chip.active{background:var(--accent);color:#fff;border-color:var(--accent)}');
parts.push('.input-row{display:flex;gap:8px}');
parts.push('.input-row input{flex:1;padding:10px 14px;border-radius:10px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-size:14px;outline:none}');
parts.push('.input-row input:focus{border-color:var(--accent)}');
parts.push('.input-row button{width:40px;height:40px;border-radius:50%;background:var(--accent);color:#fff;border:none;font-size:18px;cursor:pointer;flex-shrink:0}');
parts.push('.input-row button:disabled{opacity:.5}');
parts.push('.empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text3);padding:40px;text-align:center}');
parts.push('.empty-state .icon{font-size:48px;margin-bottom:16px;opacity:.5}');
parts.push('.empty-state h3{color:var(--text2);margin-bottom:8px}');
parts.push('.typing{display:flex;gap:3px;padding:4px 0}');
parts.push('.typing span{width:6px;height:6px;background:var(--text3);border-radius:50%;animation:typing 1.4s infinite}');
parts.push('.typing span:nth-child(2){animation-delay:.2s}');
parts.push('.typing span:nth-child(3){animation-delay:.4s}');
parts.push('@keyframes typing{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}');
parts.push('.media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;padding:20px;overflow-y:auto}');
parts.push('.media-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;cursor:pointer;transition:all .2s}');
parts.push('.media-card:hover{border-color:var(--accent);transform:translateY(-2px)}');
parts.push('.media-card .icon{font-size:32px;margin-bottom:8px}');
parts.push('.media-card h4{font-size:15px;margin-bottom:4px}');
parts.push('.media-card p{font-size:12px;color:var(--text2)}');
parts.push('.auth-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f0f1a,#16213e);padding:20px}');
parts.push('.auth-card{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:32px;width:100%;max-width:400px}');
parts.push('.auth-card h1{font-size:26px;margin-bottom:4px;background:linear-gradient(135deg,#6c63ff,#4a90d9);-webkit-background-clip:text;-webkit-text-fill-color:transparent}');
parts.push('.auth-card p{color:var(--text2);font-size:14px;margin-bottom:20px}');
parts.push('.auth-card label{display:block;font-size:13px;color:var(--text2);margin-bottom:4px}');
parts.push('.auth-card input{width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;margin-bottom:12px;outline:none}');
parts.push('.auth-card input:focus{border-color:var(--accent)}');
parts.push('.auth-card .btn{width:100%;padding:12px;border-radius:8px;background:var(--accent);color:#fff;border:none;font-size:15px;font-weight:600;cursor:pointer}');
parts.push('.auth-card .btn:hover{opacity:.9}');
parts.push('.auth-card .link{text-align:center;margin-top:16px;font-size:13px;color:var(--text2)}');
parts.push('.auth-card .link a{color:var(--accent);text-decoration:none;cursor:pointer}');
parts.push('.error{color:#ef4444;font-size:13px;margin-bottom:12px;padding:8px 12px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px}');
parts.push('.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100}');
parts.push('.modal{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:24px;width:90%;max-width:480px}');
parts.push('.modal h3{margin-bottom:4px}');
parts.push('.modal p{font-size:13px;color:var(--text2);margin-bottom:16px}');
parts.push('.modal textarea{width:100%;min-height:100px;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;resize:vertical;margin-bottom:16px;outline:none}');
parts.push('.modal textarea:focus{border-color:var(--accent)}');
parts.push('.modal-actions{display:flex;gap:8px;justify-content:flex-end}');
parts.push('.modal-actions button{padding:8px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}');
parts.push('.modal-actions .cancel{background:transparent;border:1px solid var(--border);color:var(--text2)}');
parts.push('.modal-actions .generate{background:var(--accent);border:none;color:#fff}');
parts.push('@media(max-width:640px){.sidebar{width:100%;position:fixed;z-index:10}.main{margin-left:0}}');
parts.push('</style>');
parts.push('</head>');
parts.push('<body>');
parts.push('<div id="app"></div>');
parts.push('<script>');

// JavaScript for the browser
parts.push([
'var API="/api";',
'var state={user:null,token:localStorage.getItem("token"),chats:[],activeChat:null,messages:[],view:"chat",loading:false,mediaForm:null,mediaPrompt:""};',
'',
'async function api(path,opts){',
'  var headers={"Content-Type":"application/json"};',
'  if(state.token)headers.Authorization="Bearer "+state.token;',
'  var res=await fetch(API+path,Object.assign({},opts,{headers:Object.assign({},headers,(opts&&opts.headers)||{})}));',
'  var data=await res.json();',
'  if(!res.ok&&res.status===401){state.token=null;localStorage.removeItem("token");state.user=null;render();}',
'  if(!res.ok)throw new Error(data.error||"Request failed");',
'  return data;',
'}',
'',
'function navigate(v){state.view=v;render();}',
'',
'async function login(e){',
'  e.preventDefault();',
'  var fd=new FormData(e.target);',
'  try{',
'    var data=await api("/auth/login",{method:"POST",body:JSON.stringify(Object.fromEntries(fd))});',
'    state.token=data.accessToken;localStorage.setItem("token",data.token||data.accessToken);',
'    state.user=data.user;render();',
'  }catch(err){document.getElementById("auth-error").textContent=err.message;}',
'}',
'',
'async function register(e){',
'  e.preventDefault();',
'  var fd=new FormData(e.target);',
'  try{',
'    var data=await api("/auth/register",{method:"POST",body:JSON.stringify(Object.fromEntries(fd))});',
'    state.token=data.accessToken;localStorage.setItem("token",data.token||data.accessToken);',
'    state.user=data.user;render();',
'  }catch(err){document.getElementById("auth-error").textContent=err.message;}',
'}',
'',
'function logout(){',
'  state.token=null;localStorage.removeItem("token");state.user=null;state.chats=[];state.activeChat=null;render();',
'}',
'',
'async function loadChats(){',
'  try{state.chats=await api("/chat");render();}catch(e){}',
'}',
'',
'async function newChat(){',
'  try{',
'    var chat=await api("/chat",{method:"POST",body:"{}"});',
'    state.chats.unshift(chat);state.activeChat=chat;state.messages=[];state.view="chat";render();',
'  }catch(e){}',
'}',
'',
'async function selectChat(chat){',
'  var data=await api("/chat/"+(chat._id||chat.id));',
'  state.activeChat=data;state.messages=data.messages||[];state.view="chat";render();',
'}',
'',
'async function sendMessage(){',
'  var input=document.getElementById("msg-input");',
'  var text=input.value.trim();',
'  if(!text||state.loading)return;',
'  input.value="";state.loading=true;',
'  state.messages.push({role:"user",content:text});render();',
'  try{',
'    var chatId=state.activeChat._id||state.activeChat.id;',
'    var res=await api("/chat/"+chatId+"/message",{method:"POST",body:JSON.stringify({content:text,model:state.selectedModel||"openai/gpt-4o"})});',
'    state.messages.push({role:"assistant",content:res.reply});state.loading=false;',
'    if(state.activeChat.title==="New Chat"){state.activeChat.title=text.substring(0,60);loadChats();}',
'    render();',
'  }catch(e){',
'    state.messages.push({role:"assistant",content:"Error: "+e.message});state.loading=false;render();',
'  }',
'}',
'',
'async function generateMedia(type,endpoint){',
'  var text=state.mediaPrompt.trim();',
'  if(!text||state.loading)return;',
'  state.loading=true;render();',
'  try{',
'    await api("/media/generate/"+endpoint,{method:"POST",body:JSON.stringify({prompt:text,type:type})});',
'    state.mediaForm=null;state.mediaPrompt="";state.loading=false;render();',
'    alert("Generation started! Check your history.");',
'  }catch(e){alert("Error: "+e.message);state.loading=false;render();}',
'}',
'',
'function escape(s){var d=document.createElement("div");d.textContent=s||"";return d.innerHTML;}',
'',
'function escAttr(s){return escape(s).replace(/\'/g,"&#39;").replace(/"/g,"&quot;");}',
'',
'function App(){',
'  if(!state.user)return AuthPage();',
'  document.title="ABchatbot - "+state.user.name;',
'  var h="";',
'  h+=\'<div class="app">\';',
'  h+=\'  <aside class="sidebar">\';',
'  h+=\'    <h2>&#10022; ABchatbot</h2>\';',
'  h+=\'    <button class="new-btn" onclick="newChat()">+ New Chat</button>\';',
'  h+=\'    <div class="chat-list">\';',
'  for(var i=0;i<state.chats.length;i++){',
'    var c=state.chats[i];',
'    var active=(state.activeChat&&(state.activeChat._id||state.activeChat.id))===c._id?" active":"";',
'    h+=\'<div class="chat-item\'+active+\'" onclick="selectChat(\'+escAttr(JSON.stringify(c))+\')">\';',
'    h+=\'  <div class="title">\'+escape(c.title)+\'</div>\';',
'    h+=\'  <div class="date">\'+new Date(c.updatedAt).toLocaleDateString()+\'</div>\';',
'    h+=\'</div>\';',
'  }',
'  h+=\'    </div>\';',
'  h+=\'    <div class="sidebar-user">\';',
'  h+=\'      <span>&#128100; \'+escape(state.user.name)+\'</span>\';',
'  h+=\'      <button style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px" onclick="logout()">Sign out</button>\';',
'  h+=\'    </div>\';',
'  h+=\'  </aside>\';',
'  h+=\'  <div class="main">\';',
'  h+=\'    <nav class="nav">\';',
'  h+=\'      <button class="\'+(state.view==="chat"?"active":"")+\'" onclick="navigate(\'chat\')">Chat</button>\';',
'  h+=\'      <button class="\'+(state.view==="media"?"active":"")+\'" onclick="navigate(\'media\')">Create</button>\';',
'  h+=\'    </nav>\';',
'  h+=state.view==="chat"?ChatView():MediaView();',
'  h+=\'  </div>\';',
'  h+=\'</div>\';',
'  return h;',
'}',
'',
'function AuthPage(){',
'  var isLogin=location.hash!=="#register";',
'  var h="";',
'  h+=\'<div class="auth-page">\';',
'  h+=\'  <div class="auth-card">\';',
'  h+=\'    <h1>\'+(isLogin?"Welcome Back":"Create Account")+\'</h1>\';',
'  h+=\'    <p>\'+(isLogin?"Sign in to ABchatbot":"Get started with ABchatbot")+\'</p>\';',
'  h+=\'    <div id="auth-error" class="error" style="display:none"></div>\';',
'  h+=\'    <form onsubmit="\'+(isLogin?"login(event)":"register(event)")+\'">\';',
'  if(!isLogin)h+=\'<label>Name</label><input name="name" placeholder="John Doe" required>\';',
'  h+=\'      <label>Email</label><input name="email" type="email" placeholder="you@example.com" required>\';',
'  h+=\'      <label>Password</label><input name="password" type="password" placeholder="Min 6 chars" required>\';',
'  h+=\'      <button class="btn" type="submit">\'+(isLogin?"Sign In":"Create Account")+\'</button>\';',
'  h+=\'    </form>\';',
'  h+=\'    <div class="link">\';',
'  if(isLogin){h+=\'Don\\\'t have an account? <a href=\\\"#register\\\">Register</a>\'}',
'  else{h+=\'Already have an account? <a href=\\\"#\\\">Sign in</a>\'}',
'  h+=\'    </div>\';',
'  h+=\'  </div>\';',
'  h+=\'</div>\';',
'  return h;',
'}',
'',
'function ChatView(){',
'  if(!state.activeChat){',
'    return \'<div class="empty-state"><div class="icon">&#128172;</div><h3>Start a conversation</h3><p style="font-size:13px">Create a new chat or select one to begin.</p></div>\';',
'  }',
'  var h="";',
'  h+=\'<div class="chat-area">\';',
'  h+=\'  <div class="chat-header">\'+escape(state.activeChat.title)+\'</div>\';',
'  h+=\'  <div class="messages" id="msg-area">\';',
'  if(state.messages.length===0){',
'    h+=\'<div class="empty-state" style="flex:1"><div class="icon">&#10024;</div><h3>Ask anything</h3><p style="font-size:13px">Questions, ideas, content - I\'m here to help.</p></div>\';',
'  }else{',
'    for(var i=0;i<state.messages.length;i++){',
'      var m=state.messages[i];',
'      h+=\'<div class="msg \'+m.role+\'">\';',
'      h+=\'  <div class="msg-avatar">\'+(m.role==="user"?"U":"AI")+\'</div>\';',
'      h+=\'  <div class="msg-bubble">\'+escape(m.content).replace(/\\\\n/g,"<br>")+\'</div>\';',
'      h+=\'</div>\';',
'    }',
'  }',
'  if(state.loading){',
'    h+=\'<div class="msg assistant"><div class="msg-avatar">AI</div><div class="msg-bubble"><div class="typing"><span></span><span></span><span></span></div></div></div>\';',
'  }',
'  h+=\'  </div>\';',
'  h+=\'  <div class="input-area">\';',
'  h+=\'    <div class="model-row">\';',
'  var models=["GPT-4o","Claude","Gemini","Llama"];',
'  var modelIds=["openai/gpt-4o","anthropic/claude-3.5-sonnet","google/gemini-pro-1.5","meta-llama/llama-3.1-8b-instruct"];',
'  for(var j=0;j<models.length;j++){',
'    var active=(state.selectedModel||modelIds[0])===modelIds[j]?" active":"";',
'    var mid=modelIds[j];',
'    h+=\'<span class="model-chip\'+active+\'" onclick="state.selectedModel=\\\'\'+mid+\'\\\';render()">\'+models[j]+\'</span>\';',
'  }',
'  h+=\'    </div>\';',
'  h+=\'    <div class="input-row">\';',
'  h+=\'      <input id="msg-input" placeholder="Ask anything..." onkeydown="if(event.key===\\\'Enter\\\'&&!event.shiftKey){event.preventDefault();sendMessage()}">\';',
'  h+=\'      <button onclick="sendMessage()"\'+(state.loading?" disabled":"")+\'>&#10148;</button>\';',
'  h+=\'    </div>\';',
'  h+=\'  </div>\';',
'  h+=\'</div>\';',
'  return h;',
'}',
'',
'function MediaView(){',
'  var types=[',
'    {type:"image",icon:"&#128248;",title:"Image & Flyer Generator",desc:"Create stunning flyers, posters, social media graphics"},',
'    {type:"document",icon:"&#128196;",title:"Document Creator",desc:"Generate reports, articles, presentations"},',
'    {type:"video",icon:"&#127916;",title:"Video Script Writer",desc:"Create professional video scripts and storyboards"},',
'    {type:"audio",icon:"&#127926;",title:"Audio & Speech",desc:"Generate voiceovers, podcast scripts, narration"},',
'  ];',
'  var epMap={image:"image",document:"document",video:"video",audio:"document"};',
'  var h="";',
'  h+=\'<div style="overflow-y:auto;flex:1">\';',
'  h+=\'  <div style="padding:20px 20px 0">\';',
'  h+=\'    <h2>Create with AI</h2>\';',
'  h+=\'    <p style="color:var(--text2);font-size:13px;margin-top:4px">Generate flyers, posters, documents, video scripts, and more</p>\';',
'  h+=\'  </div>\';',
'  if(state.mediaForm){',
'    h+=\'<div class="modal-overlay" onclick="state.mediaForm=null;render()">\';',
'    h+=\'  <div class="modal" onclick="event.stopPropagation()">\';',
'    h+=\'    <h3>Generate \'+escape(state.mediaForm.title)+\'</h3>\';',
'    h+=\'    <p>Describe what you want to create in detail</p>\';',
'    h+=\'    <textarea id="media-prompt" placeholder="Describe your \'+escape(state.mediaForm.type)+\'..." oninput="state.mediaPrompt=this.value">\'+escape(state.mediaPrompt)+\'</textarea>\';',
'    h+=\'    <div class="modal-actions">\';',
'    h+=\'      <button class="cancel" onclick="state.mediaForm=null;render()">Cancel</button>\';',
'    h+=\'      <button class="generate" onclick="generateMedia(\\\'\'+state.mediaForm.type+\'\\\',\\\'\'+epMap[state.mediaForm.type]+\'\\\')">Generate</button>\';',
'    h+=\'    </div>\';',
'    h+=\'  </div>\';',
'    h+=\'</div>\';',
'  }',
'  h+=\'  <div class="media-grid">\';',
'  for(var i=0;i<types.length;i++){',
'    var t=types[i];',
'    h+=\'<div class="media-card" onclick="state.mediaForm=\'+escAttr(JSON.stringify(t))+\';state.mediaPrompt=\\\'\\\';render()">\';',
'    h+=\'  <div class="icon">\'+t.icon+\'</div>\';',
'    h+=\'  <h4>\'+escape(t.title)+\'</h4>\';',
'    h+=\'  <p>\'+escape(t.desc)+\'</p>\';',
'    h+=\'</div>\';',
'  }',
'  h+=\'  </div>\';',
'  h+=\'</div>\';',
'  return h;',
'}',
'',
'function render(){',
'  document.getElementById("app").innerHTML=App();',
'  if(state.view==="chat"){',
'    setTimeout(function(){var a=document.getElementById("msg-area");if(a)a.scrollTop=a.scrollHeight;},50);',
'  }',
'}',
'',
'(async function(){',
'  if(state.token){',
'    try{var d=await api("/auth/profile");state.user=d.user;await loadChats();}catch(e){state.token=null;localStorage.removeItem("token");}',
'  }',
'  render();',
'  window.addEventListener("hashchange",render);',
'})();',
].join('\n'));

parts.push('</script>');
parts.push('</body>');
parts.push('</html>');

const html = parts.join('\n');
fs.writeFileSync('ABchatbot/standalone/app.html', html);
console.log('Generated app.html - length:', html.length);
console.log('Has App():', html.includes('function App()'));
console.log('Has sendMessage:', html.includes('async function sendMessage'));
console.log('Has selectChat:', html.includes('async function selectChat'));
