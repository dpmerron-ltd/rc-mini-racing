import { defineConfig } from 'vite';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

function nb4Bridge() {
  return {name:'local-nb4-input',configureServer(server){
    const clients=new Set();let last={connected:false,axes:[]};let child;
    const broadcast=data=>{last=data;for(const res of clients)res.write(`data: ${JSON.stringify(data)}\n\n`);};
    if(process.platform==='darwin'){
      child=spawn('swift',[fileURLToPath(new URL('./scripts/nb4-reader.swift',import.meta.url))],{stdio:['ignore','pipe','pipe']});
      createInterface({input:child.stdout}).on('line',line=>{try{broadcast(JSON.parse(line));}catch{}});
      child.stderr.on('data',data=>console.error('[NB4]',String(data).trim()));
      child.on('error',error=>{console.error('[NB4]',error.message);broadcast({connected:false,axes:[],error:'USB reader could not start'});});
      child.on('exit',()=>broadcast({connected:false,axes:[]}));
    }
    server.middlewares.use('/__nb4/events',(req,res)=>{
      const origin=req.headers.origin;
      if(req.headers['sec-fetch-site']==='cross-site'||(origin&&!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))){res.writeHead(403);res.end();return;}
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
      res.write(`data: ${JSON.stringify(last)}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));
    });
    server.httpServer?.once('close',()=>{child?.kill();for(const res of clients)res.end();});
  }};
}
export default defineConfig({plugins:[nb4Bridge()],server:{host:'127.0.0.1',port:5173,strictPort:true,fs:{strict:true}},optimizeDeps:{include:['three']}});
