// Local preview: node dev.js -> http://127.0.0.1:8811
const http = require("http"), fs = require("fs"), path = require("path");
const api = require("./api/data.js");
http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/data")) {
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
    return api(req, res);
  }
  res.setHeader("Content-Type", "text/html");
  res.end(fs.readFileSync(path.join(__dirname, "index.html")));
}).listen(8811, "127.0.0.1", () => console.log("http://127.0.0.1:8811"));
