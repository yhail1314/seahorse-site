const languages = [
  ["zh", "中文"],
  ["en", "English"],
  ["ja", "日本語"],
  ["fr", "Français"],
  ["es", "Español"],
  ["de", "Deutsch"],
  ["pt", "Português"],
  ["ru", "Русский"],
  ["ko", "한국어"],
  ["ar", "العربية"]
];

const groups = [
  ["首页", ["title", "浏览器标题"], ["kicker", "眉题"], ["h1", "主标题"], ["lede", "导语"], ["quoteBtn", "报价按钮"], ["seeGrades", "查看型号"], ["heroCaption", "首图说明"]],
  ["型号表", ["gradesTitle", "标题"], ["filterAll", "全部按钮"], ["thGrade", "列：型号"], ["thDensity", "列：密度"], ["thDepth", "列：水深"], ["thAbsorption", "列：吸水率"], ["thStrength", "列：强度"], ["thSeries", "列：系列"], ["seriesStandard", "常规"], ["seriesHigh", "高性能"], ["gradesNote", "表下说明"]],
  ["应用", ["appsTitle", "标题"], ["appsIntro", "导语"], ["photoBlock", "大块浮体"], ["photoRov", "ROV"], ["photoFloats", "海缆浮子"], ["app1Title", "挖沟机标题"], ["app1Body", "挖沟机说明"], ["app1Meta", "挖沟机水深"], ["app2Title", "着陆器标题"], ["app2Body", "着陆器说明"], ["app2Meta", "着陆器水深"], ["app3Title", "潜标标题"], ["app3Body", "潜标说明"], ["app3Meta", "潜标水深"], ["app4Title", "ROV 标题"], ["app4Body", "ROV 说明"], ["app4Meta", "ROV 水深"], ["app5Title", "海缆浮子标题"], ["app5Body", "海缆浮子说明"], ["app5Meta", "海缆浮子说明补充"]],
  ["认证", ["certsTitle", "标题"], ["certsIntro", "导语"], ["certIso", "ISO"], ["certAaa", "AAA"], ["certHitech", "高新技术企业"], ["certReport", "检测报告"], ["factoryCaption", "工厂名称"]],
  ["流程", ["processTitle", "标题"], ["processIntro", "导语"], ["step1t", "步骤1标题"], ["step1d", "步骤1说明"], ["step2t", "步骤2标题"], ["step2d", "步骤2说明"], ["step3t", "步骤3标题"], ["step3d", "步骤3说明"], ["step4t", "步骤4标题"], ["step4d", "步骤4说明"], ["step5t", "步骤5标题"], ["step5d", "步骤5说明"], ["step6t", "步骤6标题"], ["step6d", "步骤6说明"]],
  ["报价表单", ["quoteTitle", "标题"], ["quoteIntro", "导语"], ["labelApp", "应用"], ["labelDepth", "水深"], ["labelSize", "尺寸"], ["labelQty", "数量"], ["labelFinish", "表面处理"], ["labelCountry", "目的国"], ["labelCompany", "公司"], ["labelEmail", "邮箱"], ["labelNotes", "补充说明"], ["optTrencher", "选项：挖沟机"], ["optLander", "选项：着陆器"], ["optMooring", "选项：潜标"], ["optRov", "选项：ROV"], ["optFloat", "选项：海缆浮子"], ["optOther", "选项：其他"], ["finishPoly", "选项：聚脲"], ["finishFrp", "选项：玻璃钢"], ["finishPaint", "选项：油漆"], ["finishOpen", "选项：未定"], ["phDepth", "水深示例"], ["phSize", "尺寸示例"], ["phQty", "数量示例"], ["phCountry", "国家示例"], ["phNotes", "补充示例"], ["quoteHint", "表单提示"]],
  ["关于与联系", ["aboutTitle", "关于标题"], ["aboutBody", "关于正文"], ["fact1t", "要点1标题"], ["fact1d", "要点1内容"], ["fact2t", "要点2标题"], ["fact2d", "要点2内容"], ["fact3t", "要点3标题"], ["fact3d", "要点3内容"], ["contactTitle", "联系人标题"], ["contactIntro", "联系人导语"], ["labelPhone", "电话标签"], ["labelWechat", "微信标签"], ["navProducts", "导航：产品"], ["navApps", "导航：应用"], ["navCerts", "导航：认证"], ["navContact", "导航：联系人"]]
];

