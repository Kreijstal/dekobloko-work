// Browser playtest controller. Reads the live game's state using reflection and
// writes only its held-key array: rotation and thrust. It never sets position,
// velocity, fuel, shield, cargo ownership or completion state.
export function installEscapeLevelPilot() {
  const jvm=window.geobloxSession.debug.debugController.jvm;
  const fields=new Map();
  function read(object,owner,name) {
    const key=owner+'.'+name;
    let field=fields.get(key);
    if(!field) {
      field=jvm.jre['java/lang/Class'].methods['getDeclaredField(Ljava/lang/String;)Ljava/lang/reflect/Field;'](
        jvm,jvm.getClassObjectSync(owner),[name]);
      fields.set(key,field);
    }
    return jvm.jre['java/lang/reflect/Field'].methods['getInt(Ljava/lang/Object;)I'](jvm,field,[object]);
  }
  const keys=jvm.classes.ScoreSubmission.staticFields.get('field_h:[Z');
  const pilot=window.escapeLevelPilot={status:'waiting',trace:[],phase:'descent',target:0};
  const descent=[[192,180],[512,192],[512,480],[224,480],[224,784],[432,808]];
  const ascent=[[432,792],[224,784],[224,480],[512,480],[512,192],[192,192],[192,-290]];
  let lastTick=-1,pulse=0,hadWorld=false;
  function release(){for(const key of [96,97,98])keys[key]=0;}
  pilot.stop=()=>{cancelAnimationFrame(pilot.frame);release();};
  async function verifyCompletion(world) {
    const method=jvm.jre['java/lang/Class'].methods['getDeclaredMethod(Ljava/lang/String;[Ljava/lang/Class;)Ljava/lang/reflect/Method;'](
      jvm,jvm.getClassObjectSync('GameplaySession'),['isMissionComplete',[{type:'java/lang/Class',isPrimitive:true,name:'byte'}]]);
    method._methodData.className||='GameplaySession';
    jvm.jre['java/lang/reflect/Method'].methods['setAccessible(Z)V'](jvm,method,[1]);
    const base=jvm.threads[0],thread={...base,id:jvm.threads.length,name:'custom-level-completion-check',
      status:'runnable',pendingException:null,callStack:new base.callStack.constructor()};
    const peek=thread.callStack.peek;thread.callStack.peek=function(){return this.isEmpty()?null:peek.call(this);};
    jvm.threads.push(thread);
    const previous=jvm.currentThreadIndex;let call;
    try {
      jvm.currentThreadIndex=thread.id;
      call=jvm.jre['java/lang/reflect/Method'].methods['invoke(Ljava/lang/Object;[Ljava/lang/Object;)Ljava/lang/Object;'](
        jvm,method,[world,[-127]],thread);
    }finally{jvm.currentThreadIndex=previous;}
    const result=await call;
    pilot.engineComplete=!!(result?.value??result);
    pilot.status=pilot.engineComplete?'completed':'failed-completion-check';
  }
  function step() {
    try {
      const world=jvm.classes.BoundedRandomAccessFile.staticFields.get('activeSession:LGameplaySession;');
      if(!world){if(hadWorld){pilot.status='left-session';release();return;}pilot.frame=requestAnimationFrame(step);return;}
      hadWorld=true;
      const get=name=>read(world,'GameplaySession',name);
      const tick=get('activeSessionTicks');
      if(tick===lastTick){pilot.frame=requestAnimationFrame(step);return;}
      lastTick=tick;
      const s={tick,x:get('shipXQ16')/65536,y:get('shipYQ16')/65536,
        vx:get('shipVelocityXQ16')/65536,vy:get('shipVelocityYQ16')/65536,
        angle:get('shipAngle256'),cargo:get('tetheredObjectType'),landed:get('shipLanded'),
        cargoX:get('tetheredXQ16')/65536,cargoY:get('tetheredYQ16')/65536,
        fuel:get('fuel'),shield:get('shieldEnergy'),destroyed:get('shipDestroyed'),
        ended:get('levelEnded'),easy:get('easyMode'),timeHack:get('timeHackMode')};
      pilot.state=s;
      if(tick%25===0)pilot.trace.push({...s,phase:pilot.phase,target:pilot.target});
      if(s.destroyed||s.easy||s.timeHack||!s.fuel||tick>12000){pilot.status='failed';release();return;}
      if(pilot.phase==='ascent'&&s.cargo!==1){pilot.status='cargo-lost';release();return;}
      if(s.ended&&s.cargo===1){pilot.status='verifying';release();verifyCompletion(world).catch(error=>{pilot.status='error';pilot.error=String(error?.message||error);});return;}
      if(s.cargo===1&&pilot.phase!=='ascent'){pilot.phase='ascent';pilot.target=0;pilot.pickup={...s};}
      let route=pilot.phase==='ascent'?ascent:descent;
      if(pilot.phase==='descent'&&pilot.target===route.length)pilot.phase='landing';
      let target=pilot.phase==='landing'?[432,872]:route[Math.min(pilot.target,route.length-1)];
      const dx=target[0]-s.x,dy=target[1]-s.y;
      const settle=pilot.phase==='descent'&&pilot.target===route.length-1;
      if(pilot.phase!=='landing'&&Math.hypot(dx,dy)<(settle?0.7:14)&&Math.hypot(s.vx,s.vy)<(settle?0.004:0.65)&&pilot.target<route.length) {
        pilot.target++;pilot.frame=requestAnimationFrame(step);return;
      }
      const speed=pilot.phase==='ascent'?0.85:pilot.phase==='landing'?0.18:1.15;
      const clamp=(x,n)=>Math.max(-n,Math.min(n,x));
      const ax=0.06*(clamp(dx*0.025,speed)-s.vx);
      const ay=0.06*(clamp(dy*0.025,speed)-s.vy)-get('gravityQ16')/65536;
      const desired=pilot.phase==='landing'?0:(Math.atan2(ax,-ay)*128/Math.PI+256)%256;
      const error=(desired-s.angle+384)%256-128;
      const tolerance=pilot.phase==='landing'?0.5:2;
      keys[97]=error>tolerance?1:0;keys[96]=error< -tolerance?1:0;
      const requested=pilot.phase==='landing'?Math.max(0,-ay):Math.hypot(ax,ay);
      const power=Math.min(1,requested/(get('thrustAccelerationQ16')/65536*(s.cargo===1?0.75:1)));
      pulse+=power;
      keys[98]=((Math.abs(error)<16&&pulse>=1)||s.landed&&pilot.phase!=='landing')?1:0;
      if(keys[98])pulse=Math.max(0,pulse-1);
      pulse=Math.min(pulse,2);
      pilot.status='flying';pilot.frame=requestAnimationFrame(step);
    }catch(error){pilot.status='error';pilot.error=String(error?.message||error);release();}
  }
  pilot.frame=requestAnimationFrame(step);
  return {installed:true};
}
