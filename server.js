const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const root = __dirname;
const dataDir = path.join(root, "data");
const contentPath = path.join(dataDir, "content.json");
const examplePath = path.join(dataDir, "content.example.json");
const adminPath = path.join(dataDir, "admin.json");
const dbPath = path.join(dataDir, "seahorse.sqlite");
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

function openDatabase() {
  fs.mkdirSync(dataDir, { recursive: true });
  const isNew = !fs.existsSync(dbPath);
  const database = new DatabaseSync(dbPath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS documents (
      name TEXT PRIMARY KEY,
      body TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      salt TEXT NOT NULL,
      hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY,
      createdAt TEXT NOT NULL,
      status TEXT NOT NULL,
      quoteNote TEXT NOT NULL DEFAULT '',
      application TEXT NOT NULL DEFAULT '',
      depth TEXT NOT NULL DEFAULT '',
      dimensions TEXT NOT NULL DEFAULT '',
      quantity TEXT NOT NULL DEFAULT '',
      finish TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      company TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    );
  `);
  if (isNew) seedDatabase(database);
  return database;
}

function seedDatabase(database) {
  const sourcePath = fs.existsSync(contentPath) ? contentPath : examplePath;
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const catalog = { copy: source.copy, grades: source.grades, contact: source.contact };
  database.prepare("INSERT INTO documents (name, body) VALUES ('content', ?)").run(JSON.stringify(catalog));
  const insertInquiry = database.prepare(`INSERT INTO inquiries (
    id, createdAt, status, quoteNote, application, depth, dimensions, quantity, finish, country, company, email, notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  (source.inquiries || []).forEach((item) => {
    insertInquiry.run(item.id, item.createdAt, item.status || "new", item.quoteNote || "", item.application || "", item.depth || "", item.dimensions || "", item.quantity || "", item.finish || "", item.country || "", item.company || "", item.email || "", item.notes || "");
  });
  if (fs.existsSync(adminPath)) {
    const admin = JSON.parse(fs.readFileSync(adminPath, "utf8"));
    database.prepare("INSERT INTO admin (id, salt, hash) VALUES (1, ?, ?)").run(admin.salt, admin.hash);
    return;
  }
  const password = "Seahorse-local";
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  database.prepare("INSERT INTO admin (id, salt, hash) VALUES (1, ?, ?)").run(salt, hash);
  console.log("Initial admin password: " + password);
  console.log("Change it in the admin before sharing the site.");
}

function readCatalog() {
  const row = db.prepare("SELECT body FROM documents WHERE name = 'content'").get();
  return JSON.parse(row.body);
}

function writeCatalog(catalog) {
  db.prepare("UPDATE documents SET body = ? WHERE name = 'content'").run(JSON.stringify({
    copy: catalog.copy,
    grades: catalog.grades,
    contact: catalog.contact
  }));
}

function listInquiries() {
  return db.prepare("SELECT * FROM inquiries ORDER BY createdAt DESC").all();
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
  const stored = db.prepare("SELECT salt, hash FROM admin WHERE id = 1").get();
  const actual = crypto.scryptSync(String(password), stored.salt, 32);
  const expected = Buffer.from(stored.hash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function savePassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 32).toString("hex");
  db.prepare("UPDATE admin SET salt = ?, hash = ? WHERE id = 1").run(salt, hash);
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
      send(res, 200, publicContent(readCatalog()));
      return;
    }

    if (pathname === "/api/content" && req.method === "PUT") {
      if (!isAuthed(req)) {
        send(res, 401, { error: "请先登录" });
        return;
      }
      const body = JSON.parse(await readBody(req, 2 * 1024 * 1024));
      if (!body.copy || !Array.isArray(body.grades) || !body.contact) {
        send(res, 400, { error: "内容不完整" });
        return;
      }
      writeCatalog({
        copy: body.copy,
        grades: body.grades.map((grade) => {
          const next = grade.slice(0, 7);
          next[6] = Number(next[6]);
          return next;
        }),
        contact: {
          phone: String(body.contact.phone || "").trim(),
          email: String(body.contact.email || "").trim(),
          wechat: String(body.contact.wechat || "").trim()
        }
      });
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
      send(res, 200, { inquiries: listInquiries() });
      return;
    }

    if (pathname === "/api/inquiries" && req.method === "POST") {
      const body = JSON.parse(await readBody(req, 100000));
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
      db.prepare(`INSERT INTO inquiries (
        id, createdAt, status, quoteNote, application, depth, dimensions, quantity, finish, country, company, email, notes
      ) VALUES (
        @id, @createdAt, @status, @quoteNote, @application, @depth, @dimensions, @quantity, @finish, @country, @company, @email, @notes
      )`).run(inquiry);
      send(res, 201, { ok: true });
      return;
    }

    const inquiryMatch = pathname.match(/^\/api\/inquiries\/([a-z0-9]+)$/);
    if (inquiryMatch && (req.method === "PATCH" || req.method === "DELETE")) {
      if (!isAuthed(req)) {
        send(res, 401, { error: "请先登录" });
        return;
      }
      const existing = db.prepare("SELECT id FROM inquiries WHERE id = ?").get(inquiryMatch[1]);
      if (!existing) {
        send(res, 404, { error: "询盘不存在" });
        return;
      }
      if (req.method === "DELETE") {
        db.prepare("DELETE FROM inquiries WHERE id = ?").run(inquiryMatch[1]);
      } else {
        const body = JSON.parse(await readBody(req, 100000));
        const allowed = new Set(["new", "contacted", "quoted", "closed"]);
        if (body.status && allowed.has(body.status)) {
          db.prepare("UPDATE inquiries SET status = ? WHERE id = ?").run(body.status, inquiryMatch[1]);
        }
        if (typeof body.quoteNote === "string") {
          db.prepare("UPDATE inquiries SET quoteNote = ? WHERE id = ?").run(body.quoteNote, inquiryMatch[1]);
        }
      }
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

const db = openDatabase();
server.listen(port, "127.0.0.1", () => {
  console.log("Seahorse site: http://127.0.0.1:" + port + "/");
  console.log("Admin: http://127.0.0.1:" + port + "/admin");
});
