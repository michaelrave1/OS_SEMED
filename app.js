const STORAGE_KEY = "dirlogistica-os-state-v1";
const DATA_VERSION = "csv-logistica-v1";

const statuses = [
  "Aberta",
  "Em análise",
  "Em execução",
  "Aguardando material",
  "Aguardando deslocamento/logística",
  "Concluída",
  "Cancelada",
];

const demoUsers = [
  { id: "u-admin", name: "Administrador", email: "admin@dirlogistica.local", password: "admin123", role: "Administrador", unit: "" },
  { id: "u-solicitante", name: "Solicitante", email: "solicitante@dirlogistica.local", password: "admin123", role: "Solicitante", unit: "" },
  { id: "u-tecnico", name: "Responsável Técnico", email: "tecnico@dirlogistica.local", password: "admin123", role: "Responsável/Técnico", unit: "" },
  { id: "u-logistica", name: "Equipe Logística", email: "logistica@dirlogistica.local", password: "admin123", role: "Logística", unit: "" },
  { id: "u-gestor", name: "Gestor Consulta", email: "gestor@dirlogistica.local", password: "admin123", role: "Gestor/Consulta", unit: "" },
];

const navItems = [
  ["dashboard", "Dashboard"],
  ["orders", "Ordens de serviço"],
  ["new-order", "Nova OS"],
  ["units", "Unidades"],
  ["logistics", "Logística"],
  ["routes", "Rotas"],
  ["vehicles", "Veículos"],
  ["drivers", "Motoristas"],
  ["users", "Usuários"],
  ["docs", "Documentação"],
];

const app = document.querySelector("#app");
let state = loadState();
let currentView = "dashboard";
let drawerOrderId = null;
let activeCrud = "units";

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return normalizeState(JSON.parse(stored));

  const seed = window.DIRLOGISTICA_SEED || {};
  const initial = {
    dataVersion: DATA_VERSION,
    session: null,
    users: demoUsers,
    units: (seed.UNIDADES || []).map((row) => ({
      id: row["Row ID"],
      type: row.TIPO || "Não informado",
      name: row["NOME DA UNIDADE"] || "Unidade sem nome",
      address: row["ENDEREÇO UNIDADE"] || "",
      latlong: row.LATLONG || "",
      active: true,
    })),
    logistics: mapLogisticsRows(seed.LOGISTICA || []),
    routes: (seed.ROTAS || []).map((row) => ({
      id: row["Row ID"],
      routeId: row["ID ROTA"] || "",
      name: row.ROTA || "",
      number: row["Nº ROTA"] || "",
      link: row.LINK || "",
      active: true,
    })),
    vehicles: (seed.VEICULOS || []).map((row) => ({
      id: row["Row ID"],
      plate: row.ID_PLACA || "",
      model: row["MODELO / TIPO"] || "",
      seats: row["Nº DE PASSAGEIROS"] || "",
      active: true,
    })),
    drivers: (seed.MOTORISTAS || []).map((row) => ({
      id: row["Row ID"],
      driverId: row.ID || "",
      name: row["NOME DO MOTORISTA"] || "",
      active: true,
    })),
    orders: (seed.ABERTURA_OS || []).map((row, index) => ({
      id: row.ID || makeId("OS"),
      rowId: row["Row ID"] || makeId("ROW"),
      openedBy: row["QUEM ABRE"] || "importado@appsheet",
      unit: row.ESTABELECIMENTO || "",
      openedAt: excelDate(row["DATA DE ABERTURA"]) || new Date().toISOString(),
      area: row["ÁREA DE SOLICITAÇÃO"] || "",
      nature: row["NATUREZA DA ATIVIDADE"] || "",
      activityType: row["TIPO DE ATIVIDADE"] || "",
      description: row["DESCRIÇÃO DA ATIVIDADE"] || "",
      detail: row["DETALHAMENTO DA ATIVIDADE"] || "",
      hasMaterial: row["POSSUI MATERIAL"] || "Não informado",
      observation: row["OBSERVAÇÃO"] || "",
      attachments: compact([row.ANEXOS, row.FOTO, row.DOCUMENTOS]),
      policeReport: row["B.O - REDS"] || "",
      occurredAt: excelDate(row["DATA DO OCORRIDO"]) || "",
      responsible: row.RESPONSAVEL || "",
      driver: row.MOTORISTAS || "",
      vehicle: row.PLACA || "",
      vehicleModel: row["MODELO VEICULO"] || "",
      route: row.ROTA || "",
      status: statuses[index % 5],
      active: true,
      messages: compact([row.MENSAGENS_OS]).map((text) => ({
        id: makeId("MSG"),
        user: row["QUEM ABRE"] || "importado@appsheet",
        createdAt: new Date().toISOString(),
        text,
      })),
      history: [
        {
          id: makeId("HIS"),
          user: "Importação AppSheet",
          createdAt: new Date().toISOString(),
          text: "Ordem importada da tabela ABERTURA_OS.",
        },
      ],
    })),
  };

  assignDefaultUserUnits(initial);
  saveState(initial);
  return initial;
}

