const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const dataDir = path.join(root, "data");
const contentPath = path.join(dataDir, "content.json");
const adminPath = path.join(dataDir, "admin.json");
const port = Number(process.env.PORT) || 4178;
const sessions = new Map();
const imageNames = new Set(["block.jpg", "rov.jpg", "floats.jpg", "iso.jpg", "aaa.jpg", "hitech.jpg", "report.jpg", "factory.jpg"]);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".json": "application/json; charset=utf-8"
};

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ "Content-Type": "application/json; charset=utf-8" }, headers));
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function ensureData() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(contentPath)) {
    fs.copyFileSync(path.join(dataDir, "content.example.json"), contentPath);
  }
  if (!fs.existsSync(adminPath)) {
    const password = "Seahorse-local";
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 32).toString("hex");
    fs.writeFileSync(adminPath, JSON.stringify({ salt, hash }, null, 2));
    console.log("Initial admin password: " + password);
    console.log("Change it in the admin before sharing the site.");
  }
}

function readContent() {
  return JSON.parse(fs.readFileSync(contentPath, "utf8"));
}

function writeContent(content) {
  fs.writeFileSync(contentPath, JSON.stringify(content, null, 2));
}

function publicContent(content) {
  return { copy: content.copy, grades: content.grades, contact: content.contact };
}