const longKeys = new Set(["lede", "heroCaption", "gradesNote", "appsIntro", "app1Body", "app2Body", "app3Body", "app4Body", "app5Body", "certsIntro", "certIso", "certAaa", "certHitech", "certReport", "processIntro", "step1d", "step2d", "step3d", "step4d", "step5d", "step6d", "quoteIntro", "phNotes", "quoteHint", "aboutBody", "fact1d", "fact2d", "fact3d", "contactIntro"]);
const images = [
  ["block.jpg", "首页与应用：大型浮体"],
  ["rov.jpg", "应用：ROV 浮体"],
  ["floats.jpg", "应用：海缆浮子"],
  ["iso.jpg", "ISO 9001 证书"],
  ["aaa.jpg", "AAA 信用证书"],
  ["hitech.jpg", "高新技术企业证书"],
  ["report.jpg", "检测报告"],
  ["factory.jpg", "工厂照片"]
];
const statusLabels = { new: "新询盘", contacted: "已联系", quoted: "已报价", closed: "已关闭" };

const state = { content: null, inquiries: [], view: "overview", lang: "zh" };
let renderToken = 0;
const loginView = document.getElementById("login-view");
const app = document.getElementById("app");
const viewRoot = document.getElementById("view");
const viewTitle = document.getElementById("view-title");
const saveButton = document.getElementById("save");
const saveState = document.getElementById("save-state");

async function api(url, options) {
  const response = await fetch(url, Object.assign({ credentials: "same-origin", headers: { "Content-Type": "application/json" } }, options));
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function field(label, value, onInput, multiline) {
  const wrap = document.createElement("label");
  wrap.textContent = label;
  const input = document.createElement(multiline ? "textarea" : "input");
  input.value = value || "";
  input.addEventListener("input", () => onInput(input.value));
  wrap.appendChild(input);
  return wrap;
}

async function saveContent() {
  saveState.textContent = "正在保存…";
  await api("/api/content", { method: "PUT", body: JSON.stringify({ copy: state.content.copy, grades: state.content.grades, contact: state.content.contact }) });
  saveState.textContent = "已保存。刷新网站即可看到。";
}

async function renderOverview() {
  const token = renderToken;
  state.inquiries = (await api("/api/inquiries")).inquiries;
  if (token !== renderToken) return;
  const content = state.content;
  const counts = { new: 0, contacted: 0, quoted: 0, closed: 0 };
  state.inquiries.forEach((item) => { counts[item.status] = (counts[item.status] || 0) + 1; });
  viewRoot.innerHTML = "<p class='notice'>在这里改完并保存后，打开网站首页刷新就能看到。询盘来自网站上的报价表单。</p>";
  const cards = document.createElement("div");
  cards.className = "cards";
  [
    [content.grades.length, "型号"],
    [Object.keys(content.copy).length, "语言"],
    [counts.new + counts.contacted, "待处理询盘"],
    [counts.quoted, "已报价"]
  ].forEach(([value, label]) => {
    const card = document.createElement("article");
    card.className = "card";
    const strong = document.createElement("strong");
    strong.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    card.append(strong, span);
    cards.appendChild(card);
  });
  viewRoot.appendChild(cards);
}

function renderGrades() {
  const notice = document.createElement("p");
  notice.className = "notice";
  notice.textContent = "水深数字用于网站上的筛选。系列请保持“常规”或“高性能”。";
  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  const add = document.createElement("button");
  add.className = "ghost";
  add.type = "button";
  add.textContent = "添加型号";
  add.addEventListener("click", () => {
    state.content.grades.push(["HY-NEW", "0.00±0.01", "0 m", "≤1%", "≥0 MPa", "Standard", 0]);
    renderGrades();
  });
  toolbar.appendChild(add);
  const wrap = document.createElement("div");
  wrap.className = "table-wrap panel";
  const table = document.createElement("table");
  const head = document.createElement("tr");
  ["型号", "密度", "水深文字", "吸水率", "强度", "系列", "水深数字", ""].forEach((label) => {
    const cell = document.createElement("th");
    cell.textContent = label;
    head.appendChild(cell);
  });
  table.appendChild(head);
  state.content.grades.forEach((grade, index) => {
    const row = document.createElement("tr");
    for (let column = 0; column < 5; column += 1) {
      const cell = document.createElement("td");
      const input = document.createElement("input");
      input.value = grade[column];
      input.addEventListener("input", () => { grade[column] = input.value; });
      cell.appendChild(input);
      row.appendChild(cell);
    }
    const seriesCell = document.createElement("td");
    const series = document.createElement("select");
    [["Standard", "常规"], ["High performance", "高性能"]].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      series.appendChild(option);
    });
    series.value = grade[5] === "High performance" ? "High performance" : "Standard";
    series.addEventListener("change", () => { grade[5] = series.value; });
    seriesCell.appendChild(series);
    const depthCell = document.createElement("td");
    const depth = document.createElement("input");
    depth.value = grade[6];
    depth.addEventListener("input", () => { grade[6] = Number(depth.value) || 0; });
    depthCell.appendChild(depth);
    const action = document.createElement("td");
    const remove = document.createElement("button");
    remove.className = "danger";
    remove.type = "button";
    remove.textContent = "删除";
    remove.addEventListener("click", () => {
      state.content.grades.splice(index, 1);
      renderGrades();
    });
    action.appendChild(remove);
    row.append(seriesCell, depthCell, action);
    table.appendChild(row);
  });
  wrap.appendChild(table);
  viewRoot.replaceChildren(notice, toolbar, wrap);
}