function normalizeState(next) {
  const seed = window.DIRLOGISTICA_SEED || {};
  if (next.dataVersion !== DATA_VERSION && seed.LOGISTICA?.length) {
    next.logistics = mapLogisticsRows(seed.LOGISTICA);
    next.dataVersion = DATA_VERSION;
  }
  next.users = (next.users || demoUsers).map((user) => ({
    ...user,
    unit: user.unit || "",
  }));
  next.logistics = (next.logistics || []).map((item) => ({
    ...item,
    description: item.description || "",
  }));
  assignDefaultUserUnits(next);
  saveState(next);
  return next;
}

function mapLogisticsRows(rows) {
  return rows.map((row) => ({
    id: row["Row ID"],
    area: row["Área de solicitação"] || "",
    nature: row["Natureza da atividade"] || "",
    type: row["Tipo de atividade"] || "",
    description: row["Descrição da atividade"] || "",
    detail: row["Detalhamento da atividade"] || "",
    options: row.OPCOES || "",
    reminder: row.lembrete || "",
    active: true,
  }));
}

function assignDefaultUserUnits(next) {
  const units = next.units || [];
  const detic = units.find((unit) => unit.name === "DETIC");
  const prefeitura = units.find((unit) => unit.name === "PREFEITURA MUNICIPAL DE UBERABA");
  const firstUnit = units.find((unit) => unit.active) || units[0];
  const fallback = detic?.name || prefeitura?.name || firstUnit?.name || "";
  next.users.forEach((user) => {
    if (!user.unit) user.unit = fallback;
  });
}

function saveState(next = state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function makeId(prefix = "ID") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function compact(values) {
  return values.filter((value) => value && value !== "N");
}

function excelDate(value) {
  const serial = Number(value);
  if (!serial) return "";
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const fractional = serial - Math.floor(serial);
  dateInfo.setSeconds(dateInfo.getSeconds() + Math.round(fractional * 86400));
  return dateInfo.toISOString();
}

function formatDate(value) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function canManage() {
  return ["Administrador", "Logística", "Responsável/Técnico"].includes(state.session?.role);
}

function canEditCatalogs() {
  return ["Administrador", "Logística"].includes(state.session?.role);
}

function isAdmin() {
  return state.session?.role === "Administrador";
}

function currentUser() {
  return state.users.find((user) => user.id === state.session?.id) || state.session;
}

function currentUserUnit() {
  return currentUser()?.unit || "";
}

function render() {
  if (!state.session) return renderLogin();
  renderShell();
}

function renderLogin() {
  app.innerHTML = document.querySelector("#login-template").innerHTML;
  document.querySelector("#login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = data.get("email").toString().trim().toLowerCase();
    const password = data.get("password").toString();
    const user = state.users.find((item) => item.email === email && item.password === password);
    if (!user) return alert("E-mail ou senha inválidos.");
    state.session = { id: user.id, name: user.name, email: user.email, role: user.role, unit: user.unit };
    saveState();
    currentView = "dashboard";
    render();
  });
}

function renderShell() {
  app.innerHTML = `
    <section class="app-shell">
      <aside class="sidebar">
        <div>
          <span class="eyebrow">DIRLOGISTICA</span>
          <h1>Ordens de Serviço</h1>
        </div>
        <div class="profile">
          <strong>${escapeHtml(state.session.name)}</strong>
          <span>${escapeHtml(state.session.role)}</span>
          <span>${escapeHtml(currentUserUnit() || "Sem estabelecimento")}</span>
        </div>
        <nav class="nav">
          ${navItems.map(([id, label]) => `<button class="${id === currentView ? "active" : ""}" data-nav="${id}">${label}</button>`).join("")}
        </nav>
        <button class="secondary" id="logout">Sair</button>
      </aside>
      <section class="content" id="view"></section>
    </section>
    <section class="drawer" id="drawer"></section>
  `;
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      currentView = button.dataset.nav;
      renderShell();
    });
  });
  document.querySelector("#logout").addEventListener("click", () => {
    state.session = null;
    saveState();
    render();
  });
  renderView();
}

