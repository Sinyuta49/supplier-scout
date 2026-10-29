import http from 'node:http';
import worker from '../worker/index.js';
const port=Number(process.env.PORT||8931);
http.createServer(async(req,res)=>{try{const r=await worker.fetch(new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method}));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(500);res.end('Local preview error');}}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
