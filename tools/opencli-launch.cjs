'use strict';
// Stable entry point. Each invocation resolves the currently selected release.
const {spawn}=require('node:child_process');
const runtime=require('./opencli-runtime.cjs');
const child=spawn(process.execPath,[runtime.entry(),...process.argv.slice(2)],{stdio:'inherit',windowsHide:true,shell:false,env:{...Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|USERPROFILE|APPDATA|LOCALAPPDATA|TEMP|TMP|HOMEDRIVE|HOMEPATH|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY)$/i.test(k))),USERPROFILE:require('node:path').join(__dirname,'..','state','opencli-home')}});
child.on('error',()=>{process.stderr.write('OpenCLI启动失败，旧版仍保留。\n');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
