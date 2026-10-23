import test from 'node:test';import assert from 'node:assert/strict';import {createPageLifecycle} from '../assets/page-lifecycle.mjs';import {navigationDensity} from '../assets/navigation-size.mjs';
test('cached page lifecycle pauses and resumes subscriptions/listeners without accumulating work',()=>{
 const lifecycle=createPageLifecycle({replaceChildren(){}}),target=new EventTarget();let updates=0,events=0,subscribed=0,unsubscribed=0,observed=0,disconnected=0;
 const source={subscribe(fn){subscribed++;fn();return()=>unsubscribed++;}};lifecycle.subscribe(source,()=>updates++);lifecycle.listen(target,'fixture',()=>events++);lifecycle.observe({observe(){observed++;},disconnect(){disconnected++;}},[{}]);
 for(let i=0;i<20;i++){target.dispatchEvent(new Event('fixture'));lifecycle.suspend();lifecycle.suspend();target.dispatchEvent(new Event('fixture'));lifecycle.resume();lifecycle.resume();}
 assert.equal(events,20);assert.equal(subscribed,21);assert.equal(updates,21);assert.equal(unsubscribed,20);assert.equal(observed,21);assert.equal(disconnected,20);lifecycle.dispose();assert.equal(unsubscribed,21);assert.equal(disconnected,21);
});
test('navigation density follows CSS-pixel viewport height rather than device models',()=>{assert.equal(navigationDensity(375,900),'comfortable');assert.equal(navigationDensity(812,375),'tight');assert.equal(navigationDensity(1280,500),'compact');assert.equal(navigationDensity(450,601),'comfortable');});
