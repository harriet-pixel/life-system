// One cached view per implemented route. DOM-local handlers stay with its draft;
// document/window subscriptions and observers run only while that view is active.
export function createPageLifecycle(root,onChange=()=>{}){
 let active=true;const tasks=[],suspenders=[],resumers=[];let hooks={};
 const register=start=>{const task={start,stop:active?start():null};tasks.push(task);return task;};
 return {
  get active(){return active;},notify(){if(active)onChange();},
  listen(target,event,handler,options){register(()=>{target.addEventListener(event,handler,options);return()=>target.removeEventListener(event,handler,options);});},
  subscribe(source,handler,options){register(()=>source.subscribe(handler,options));},
  observe(observer,nodes){register(()=>{nodes.forEach(node=>observer.observe(node));return()=>observer.disconnect();});},
  onSuspend(fn){suspenders.push(fn);},onResume(fn){resumers.push(fn);},setHooks(value){hooks={...hooks,...value};},get hooks(){return hooks;},
  suspend(){if(!active)return;active=false;for(const task of tasks){task.stop?.();task.stop=null;}suspenders.forEach(fn=>fn());},
  resume(){if(active)return;active=true;for(const task of tasks)task.stop=task.start();resumers.forEach(fn=>fn());},
  dispose(){this.suspend();tasks.length=0;root.replaceChildren();},
 };
}