function renderView() {
  const view = document.querySelector("#view");
  if (currentView === "dashboard") view.innerHTML = dashboardHtml();
  if (currentView === "orders") view.innerHTML = ordersHtml();
  if (currentView === "new-order") view.innerHTML = orderFormHtml();
  if (["units", "logistics", "routes", "vehicles", "drivers"].includes(currentView)) {
    activeCrud = currentView;
    view.innerHTML = crudHtml();
  }
  if (currentView === "users") view.innerHTML = usersHtml();
  if (currentView === "docs") view.innerHTML = docsHtml();
  bindViewEvents();
}

function headerHtml(title, subtitle, action = "") {
  return `
    <header class="topbar">
      <div>
        <h2>${title}</h2>
        <p>${subtitle}</p>
      </div>
      <div class="actions">${action}</div>
    </header>
  `;
}

function dashboardHtml() {
  const activeOrders = state.orders.filter((order) => order.active);
  const pending = activeOrders.filter((order) => !["Concluída", "Cancelada"].includes(order.status));
  const statusCounts = countBy(activeOrders, "status");
  const areaCounts = countBy(activeOrders, "area");
  const routeCounts = countBy(activeOrders.filter((order) => order.route), "route");
  return `
    ${headerHtml("Dashboard", "Indicadores operacionais das ordens de serviço e logística.")}
    <section class="grid stats">
      ${statHtml("Ordens abertas", activeOrders.length)}
      ${statHtml("Pendentes", pending.length)}
      ${statHtml("Unidades", state.units.filter((item) => item.active).length)}
      ${statHtml("Rotas", state.routes.filter((item) => item.active).length)}
    </section>
    <section class="grid two-col" style="margin-top:16px">
      <div class="card section">
        <h3>Ordens por status</h3>
        ${barsHtml(statusCounts)}
      </div>
      <div class="card section">
        <h3>Ordens por área</h3>
        ${barsHtml(areaCounts)}
      </div>
      <div class="card section">
        <h3>Últimas ordens</h3>
        ${recentOrdersHtml(activeOrders)}
      </div>
      <div class="card section">
        <h3>Ordens por rota</h3>
        ${barsHtml(routeCounts)}
      </div>
    </section>
  `;
}

