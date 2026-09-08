#!/usr/bin/env node
'use strict';
const path=require('path');
const root=path.resolve(__dirname,'../../../java-tools');
const webpack=require(path.join(root,'node_modules/webpack'));
const base=require(path.join(root,'webpack.config.js'))[0];
const output=path.resolve(process.argv[2]||path.join(__dirname,'dist'));
process.chdir(root); // Babel resolves named presets relative to the build cwd.
const config={...base,context:root,entry:path.join(__dirname,'browser.cjs'),
  output:{...base.output,path:output,filename:'replay-bundle.js',library:'GuestReplay'}};
webpack(config,(error,stats)=>{
  if(error)throw error;
  console.log(stats.toString({all:false,errors:true,warnings:false,timings:true}));
  process.exitCode=stats.hasErrors()?1:0;
});