function cookieToken(req) {
  const header = req.headers.cookie || "";
  const match = header.match(/(?:^|;\s*)seahorse_admin=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function isAuthed(req) {
  const token = cookieToken(req);
  const session = sessions.get(token);
  return Boolean(token && session && session.expires > Date.now());
}

function verifyPassword(password) {
  const stored = JSON.parse(fs.readFileSync(adminPath, "utf8"));
  const actual = crypto.scryptSync(String(password), stored.salt, 32);
  const expected = Buffer.from(stored.hash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function savePassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 32).toString("hex");
  fs.writeFileSync(adminPath, JSON.stringify({ salt, hash }, null, 2));
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, { error: "not found" });
      return;
    }
    const type = types[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (pathname === "/api/session" && req.method === "GET") {
      send(res, isAuthed(req) ? 200 : 401, { ok: isAuthed(req) });
      return;
    }

    if (pathname === "/api/login" && req.method === "POST") {
      const body = JSON.parse(await readBody(req, 10000));
      if (!verifyPassword(body.password || "")) {
        send(res, 401, { error: "密码不正确" });
        return;
      }
      const token = crypto.randomBytes(24).toString("hex");
      sessions.set(token, { expires: Date.now() + 12 * 60 * 60 * 1000 });
      send(res, 200, { ok: true }, {
        "Set-Cookie": "seahorse_admin=" + token + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200"
      });
      return;
    }

    if (pathname === "/api/logout" && req.method === "POST") {
      sessions.delete(cookieToken(req));
      send(res, 200, { ok: true }, { "Set-Cookie": "seahorse_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" });
      return;
    }

    if (pathname === "/api/content" && req.method === "GET") {
      send(res, 200, publicContent(readContent()));
      return;
    }

    if (pathname === "/api/content" && req.method === "PUT") {
      if (!isAuthed(req)) {
        send(res, 401, { error: "请先登录" });
        return;
      }
      const body = JSON.parse(await readBody(req, 2 * 1024 * 1024));
      const current = readContent();
      if (!body.copy || !Array.isArray(body.grades) || !body.contact) {
        send(res, 400, { error: "内容不完整" });
        return;
      }
      current.copy = body.copy;
      current.grades = body.grades.map((grade) => {
        const next = grade.slice(0, 7);
        next[6] = Number(next[6]);
        return next;
      });
      current.contact = {
        phone: String(body.contact.phone || "").trim(),
        email: String(body.contact.email || "").trim(),
        wechat: String(body.contact.wechat || "").trim()
      };
      writeContent(current);
      send(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/password" && req.method === "POST") {
      if (!isAuthed(req)) {
        send(res, 401, { error: "请先登录" });
        return;
      }
      const body = JSON.parse(await readBody(req, 10000));
      if (!verifyPassword(body.current || "") || String(body.next || "").length < 8) {
        send(res, 400, { error: "当前密码不正确，或新密码少于 8 位" });
        return;
      }
      savePassword(body.next);
      send(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/inquiries" && req.method === "GET") {
      if (!isAuthed(req)) {
        send(res, 401, { error: "请先登录" });
        return;
      }
      send(res, 200, { inquiries: readContent().inquiries || [] });
      return;
    }

    if (pathname === "/api/inquiries" && req.method === "POST") {
      const body = JSON.parse(await readBody(req, 100000));
      const content = readContent();
      const inquiry = {
        id: Date.now().toString(36),
        createdAt: new Date().toISOString(),
        status: "new",
        quoteNote: "",
        application: String(body.application || ""),
        depth: String(body.depth || ""),
        dimensions: String(body.dimensions || ""),
        quantity: String(body.quantity || ""),
        finish: String(body.finish || ""),
        country: String(body.country || ""),
        company: String(body.company || ""),
        email: String(body.email || ""),
        notes: String(body.notes || "")
      };
      content.inquiries = content.inquiries || [];
      content.inquiries.unshift(inquiry);
      writeContent(content);
      send(res, 201, { ok: true });
      return;
    }

    const inquiryMatch = pathname.match(/^\/api\/inquiries\/([a-z0-9]+)$/);
    if (inquiryMatch && (req.method === "PATCH" || req.method === "DELETE")) {
      if (!isAuthed(req)) {
        send(res, 401, { error: "请先登录" });
        return;
      }
      const content = readContent();
      const index = (content.inquiries || []).findIndex((item) => item.id === inquiryMatch[1]);
      if (index < 0) {
        send(res, 404, { error: "询盘不存在" });
        return;
      }
      if (req.method === "DELETE") {
        content.inquiries.splice(index, 1);
      } else {
        const body = JSON.parse(await readBody(req, 100000));
        const allowed = new Set(["new", "contacted", "quoted", "closed"]);
        if (body.status && allowed.has(body.status)) content.inquiries[index].status = body.status;
        if (typeof body.quoteNote === "string") content.inquiries[index].quoteNote = body.quoteNote;
      }
      writeContent(content);
      send(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/upload" && req.method === "POST") {
      if (!isAuthed(req)) {
        send(res, 401, { error: "请先登录" });
        return;
      }
      const body = JSON.parse(await readBody(req, 8 * 1024 * 1024));
      if (!imageNames.has(body.filename) || typeof body.dataUrl !== "string") {
        send(res, 400, { error: "不能上传这个文件" });
        return;
      }
      const match = body.dataUrl.match(/^data:image\/(?:jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/);
      if (!match) {
        send(res, 400, { error: "请上传 JPG 图片" });
        return;
      }
      fs.writeFileSync(path.join(root, "images", body.filename), Buffer.from(match[1], "base64"));
      send(res, 200, { ok: true });
      return;
    }

    const relative = (pathname === "/admin" || pathname === "/admin/" ? "admin/index.html" : pathname.replace(/^\/+/, "") || "index.html");
    const resolved = path.resolve(root, relative);
    const rootResolved = path.resolve(root);
    const inside = path.relative(rootResolved, resolved);
    if (inside.startsWith("..") || path.isAbsolute(inside) || inside === "server.js" || inside.startsWith("data" + path.sep)) {
      send(res, 404, { error: "not found" });
      return;
    }
    serveFile(res, resolved);
  } catch (error) {
    send(res, 400, { error: "请求无法处理" });
  }
});

ensureData();
server.listen(port, "127.0.0.1", () => {
  console.log("Seahorse site: http://127.0.0.1:" + port + "/");
  console.log("Admin: http://127.0.0.1:" + port + "/admin");
});