function renderCopy() {
  const row = document.createElement("div");
  row.className = "lang-row";
  const label = document.createElement("label");
  label.textContent = "正在编辑的语言";
  const select = document.createElement("select");
  languages.forEach(([value, name]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = name;
    select.appendChild(option);
  });
  select.value = state.lang;
  select.addEventListener("change", () => {
    state.lang = select.value;
    renderCopy();
  });
  label.appendChild(select);
  const hint = document.createElement("p");
  hint.className = "notice";
  hint.textContent = "先改一种语言，再切换到其他语言改成对应译文。全部改完后点一次保存。";
  row.append(label, hint);
  const fields = document.createElement("div");
  fields.className = "fields";
  const text = state.content.copy[state.lang];
  groups.forEach(([title, ...items]) => {
    const panel = document.createElement("section");
    panel.className = "panel";
    const heading = document.createElement("h2");
    heading.textContent = title;
    panel.appendChild(heading);
    items.forEach(([key, name]) => {
      panel.appendChild(field(name, text[key], (value) => { text[key] = value; }, longKeys.has(key)));
    });
    fields.appendChild(panel);
  });
  viewRoot.replaceChildren(row, fields);
}

function renderMedia() {
  const grid = document.createElement("div");
  grid.className = "media-grid";
  images.forEach(([filename, label]) => {
    const figure = document.createElement("figure");
    figure.className = "panel";
    const image = document.createElement("img");
    image.src = "/images/" + filename + "?t=" + Date.now();
    image.alt = label;
    const caption = document.createElement("figcaption");
    caption.textContent = label;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg";
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        saveState.textContent = "正在更换图片…";
        await api("/api/upload", { method: "POST", body: JSON.stringify({ filename, dataUrl: reader.result }) });
        image.src = "/images/" + filename + "?t=" + Date.now();
        saveState.textContent = "图片已更换。";
      };
      reader.readAsDataURL(file);
    });
    figure.append(image, caption, input);
    grid.appendChild(figure);
  });
  const notice = document.createElement("p");
  notice.className = "notice";
  notice.textContent = "请上传 JPG。新图会替换原位置，网站上的说明文字不用重选。";
  viewRoot.replaceChildren(notice, grid);
}

