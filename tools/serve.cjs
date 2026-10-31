const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css; charset=utf-8' };
function start(port=4173) {
  return new Promise((resolve,reject)=>{
    const server=http.createServer((req,res)=>{
      let name; try { name=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400); return res.end(); }
      if(name==='/') { res.writeHead(302,{Location:'/preview/index.html'});return res.end(); }
      const target=path.resolve(root, '.'+name);
      if(!target.startsWith(root+path.sep)) { res.writeHead(403); return res.end(); }
      fs.readFile(target,(error,body)=>{ if(error) { res.writeHead(404); return res.end('Not found'); } res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream'); res.end(body); });
    });
    server.once('error',reject); server.listen(port,'127.0.0.1',()=>resolve(server));
  });
}
module.exports={start};
if(require.main===module) start(Number(process.env.PORT||4173)).then(s=>console.log('Предпросмотр: http://127.0.0.1:'+s.address().port)).catch(e=>{console.error(e);process.exitCode=1;});
