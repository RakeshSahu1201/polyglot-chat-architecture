const { Blob } = require('node:buffer');
const http = require('http');

const server = http.createServer((req, res) => {
  console.log('Headers:', req.headers);
  res.writeHead(200);
  res.end('OK');
});

server.listen(3000, async () => {
  const formData = new FormData();
  formData.append('file', new Blob([Buffer.from('test')]), 'test.txt');
  
  await fetch('http://localhost:3000', {
    method: 'POST',
    body: formData
  });
  server.close();
});