async function renderInquiries() {
  const token = renderToken;
  state.inquiries = (await api("/api/inquiries")).inquiries;
  if (token !== renderToken) return;
  if (!state.inquiries.length) {
    viewRoot.innerHTML = "<p class='notice'>还没有询盘。网站报价表单提交后，会出现在这里。</p>";
    return;
  }
  const list = document.createElement("div");
  state.inquiries.forEach((item) => {
    const panel = document.createElement("article");
    panel.className = "panel inquiry";
    const info = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = (item.company || "未填公司") + " · " + item.email;
    const meta = document.createElement("p");
    meta.className = "muted";
    meta.textContent = new Date(item.createdAt).toLocaleString() + " · " + item.country;
    const body = document.createElement("p");
    const appLabels = { trencher: "挖沟机", lander: "着陆器", mooring: "潜标系统", rov: "ROV", float: "海缆浮子", other: "其他" };
    const finishLabels = { polyurea: "聚脲", frp: "玻璃钢 + 聚脲", paint: "聚脲 + 油漆", open: "尚未确定" };
    body.textContent = [appLabels[item.application] || item.application, item.depth && (item.depth + " m"), item.dimensions, item.quantity, finishLabels[item.finish] || item.finish, item.notes].filter(Boolean).join(" · ");
    info.append(title, meta, body);
    const side = document.createElement("div");
    const status = document.createElement("label");
    status.textContent = "状态";
    const select = document.createElement("select");
    Object.entries(statusLabels).forEach(([value, name]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = name;
      select.appendChild(option);
    });
    select.value = item.status;
    select.addEventListener("change", async () => {
      item.status = select.value;
      await api("/api/inquiries/" + item.id, { method: "PATCH", body: JSON.stringify({ status: item.status }) });
      saveState.textContent = "状态已更新。";
    });
    status.appendChild(select);
    const note = field("内部报价记录", item.quoteNote, (value) => { item.quoteNote = value; }, true);
    const saveNote = document.createElement("button");
    saveNote.className = "ghost";
    saveNote.type = "button";
    saveNote.textContent = "保存报价记录";
    saveNote.addEventListener("click", async () => {
      await api("/api/inquiries/" + item.id, { method: "PATCH", body: JSON.stringify({ quoteNote: item.quoteNote }) });
      saveState.textContent = "报价记录已保存。";
    });
    const remove = document.createElement("button");
    remove.className = "danger";
    remove.type = "button";
    remove.textContent = "删除";
    remove.addEventListener("click", async () => {
      await api("/api/inquiries/" + item.id, { method: "DELETE" });
      state.inquiries = state.inquiries.filter((entry) => entry.id !== item.id);
      renderInquiries();
    });
    side.append(status, note, saveNote, remove);
    panel.append(info, side);
    list.appendChild(panel);
  });
  viewRoot.replaceChildren(list);
}

function renderContact() {
  const contact = state.content.contact;
  const panel = document.createElement("section");
  panel.className = "panel stack";
  panel.append(
    field("电话", contact.phone, (value) => { contact.phone = value; }),
    field("邮箱", contact.email, (value) => { contact.email = value; }),
    field("微信", contact.wechat, (value) => { contact.wechat = value; })
  );
  const password = document.createElement("section");
  password.className = "panel stack";
  const heading = document.createElement("h2");
  heading.textContent = "修改后台密码";
  const current = field("当前密码", "", () => {});
  const next = field("新密码", "", () => {});
  current.querySelector("input").type = "password";
  next.querySelector("input").type = "password";
  const button = document.createElement("button");
  button.className = "ghost";
  button.type = "button";
  button.textContent = "更新密码";
  const message = document.createElement("p");
  message.className = "muted";
  button.addEventListener("click", async () => {
    try {
      await api("/api/password", { method: "POST", body: JSON.stringify({ current: current.querySelector("input").value, next: next.querySelector("input").value }) });
      message.textContent = "密码已更新。";
    } catch (error) {
      message.textContent = error.message;
    }
  });
  password.append(heading, current, next, button, message);
  const notice = document.createElement("p");
  notice.className = "notice";
  notice.textContent = "电话、邮箱和微信会显示在网站的联系人区域。保存后刷新网站即可。";
  viewRoot.replaceChildren(notice, panel, password);
}

const views = {
  overview: ["概览", renderOverview, false],
  grades: ["型号", renderGrades, true],
  copy: ["描述文案", renderCopy, true],
  media: ["图片", renderMedia, false],
  inquiries: ["询盘与报价", renderInquiries, false],
  contact: ["联系信息", renderContact, true]
};

function show(view) {
  state.view = views[view] ? view : "overview";
  const [title, render, canSave] = views[state.view];
  viewTitle.textContent = title;
  saveButton.hidden = !canSave;
  saveState.textContent = "";
  renderToken += 1;
  document.querySelectorAll("aside nav button").forEach((button) => {
    if (button.dataset.view === state.view) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  render();
}

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.getElementById("login-error");
  error.textContent = "";
  try {
    await api("/api/login", { method: "POST", body: JSON.stringify({ password: new FormData(event.target).get("password") }) });
    await enter();
  } catch (failure) {
    error.textContent = failure.message;
  }
});

document.getElementById("logout").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST", body: "{}" });
  app.hidden = true;
  loginView.hidden = false;
});

saveButton.addEventListener("click", () => saveContent().catch((error) => { saveState.textContent = error.message; }));
document.querySelectorAll("aside nav button").forEach((button) => {
  button.addEventListener("click", () => show(button.dataset.view));
});

async function enter() {
  state.content = await api("/api/content");
  state.inquiries = (await api("/api/inquiries")).inquiries;
  loginView.hidden = true;
  app.hidden = false;
  show("overview");
}

api("/api/session").then(enter).catch(() => {});
