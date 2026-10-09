// Local preview: node dev.js -> http://127.0.0.1:8811
const http = require("http"), fs = require("fs"), path = require("path");
const types = { ".html": "text/html", ".json": "application/json", ".png": "image/png", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".mp4": "video/mp4", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];
  const route = url.match(/^\/api\/(data|candles|volume|summary)$/);
  if (route) {
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
    return require(`./api/${route[1]}.js`)(req, res);
  }
  let file = path.join(__dirname, url === "/" ? "index.html" : path.normalize(url).replace(/^(\.\.[\/\\])+/, ""));
  if (!path.extname(file) && fs.existsSync(file + ".html")) file += ".html"; // cleanUrls, like Vercel
  if (!file.startsWith(__dirname) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
  res.end(fs.readFileSync(file));
}).listen(8811, "127.0.0.1", () => console.log("http://127.0.0.1:8811"));
