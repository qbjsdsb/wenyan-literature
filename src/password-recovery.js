import {cloud,configured} from './cloud/client.js';

const panel=document.querySelector('#panel');
let recoveryActive=false;

function cleanAuthFragment(){
 const url=new URL(location.href);
 if(url.hash){url.hash='';history.replaceState(null,'',url.pathname+url.search);}
}

function panelHeader(){return '<header class="panel-header"><span>Wenyan</span><button type="button" class="icon-button" data-password-recovery="close" aria-label="关闭面板"><i class="ph ph-x" aria-hidden="true"></i></button></header>';}

function openResetPanel(){
 if(!panel||!cloud)return;
 recoveryActive=true;cleanAuthFragment();
 panel.innerHTML=`${panelHeader()}<h2 id="panel-title">设置新密码</h2><form id="password-reset-form"><label>新密码 <input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label>再输入一次 <input name="confirm" type="password" autocomplete="new-password" minlength="8" required></label><button type="submit" class="primary">保存新密码</button><p class="source-note">至少 8 位。保存后会回到文研并自动恢复云端登录。</p><p id="password-reset-message" role="status"></p></form>`;
 panel.setAttribute('aria-labelledby','panel-title');
 if(!panel.open)panel.showModal();
 panel.querySelector('input[name="password"]')?.focus();
}

function decorateLogin(){
 const form=document.querySelector('#cloud-login-form');
 if(!form||form.querySelector('[data-password-recovery="request"]')||!configured)return;
 const button=document.createElement('button');
 button.type='button';button.className='text-button';button.dataset.passwordRecovery='request';button.textContent='忘记密码？';
 const message=form.querySelector('#login-message');
 form.insertBefore(button,message||null);
}

async function sendRecovery(form,button){
 const email=form.elements.email?.value?.trim();
 const message=form.querySelector('#login-message');
 if(!email){form.elements.email?.focus();form.reportValidity();return;}
 button.disabled=true;
 try{
  const {error}=await cloud.auth.resetPasswordForEmail(email);
  if(error)throw error;
  if(message)message.textContent='如果这个邮箱对应文研账户，重置邮件已经发送。请检查收件箱和垃圾邮件。';
 }catch(error){
  if(message)message.textContent=error?.status===429?'发送过于频繁，请稍后再试。':'暂时无法发送重置邮件，请稍后再试。';
 }finally{button.disabled=false;}
}

async function saveNewPassword(form){
 const message=form.querySelector('#password-reset-message');
 const password=form.elements.password.value;
 const confirm=form.elements.confirm.value;
 if(password!==confirm){message.textContent='两次输入的密码不一致。';form.elements.confirm.focus();return;}
 if(password.length<8){message.textContent='新密码至少需要 8 位。';form.elements.password.focus();return;}
 const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
 try{
  const {error}=await cloud.auth.updateUser({password});
  if(error)throw error;
  message.textContent='密码已经更新，正在重新打开文研…';
  const url=new URL(location.href);url.hash='';url.search='';
  setTimeout(()=>location.replace(url.href),350);
 }catch(error){
  message.textContent=error?.status===422?'这个密码不能使用，请换一个更强的密码。':'密码更新失败，请重新打开邮件里的重置链接再试。';
  submit.disabled=false;
 }
}

if(configured&&cloud){
 cloud.auth.onAuthStateChange((event)=>{
  if(event==='PASSWORD_RECOVERY')queueMicrotask(openResetPanel);
 });

 const initial=new URLSearchParams(location.hash.slice(1));
 if(initial.get('type')==='recovery'){
  queueMicrotask(async()=>{
   const {data}=await cloud.auth.getSession();
   if(data.session)openResetPanel();
  });
 }

 document.addEventListener('click',event=>{
  if(event.target.closest('[data-action="cloud-login"]'))queueMicrotask(decorateLogin);
  const button=event.target.closest('[data-password-recovery]');if(!button)return;
  event.preventDefault();
  if(button.dataset.passwordRecovery==='request')void sendRecovery(button.closest('form'),button);
  if(button.dataset.passwordRecovery==='close'&&panel?.open){panel.close();recoveryActive=false;}
 });

 document.addEventListener('submit',event=>{
  if(event.target.id!=='password-reset-form')return;
  event.preventDefault();void saveNewPassword(event.target);
 });

 window.addEventListener('wenyan-cloud-status',()=>{if(!recoveryActive)queueMicrotask(decorateLogin);});
}
