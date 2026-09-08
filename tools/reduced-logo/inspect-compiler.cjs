'use strict';
const fs=require('fs'),path=require('path');
const {JVM}=require('../../../java-tools/src/core/jvm');
(async()=>{
 const options=require('./results/runtime.json').jvmOptions;
 const j=new JVM({...options,classpath:process.argv[2],jit:{...options.jit,compileWorker:false}});
 await j.preloadClasspathClasses();
 const method=await j.findMethodInHierarchy('LogoFlatTriangle','draw','(IIII[IIIII)V');
 const result=j.jit.structuredSsa.compile(method);
 const source=result?.jvmGeneratedSource||j.jit.structuredSsa.lastFailedSource;
 fs.writeFileSync(process.argv[3],String(source));
 console.log({compiled:!!result,reason:j.jit.structuredSsa.lastRejectionReason,bytes:source?.length,stack:j.jit.structuredSsa.lastCompileError?.stack});
 if(!result)process.exitCode=1;
})();
