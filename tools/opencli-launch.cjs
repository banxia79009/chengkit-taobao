'use strict';
// Stable entry point. Each invocation resolves the currently selected release.
const {spawn}=require('node:child_process');
const runtime=require('./opencli-runtime.cjs');
const child=spawn(process.execPath,[runtime.entry(),...process.argv.slice(2)],{stdio:'inherit',windowsHide:true,shell:false});
child.on('error',()=>{process.stderr.write('OpenCLI启动失败，旧版仍保留。\n');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