function statHtml(label, value) {
  return `<article class="card stat"><span>${label}</span><strong>${value}</strong></article>`;
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const label = item[key] || "Não informado";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

function barsHtml(counts) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!entries.length) return `<p class="muted">Sem dados para exibir.</p>`;
  const max = Math.max(...entries.map(([, value]) => value));
  return entries.map(([label, value]) => `
    <div class="bar-row">
      <span title="${escapeHtml(label)}">${escapeHtml(label)}</span>
      <div class="bar"><span style="width:${Math.max(8, (value / max) * 100)}%"></span></div>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function recentOrdersHtml(orders) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Unidade</th><th>Status</th><th>Aberta em</th></tr></thead>
        <tbody>
          ${orders.slice().sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt)).slice(0, 6).map((order) => `
            <tr>
              <td><button class="secondary" data-open-order="${order.id}">${escapeHtml(order.id)}</button></td>
              <td>${escapeHtml(order.unit)}</td>
              <td>${statusPill(order.status)}</td>
              <td>${formatDate(order.openedAt)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function ordersHtml() {
  return `
    ${headerHtml("Ordens de serviço", "Acompanhe, filtre e atualize solicitações.", `<button data-go-new>Nova OS</button>`)}
    <section class="toolbar">
      <input class="wide" id="filter-search" placeholder="Buscar por ID, unidade, descrição ou responsável" />
      ${selectHtml("filter-status", ["", ...statuses], "Todos os status")}
      ${selectHtml("filter-area", ["", ...unique(state.logistics.map((item) => item.area))], "Todas as áreas")}
      ${selectHtml("filter-unit", ["", ...unique(state.units.map((item) => item.name))], "Todas as unidades")}
      ${selectHtml("filter-route", ["", ...unique(state.routes.map((item) => item.name))], "Todas as rotas")}
    </section>
    <div id="orders-table"></div>
  `;
}

function renderOrdersTable() {
  const search = document.querySelector("#filter-search")?.value.toLowerCase() || "";
  const filters = {
    status: document.querySelector("#filter-status")?.value || "",
    area: document.querySelector("#filter-area")?.value || "",
    unit: document.querySelector("#filter-unit")?.value || "",
    route: document.querySelector("#filter-route")?.value || "",
  };
  const orders = state.orders.filter((order) => {
    const haystack = [order.id, order.unit, order.area, order.nature, order.activityType, order.description, order.responsible].join(" ").toLowerCase();
    return order.active
      && (!search || haystack.includes(search))
      && (!filters.status || order.status === filters.status)
      && (!filters.area || order.area === filters.area)
      && (!filters.unit || order.unit === filters.unit)
      && (!filters.route || order.route === filters.route);
  });
  document.querySelector("#orders-table").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Status</th><th>Unidade</th><th>Classificação</th><th>Responsável</th><th>Logística</th><th>Ações</th></tr></thead>
        <tbody>
          ${orders.map((order) => `
            <tr>
              <td><strong>${escapeHtml(order.id)}</strong><br><span class="muted">${formatDate(order.openedAt)}</span></td>
              <td>${statusPill(order.status)}</td>
              <td>${escapeHtml(order.unit)}</td>
              <td>${escapeHtml(order.area)}<br><span class="muted">${escapeHtml(order.nature)} / ${escapeHtml(order.activityType)}</span></td>
              <td>${escapeHtml(order.responsible || "Não atribuído")}</td>
              <td>${escapeHtml(order.driver || "Sem motorista")}<br><span class="muted">${escapeHtml(order.vehicle || "Sem veículo")} ${order.route ? ` / ${escapeHtml(order.route)}` : ""}</span></td>
              <td class="actions">
                <button class="secondary" data-open-order="${order.id}">Ver</button>
                ${canManage() ? `<button class="secondary" data-edit-order="${order.id}">Editar</button>` : ""}
              </td>
            </tr>
          `).join("") || `<tr><td colspan="7" class="empty">Nenhuma ordem encontrada.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
  document.querySelectorAll("[data-open-order]").forEach((button) => button.addEventListener("click", () => openOrder(button.dataset.openOrder)));
  document.querySelectorAll("[data-edit-order]").forEach((button) => button.addEventListener("click", () => editOrder(button.dataset.editOrder)));
}

function statusPill(status) {
  const cls = status === "Cancelada" ? "danger" : status.includes("Aguardando") ? "warning" : status === "Concluída" ? "info" : "";
  return `<span class="pill ${cls}">${escapeHtml(status)}</span>`;
}

function selectHtml(id, options, placeholder, selected = "") {
  return `
    <select id="${id}">
      ${options.map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option || placeholder)}</option>`).join("")}
    </select>
  `;
}

function orderFormHtml(order = null) {
  const title = order ? `Editar OS ${order.id}` : "Nova ordem de serviço";
  const subtitle = order ? "Atualize dados, status, responsável e logística." : "Abra uma solicitação vinculada às tabelas importadas do AppSheet.";
  const unitOptions = isAdmin()
    ? state.units.filter((item) => item.active).map((item) => item.name)
    : [order?.unit || currentUserUnit()];
  const selectedUnit = order?.unit || currentUserUnit();
  const selectedArea = order?.area || "";
  const selectedNature = order?.nature || "";
  const selectedType = order?.activityType || "";
  const selectedDescription = order?.description || "";
  const selectedDetail = order?.detail || "";
  return `
    ${headerHtml(title, subtitle)}
    <form class="card section form-grid" id="order-form" data-id="${order?.id || ""}">
      <label>Área de solicitação
        ${selectField("area", unique(state.logistics.map((item) => item.area)), selectedArea, "Selecione a área")}
      </label>
      <label>Natureza da atividade
        ${selectField("nature", cascadeNatures(selectedArea), selectedNature, "Selecione a natureza")}
      </label>
      <label>Tipo de atividade
        ${selectField("activityType", cascadeTypes(selectedArea, selectedNature), selectedType, "Selecione o tipo")}
      </label>
      <label class="span-2">Descrição da atividade
        ${selectField("description", cascadeDescriptions(selectedArea, selectedNature, selectedType), selectedDescription, "Selecione a descrição")}
      </label>
      <label>Detalhamento da atividade
        ${selectField("detail", cascadeDetails(selectedArea, selectedNature, selectedType, selectedDescription), selectedDetail, "Selecione o detalhamento")}
      </label>
      <label>Estabelecimento
        ${selectField("unit", unitOptions, selectedUnit, "Selecione o estabelecimento", !isAdmin())}
      </label>
      <label>Status
        ${selectField("status", statuses, order?.status || "Aberta")}
      </label>
      <label>Responsável
        <input name="responsible" value="${escapeHtml(order?.responsible || "")}" placeholder="Nome do responsável" />
      </label>
      <label>Possui material?
        ${selectField("hasMaterial", ["Não informado", "Sim", "Não"], order?.hasMaterial || "Não informado")}
      </label>
      <label class="span-3">Observação
        <textarea name="observation" placeholder="Observações internas">${escapeHtml(order?.observation || "")}</textarea>
      </label>
      <label>Motorista
        ${selectField("driver", ["", ...state.drivers.filter((item) => item.active).map((item) => item.name)], order?.driver)}
      </label>
      <label>Veículo / placa
        ${selectField("vehicle", ["", ...state.vehicles.filter((item) => item.active).map((item) => item.plate)], order?.vehicle)}
      </label>
      <label>Rota
        ${selectField("route", ["", ...state.routes.filter((item) => item.active).map((item) => item.name)], order?.route)}
      </label>
      <label>Data do ocorrido
        <input name="occurredAt" type="datetime-local" value="${toInputDate(order?.occurredAt)}" />
      </label>
      <label>B.O / REDS
        <input name="policeReport" value="${escapeHtml(order?.policeReport || "")}" />
      </label>
      <label>Anexos
        <input name="attachments" value="${escapeHtml((order?.attachments || []).join(", "))}" placeholder="Nomes ou links separados por vírgula" />
      </label>
      <div class="span-3 actions">
        <button type="submit">${order ? "Salvar alterações" : "Criar ordem"}</button>
        <button type="button" class="secondary" data-cancel-form>Cancelar</button>
      </div>
    </form>
  `;
}

function selectField(name, options, selected = "", placeholder = "Não informado", disabled = false) {
  const values = unique([selected, ...options]);
  return `
    <select name="${name}" ${disabled ? "disabled" : ""}>
      <option value="">${escapeHtml(placeholder)}</option>
      ${values.filter(Boolean).map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
    </select>
    ${disabled ? `<input type="hidden" name="${name}" value="${escapeHtml(selected)}" />` : ""}
  `;
}

function logisticsMatches(item, area = "", nature = "", type = "", description = "") {
  return (!area || item.area === area)
    && (!nature || item.nature === nature)
    && (!type || item.type === type)
    && (!description || item.description === description);
}

function cascadeNatures(area) {
  return unique(state.logistics.filter((item) => logisticsMatches(item, area)).map((item) => item.nature));
}

function cascadeTypes(area, nature) {
  return unique(state.logistics.filter((item) => logisticsMatches(item, area, nature)).map((item) => item.type));
}

function cascadeDescriptions(area, nature, type) {
  return unique(state.logistics.filter((item) => logisticsMatches(item, area, nature, type)).map((item) => item.description));
}

function cascadeDetails(area, nature, type, description) {
  return unique(state.logistics.filter((item) => logisticsMatches(item, area, nature, type, description)).map((item) => item.detail));
}

function toInputDate(value) {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function bindViewEvents() {
  document.querySelectorAll("[data-open-order]").forEach((button) => button.addEventListener("click", () => openOrder(button.dataset.openOrder)));
  document.querySelectorAll("[data-edit-order]").forEach((button) => button.addEventListener("click", () => editOrder(button.dataset.editOrder)));
  document.querySelector("[data-go-new]")?.addEventListener("click", () => {
    currentView = "new-order";
    renderShell();
  });
  document.querySelector("#order-form")?.addEventListener("submit", saveOrder);
  document.querySelector("#order-form") && bindCascadeFields();
  document.querySelector("[data-cancel-form]")?.addEventListener("click", () => {
    currentView = "orders";
    renderShell();
  });
  ["#filter-search", "#filter-status", "#filter-area", "#filter-unit", "#filter-route"].forEach((selector) => {
    document.querySelector(selector)?.addEventListener("input", renderOrdersTable);
  });
  if (currentView === "orders") renderOrdersTable();
  if (["units", "logistics", "routes", "vehicles", "drivers"].includes(currentView)) bindCrudEvents();
  if (currentView === "users") bindUsersEvents();
}

function bindCascadeFields() {
  const form = document.querySelector("#order-form");
  const area = form.elements.area;
  const nature = form.elements.nature;
  const type = form.elements.activityType;
  const description = form.elements.description;
  const detail = form.elements.detail;

  area.addEventListener("change", () => {
    fillSelect(nature, cascadeNatures(area.value), "Selecione a natureza");
    fillSelect(type, [], "Selecione o tipo");
    fillSelect(description, [], "Selecione a descrição");
    fillSelect(detail, [], "Selecione o detalhamento");
  });

  nature.addEventListener("change", () => {
    fillSelect(type, cascadeTypes(area.value, nature.value), "Selecione o tipo");
    fillSelect(description, [], "Selecione a descrição");
    fillSelect(detail, [], "Selecione o detalhamento");
  });

  type.addEventListener("change", () => {
    const descriptions = cascadeDescriptions(area.value, nature.value, type.value);
    fillSelect(description, descriptions, "Selecione a descrição");
    fillSelect(detail, descriptions.length ? [] : cascadeDetails(area.value, nature.value, type.value, ""), "Selecione o detalhamento");
  });

  description.addEventListener("change", () => {
    fillSelect(detail, cascadeDetails(area.value, nature.value, type.value, description.value), "Selecione o detalhamento");
  });
}

function fillSelect(select, options, placeholder, selected = "") {
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${unique([selected, ...options]).filter(Boolean).map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}`;
}

function saveOrder(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const existingId = form.dataset.id;
  const previous = state.orders.find((order) => order.id === existingId);
  const vehicle = state.vehicles.find((item) => item.plate === data.vehicle);
  if (!data.area || !data.nature || !data.activityType) {
    alert("Selecione área, natureza e tipo da atividade.");
    return;
  }
  const payload = {
    unit: isAdmin() ? data.unit : (previous?.unit || currentUserUnit()),
    area: data.area,
    nature: data.nature,
    activityType: data.activityType,
    description: data.description,
    detail: data.detail,
    hasMaterial: data.hasMaterial,
    observation: data.observation,
    policeReport: data.policeReport,
    occurredAt: data.occurredAt ? new Date(data.occurredAt).toISOString() : "",
    responsible: data.responsible,
    driver: data.driver,
    vehicle: data.vehicle,
    vehicleModel: vehicle?.model || "",
    route: data.route,
    status: data.status,
    attachments: data.attachments.split(",").map((item) => item.trim()).filter(Boolean),
  };

  if (previous) {
    Object.assign(previous, payload);
    previous.history.unshift({
      id: makeId("HIS"),
      user: state.session.email,
      createdAt: new Date().toISOString(),
      text: "Ordem atualizada.",
    });
  } else {
    state.orders.unshift({
      id: makeId("OS"),
      rowId: makeId("ROW"),
      openedBy: state.session.email,
      openedAt: new Date().toISOString(),
      active: true,
      messages: [],
      history: [{ id: makeId("HIS"), user: state.session.email, createdAt: new Date().toISOString(), text: "Ordem aberta." }],
      ...payload,
    });
  }
  saveState();
  currentView = "orders";
  renderShell();
}

function openOrder(id) {
  drawerOrderId = id;
  const order = state.orders.find((item) => item.id === id);
  const route = state.routes.find((item) => item.name === order.route);
  const drawer = document.querySelector("#drawer");
  drawer.innerHTML = `
    <div class="scrim" data-close-drawer></div>
    <aside class="drawer-panel">
      <div class="drawer-head">
        <div>
          <h3>OS ${escapeHtml(order.id)}</h3>
          <p class="muted">${escapeHtml(order.unit)} · ${formatDate(order.openedAt)}</p>
        </div>
        <button class="secondary" data-close-drawer>Fechar</button>
      </div>
      <section class="grid">
        <div class="card section">
          <h3>Resumo</h3>
          <p>${statusPill(order.status)} <span class="muted">Aberta por ${escapeHtml(order.openedBy)}</span></p>
          <p><strong>${escapeHtml(order.area)}</strong> · ${escapeHtml(order.nature)} · ${escapeHtml(order.activityType)}</p>
          <p>${escapeHtml(order.description || order.detail || order.observation || "Sem descrição informada.")}</p>
        </div>
        <div class="card section">
          <h3>Logística</h3>
          <p><strong>Responsável:</strong> ${escapeHtml(order.responsible || "Não atribuído")}</p>
          <p><strong>Motorista:</strong> ${escapeHtml(order.driver || "Não informado")}</p>
          <p><strong>Veículo:</strong> ${escapeHtml(order.vehicle || "Não informado")} ${order.vehicleModel ? `· ${escapeHtml(order.vehicleModel)}` : ""}</p>
          <p><strong>Rota:</strong> ${escapeHtml(order.route || "Não informada")} ${route?.link ? `<a href="${escapeHtml(route.link)}" target="_blank" rel="noreferrer">Abrir mapa</a>` : ""}</p>
        </div>
        <div class="card section">
          <h3>Mensagens internas</h3>
          <form id="message-form" class="grid">
            <textarea name="message" placeholder="Registrar mensagem na OS"></textarea>
            <button type="submit">Adicionar mensagem</button>
          </form>
          <div class="timeline" style="margin-top:14px">
            ${order.messages.map((message) => timelineItem(message.user, message.createdAt, message.text)).join("") || `<p class="muted">Sem mensagens registradas.</p>`}
          </div>
        </div>
        <div class="card section">
          <h3>Histórico</h3>
          <div class="timeline">
            ${order.history.map((item) => timelineItem(item.user, item.createdAt, item.text)).join("")}
          </div>
        </div>
      </section>
    </aside>
  `;
  drawer.classList.add("open");
  drawer.querySelectorAll("[data-close-drawer]").forEach((item) => item.addEventListener("click", closeDrawer));
  drawer.querySelector("#message-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = new FormData(event.currentTarget).get("message").toString().trim();
    if (!text) return;
    order.messages.unshift({ id: makeId("MSG"), user: state.session.email, createdAt: new Date().toISOString(), text });
    order.history.unshift({ id: makeId("HIS"), user: state.session.email, createdAt: new Date().toISOString(), text: "Mensagem adicionada." });
    saveState();
    openOrder(order.id);
  });
}

function closeDrawer() {
  document.querySelector("#drawer").classList.remove("open");
  drawerOrderId = null;
  renderView();
}

function editOrder(id) {
  const order = state.orders.find((item) => item.id === id);
  currentView = "orders";
  document.querySelector("#view").innerHTML = orderFormHtml(order);
  bindViewEvents();
}

function timelineItem(user, createdAt, text) {
  return `<article><strong>${escapeHtml(user)}</strong><p>${escapeHtml(text)}</p><span class="muted">${formatDate(createdAt)}</span></article>`;
}

function crudHtml() {
  const configs = {
    units: { title: "Unidades", data: state.units, fields: [["type", "Tipo"], ["name", "Nome da unidade"], ["address", "Endereço"], ["latlong", "LATLONG"]] },
    logistics: { title: "Logística", data: state.logistics, fields: [["area", "Área"], ["nature", "Natureza"], ["type", "Tipo"], ["description", "Descrição"], ["detail", "Detalhamento"]] },
    routes: { title: "Rotas", data: state.routes, fields: [["routeId", "ID rota"], ["name", "Rota"], ["number", "Nº rota"], ["link", "Link"]] },
    vehicles: { title: "Veículos", data: state.vehicles, fields: [["plate", "Placa/ID"], ["model", "Modelo/tipo"], ["seats", "Passageiros"]] },
    drivers: { title: "Motoristas", data: state.drivers, fields: [["driverId", "ID"], ["name", "Nome do motorista"]] },
  };
  const config = configs[activeCrud];
  return `
    ${headerHtml(config.title, "Cadastros importados das planilhas do AppSheet, com exclusão lógica por ativo/inativo.")}
    <div class="crud-layout">
      <form class="card section grid" id="crud-form">
        <h3>Novo registro</h3>
        ${config.fields.map(([name, label]) => `<label>${label}<input name="${name}" /></label>`).join("")}
        <button type="submit" ${canEditCatalogs() ? "" : "disabled"}>Adicionar</button>
        ${canEditCatalogs() ? "" : `<p class="muted">Seu perfil tem acesso de consulta.</p>`}
      </form>
      <section>
        <div class="toolbar"><input class="wide" id="crud-search" placeholder="Buscar no cadastro" /></div>
        <div id="crud-table"></div>
      </section>
    </div>
  `;
}

function bindCrudEvents() {
  document.querySelector("#crud-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canEditCatalogs()) return;
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    state[activeCrud].unshift({ id: makeId("CAD"), active: true, ...values });
    saveState();
    renderCrudTable();
    event.currentTarget.reset();
  });
  document.querySelector("#crud-search")?.addEventListener("input", renderCrudTable);
  renderCrudTable();
}

function renderCrudTable() {
  const configs = {
    units: [["type", "Tipo"], ["name", "Nome"], ["address", "Endereço"], ["latlong", "LATLONG"]],
    logistics: [["area", "Área"], ["nature", "Natureza"], ["type", "Tipo"], ["description", "Descrição"], ["detail", "Detalhamento"]],
    routes: [["routeId", "ID"], ["name", "Rota"], ["number", "Nº"], ["link", "Link"]],
    vehicles: [["plate", "Placa/ID"], ["model", "Modelo"], ["seats", "Passageiros"]],
    drivers: [["driverId", "ID"], ["name", "Nome"]],
  };
  const fields = configs[activeCrud];
  const search = document.querySelector("#crud-search")?.value.toLowerCase() || "";
  const rows = state[activeCrud].filter((item) => JSON.stringify(item).toLowerCase().includes(search));
  document.querySelector("#crud-table").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr>${fields.map(([, label]) => `<th>${label}</th>`).join("")}<th>Situação</th><th>Ações</th></tr></thead>
        <tbody>
          ${rows.map((item) => `
            <tr>
              ${fields.map(([key]) => `<td>${key === "link" && item[key] ? `<a href="${escapeHtml(item[key])}" target="_blank" rel="noreferrer">Abrir link</a>` : escapeHtml(item[key] || "")}</td>`).join("")}
              <td>${item.active ? `<span class="pill">Ativo</span>` : `<span class="pill danger">Inativo</span>`}</td>
              <td>${canEditCatalogs() ? `<button class="secondary" data-toggle-active="${item.id}">${item.active ? "Inativar" : "Ativar"}</button>` : "Consulta"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  document.querySelectorAll("[data-toggle-active]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = state[activeCrud].find((entry) => entry.id === button.dataset.toggleActive);
      item.active = !item.active;
      saveState();
      renderCrudTable();
    });
  });
}

function usersHtml() {
  return `
    ${headerHtml("Usuários", "Cada usuário pertence a um único estabelecimento. Apenas administradores podem alterar esse vínculo.")}
    <section class="card section">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Estabelecimento vinculado</th></tr></thead>
          <tbody>
            ${state.users.map((user) => `
              <tr>
                <td>${escapeHtml(user.name)}</td>
                <td>${escapeHtml(user.email)}</td>
                <td>${escapeHtml(user.role)}</td>
                <td>
                  ${isAdmin()
                    ? selectField(`user-unit-${user.id}`, state.units.filter((item) => item.active).map((item) => item.name), user.unit, "Selecione o estabelecimento")
                    : escapeHtml(user.unit || "Sem estabelecimento")}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function bindUsersEvents() {
  if (!isAdmin()) return;
  state.users.forEach((user) => {
    document.querySelector(`[name="user-unit-${user.id}"]`)?.addEventListener("change", (event) => {
      user.unit = event.currentTarget.value;
      if (state.session.id === user.id) state.session.unit = user.unit;
      saveState();
      renderShell();
    });
  });
}

function docsHtml() {
  return `
    ${headerHtml("Documentação", "Resumo técnico produzido a partir da estrutura AppSheet importada.")}
    <article class="card section doc">
      <h3>Análise das tabelas</h3>
      <p><code>ABERTURA_OS</code> é a tabela transacional principal. <code>LOGISTICA</code>, <code>UNIDADES</code>, <code>ROTAS</code>, <code>VEICULOS</code> e <code>MOTORISTAS</code> funcionam como cadastros de apoio e listas dependentes para abertura e acompanhamento das ordens.</p>
      <h3>Modelo entidade-relacionamento</h3>
      <p><code>users</code> possui <code>roles</code>. <code>work_orders</code> referencia <code>users</code>, <code>units</code>, <code>logistics_categories</code>, <code>routes</code>, <code>vehicles</code> e <code>drivers</code>. Cada OS possui muitos <code>work_order_messages</code>, <code>work_order_history</code> e <code>attachments</code>.</p>
      <h3>Requisitos funcionais</h3>
      <p>Login por perfil, abertura de OS, filtros avançados, alteração de status, histórico, mensagens internas, cadastros de unidades, logística, rotas, veículos e motoristas, além de painel administrativo com indicadores.</p>
      <h3>Requisitos não funcionais</h3>
      <p>Interface responsiva, validação de formulários, separação entre dados e tela, trilha de auditoria, exclusão lógica, labels em português e estrutura preparada para migração futura para API REST com PostgreSQL.</p>
      <h3>Arquitetura recomendada para produção</h3>
      <p>Frontend React ou Next.js, backend Node.js com NestJS ou Express, autenticação JWT, PostgreSQL, Prisma, armazenamento seguro para anexos e migrations versionadas.</p>
      <h3>Estrutura deste protótipo</h3>
      <p><code>index.html</code> carrega a aplicação, <code>styles.css</code> define a interface, <code>app.js</code> controla regras e telas, <code>assets/seed-data.js</code> contém os dados importados das planilhas e <code>source-data</code> mantém os arquivos originais extraídos.</p>
    </article>
  `;
}

render();
