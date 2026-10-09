// Local preview: node dev.js -> http://127.0.0.1:8811
const http = require("http"), fs = require("fs"), path = require("path");
const api = require("./api/data.js");
const types = { ".html": "text/html", ".json": "application/json", ".png": "image/png", ".js": "text/javascript" };
http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];
  if (url.startsWith("/api/data")) {
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
    return api(req, res);
  }
  const file = path.join(__dirname, url === "/" ? "index.html" : path.normalize(url).replace(/^(\.\.[\/\\])+/, ""));
  if (!file.startsWith(__dirname) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
  res.end(fs.readFileSync(file));
}).listen(8811, "127.0.0.1", () => console.log("http://127.0.0.1:8811"));
