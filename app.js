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
  { id: "u-tecnico", name: "Responsável Técnico", email: "tecnico@dirlogistica.local", password: "admin123", role: "Responsável", unit: "" },
  { id: "u-gestor", name: "Gestor Consulta", email: "gestor@dirlogistica.local", password: "admin123", role: "Gestor/Consulta", unit: "" },
];

const defaultAreaResponsibles = {
  DETIC: "tecnico@dirlogistica.local",
  "ALIMENTAÇÃO ESCOLAR": "tecnico@dirlogistica.local",
};

const roles = ["Administrador", "Solicitante", "Responsável", "Gestor/Consulta"];

const profileRules = {
  Administrador: {
    label: "Administrador",
    description: "Visualiza e altera todos os dados do sistema.",
    canOpenOrders: true,
    canViewAllOrders: true,
    canEditAllOrders: true,
    canChangeStatus: true,
    canManageCatalogs: true,
    canManageUsers: true,
  },
  Solicitante: {
    label: "Solicitante",
    description: "Abre novas OS e visualiza somente as OS abertas por ele e seus chats.",
    canOpenOrders: true,
    canViewOwnOrders: true,
  },
  Responsável: {
    label: "Responsável",
    description: "Visualiza somente OS destinadas a ele, participa do chat e altera status.",
    canViewAssignedOrders: true,
    canChangeAssignedStatus: true,
  },
  "Gestor/Consulta": {
    label: "Gestor/Consulta",
    description: "Visualiza todas as OS e cadastros, sem alterar dados.",
    canViewAllOrders: true,
  },
};

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
let editingCatalogId = null;
let editingUserId = null;

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return normalizeState(JSON.parse(stored));

  const seed = window.DIRLOGISTICA_SEED || {};
  const initial = {
    dataVersion: DATA_VERSION,
    session: null,
    users: demoUsers,
    areaResponsibles: { ...defaultAreaResponsibles },
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
      attachments: normalizeAttachments(compact([row.ANEXOS, row.FOTO, row.DOCUMENTOS])),
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
  next.areaResponsibles = { ...defaultAreaResponsibles, ...(next.areaResponsibles || {}) };
  next.users = (next.users || demoUsers).filter((user) => user.role !== "Logística").map((user) => ({
    ...user,
    role: normalizeRole(user.role),
    unit: user.unit || "",
    photo: user.photo || "",
    active: user.active !== false,
  }));
  Object.keys(next.areaResponsibles).forEach((area) => {
    const email = next.areaResponsibles[area];
    const user = next.users.find((item) => item.email === email && item.active !== false);
    if (!user) next.areaResponsibles[area] = defaultAreaResponsibles[area] || "tecnico@dirlogistica.local";
  });
  next.logistics = (next.logistics || []).map((item) => ({
    ...item,
    description: item.description || "",
  }));
  next.orders = (next.orders || []).map((order) => ({
    ...order,
    attachments: normalizeAttachments(order.attachments),
  }));
  if (next.session) {
    const sessionUser = next.users.find((user) => user.id === next.session.id && user.active !== false);
    next.session = sessionUser
      ? { id: sessionUser.id, name: sessionUser.name, email: sessionUser.email, role: sessionUser.role, unit: sessionUser.unit, photo: sessionUser.photo || "" }
      : null;
  }
  assignDefaultUserUnits(next);
  saveState(next);
  return next;
}

function normalizeRole(role) {
  if (role === "Responsável/Técnico") return "Responsável";
  if (role === "Logística") return "Gestor/Consulta";
  return roles.includes(role) ? role : "Solicitante";
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
  return Boolean(profileRules[state.session?.role]?.canEditAllOrders);
}

function canEditCatalogs() {
  return Boolean(profileRules[state.session?.role]?.canManageCatalogs);
}

function isAdmin() {
  return state.session?.role === "Administrador";
}

function isManager() {
  return state.session?.role === "Gestor/Consulta";
}

function canOpenOrders() {
  return Boolean(profileRules[state.session?.role]?.canOpenOrders);
}

function canViewCatalogs() {
  return isAdmin() || isManager();
}

function visibleNavItems() {
  return navItems.filter(([id]) => {
    if (id === "new-order") return canOpenOrders();
    if (id === "users") return isAdmin();
    if (["units", "logistics", "routes", "vehicles", "drivers"].includes(id)) return canViewCatalogs();
    return true;
  });
}

function currentUser() {
  return state.users.find((user) => user.id === state.session?.id) || state.session;
}

function currentUserUnit() {
  return currentUser()?.unit || "";
}

function responsibleUserForArea(area) {
  const email = state.areaResponsibles?.[area] || "";
  return state.users.find((user) => user.email === email && user.active !== false) || null;
}

function responsibleNameForArea(area) {
  const user = responsibleUserForArea(area);
  return user ? user.name : "";
}

function canChangeStatus(order = null) {
  if (isAdmin()) return true;
  const responsible = order?.responsible || responsibleNameForArea(order?.area || "");
  const user = currentUser();
  return state.session?.role === "Responsável" && Boolean(responsible && user && (responsible === user.name || responsible === user.email));
}

function canViewOrder(order) {
  if (!order?.active) return false;
  if (profileRules[state.session?.role]?.canViewAllOrders) return true;
  if (state.session?.role === "Solicitante") return order.openedBy === state.session.email;
  if (state.session?.role === "Responsável") return isOrderAssignedToCurrentUser(order);
  return false;
}

function isOrderAssignedToCurrentUser(order) {
  const user = currentUser();
  return Boolean(user && (order.responsible === user.name || order.responsible === user.email));
}

function canEditOrder(order) {
  return isAdmin() || canChangeStatus(order);
}

function canUseOrderChat(order) {
  return isAdmin() || isManager() || order.openedBy === state.session?.email || isOrderAssignedToCurrentUser(order);
}

function canPostOrderMessage(order) {
  return isAdmin() || order.openedBy === state.session?.email || isOrderAssignedToCurrentUser(order);
}

function visibleOrders() {
  return state.orders.filter(canViewOrder);
}

function normalizeAttachments(value) {
  return (value || []).map((item) => typeof item === "string" ? { id: makeId("ATT"), name: item, source: "importado" } : item);
}

function avatarHtml(user, size = "") {
  const cls = `avatar ${size}`.trim();
  if (user?.photo) return `<img class="${cls}" src="${escapeHtml(user.photo)}" alt="Foto de ${escapeHtml(user.name || "usuário")}" />`;
  return `<span class="${cls}">${escapeHtml(initials(user?.name || user?.email || "U"))}</span>`;
}

function initials(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
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
    const user = state.users.find((item) => item.email === email && item.password === password && item.active !== false);
    if (!user) return alert("E-mail ou senha inválidos.");
    state.session = { id: user.id, name: user.name, email: user.email, role: user.role, unit: user.unit, photo: user.photo || "" };
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
          ${avatarHtml(currentUser(), "small")}
          <strong>${escapeHtml(state.session.name)}</strong>
          <span>${escapeHtml(state.session.role)}</span>
          <span>${escapeHtml(currentUserUnit() || "Sem estabelecimento")}</span>
        </div>
        <nav class="nav">
          ${visibleNavItems().map(([id, label]) => `<button class="${id === currentView ? "active" : ""}" data-nav="${id}">${label}</button>`).join("")}
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
  if (!visibleNavItems().some(([id]) => id === currentView) && !["catalog-form", "user-form"].includes(currentView)) {
    currentView = "dashboard";
  }
  const view = document.querySelector("#view");
  if (currentView === "dashboard") view.innerHTML = dashboardHtml();
  if (currentView === "orders") view.innerHTML = ordersHtml();
  if (currentView === "new-order") view.innerHTML = orderFormHtml();
  if (["units", "logistics", "routes", "vehicles", "drivers"].includes(currentView)) {
    activeCrud = currentView;
    view.innerHTML = crudHtml();
  }
  if (currentView === "catalog-form") view.innerHTML = catalogFormHtml();
  if (currentView === "users") view.innerHTML = usersHtml();
  if (currentView === "user-form") view.innerHTML = userFormHtml();
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
  const activeOrders = visibleOrders();
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
    ${headerHtml("Ordens de serviço", "Acompanhe as ordens permitidas para o seu perfil.", canOpenOrders() ? `<button data-go-new>Nova OS</button>` : "")}
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
  const orders = visibleOrders().filter((order) => {
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
                ${canEditOrder(order) ? `<button class="secondary" data-edit-order="${order.id}">${isAdmin() ? "Editar" : "Status"}</button>` : ""}
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
  const detailsEditable = !order || isAdmin();
  const unitOptions = isAdmin()
    ? state.units.filter((item) => item.active).map((item) => item.name)
    : [order?.unit || currentUserUnit()];
  const selectedUnit = order?.unit || currentUserUnit();
  const selectedArea = order?.area || "";
  const selectedNature = order?.nature || "";
  const selectedType = order?.activityType || "";
  const selectedDescription = order?.description || "";
  const selectedDetail = order?.detail || "";
  const selectedResponsible = order?.responsible || responsibleNameForArea(selectedArea);
  const statusEditable = canChangeStatus(order || { area: selectedArea, responsible: selectedResponsible });
  return `
    ${headerHtml(title, subtitle)}
    <form class="card section form-grid" id="order-form" data-id="${order?.id || ""}">
      <label>Área de solicitação
        ${selectField("area", unique(state.logistics.map((item) => item.area)), selectedArea, "Selecione a área", !detailsEditable)}
      </label>
      <label>Natureza da atividade
        ${selectField("nature", cascadeNatures(selectedArea), selectedNature, "Selecione a natureza", !detailsEditable)}
      </label>
      <label>Tipo de atividade
        ${selectField("activityType", cascadeTypes(selectedArea, selectedNature), selectedType, "Selecione o tipo", !detailsEditable)}
      </label>
      <label class="span-2">Descrição da atividade
        ${selectField("description", cascadeDescriptions(selectedArea, selectedNature, selectedType), selectedDescription, "Selecione a descrição", !detailsEditable)}
      </label>
      <label>Detalhamento da atividade
        ${selectField("detail", cascadeDetails(selectedArea, selectedNature, selectedType, selectedDescription), selectedDetail, "Selecione o detalhamento", !detailsEditable)}
      </label>
      <label>Estabelecimento
        ${selectField("unit", unitOptions, selectedUnit, "Selecione o estabelecimento", !isAdmin())}
      </label>
      <label>Status
        ${selectField("status", statuses, order?.status || "Aberta", "Selecione o status", !statusEditable)}
      </label>
      <label>Responsável
        <input name="responsible" value="${escapeHtml(selectedResponsible)}" placeholder="Definido pela área de solicitação" readonly />
      </label>
      <label>Possui material?
        ${selectField("hasMaterial", ["Não informado", "Sim", "Não"], order?.hasMaterial || "Não informado", "Não informado", !detailsEditable)}
      </label>
      <label class="span-3">Observação
        <textarea name="observation" placeholder="Observações internas" ${detailsEditable ? "" : "readonly"}>${escapeHtml(order?.observation || "")}</textarea>
      </label>
      <label>Motorista
        ${selectField("driver", ["", ...state.drivers.filter((item) => item.active).map((item) => item.name)], order?.driver, "Não informado", !detailsEditable)}
      </label>
      <label>Veículo / placa
        ${selectField("vehicle", ["", ...state.vehicles.filter((item) => item.active).map((item) => item.plate)], order?.vehicle, "Não informado", !detailsEditable)}
      </label>
      <label>Rota
        ${selectField("route", ["", ...state.routes.filter((item) => item.active).map((item) => item.name)], order?.route, "Não informado", !detailsEditable)}
      </label>
      <label>Data do ocorrido
        <input name="occurredAt" type="datetime-local" value="${toInputDate(order?.occurredAt)}" ${detailsEditable ? "" : "readonly"} />
      </label>
      <label>B.O / REDS
        <input name="policeReport" value="${escapeHtml(order?.policeReport || "")}" ${detailsEditable ? "" : "readonly"} />
      </label>
      <label>Anexos
        <input name="attachments" type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.ppt,.pptx" ${detailsEditable ? "" : "disabled"} />
        ${attachmentsPreview(order?.attachments)}
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

function attachmentsPreview(attachments = []) {
  const normalized = normalizeAttachments(attachments);
  if (!normalized.length) return `<span class="muted">Nenhum arquivo anexado.</span>`;
  return `
    <div class="attachment-list">
      ${normalized.map((file) => `<span class="pill info">${escapeHtml(file.name || file.source || "Arquivo")}</span>`).join("")}
    </div>
  `;
}

function attachmentsListHtml(attachments = []) {
  const normalized = normalizeAttachments(attachments);
  if (!normalized.length) return `<p class="muted">Nenhum arquivo anexado.</p>`;
  return `
    <div class="grid">
      ${normalized.map((file) => `
        <article class="attachment-item">
          <strong>${escapeHtml(file.name || "Arquivo")}</strong>
          <span class="muted">${file.size ? formatFileSize(file.size) : escapeHtml(file.source || "anexo")}</span>
          ${file.dataUrl ? `<a href="${escapeHtml(file.dataUrl)}" download="${escapeHtml(file.name || "arquivo")}">Baixar</a>` : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function areaKey(area) {
  return encodeURIComponent(area);
}

function responsibleOptions() {
  return state.users.filter((user) => user.active !== false && user.role === "Responsável").map((user) => user.email);
}

async function filesToAttachments(files) {
  const validFiles = files.filter((file) => file && file.name && file.size > 0);
  return Promise.all(validFiles.map(async (file) => ({
    id: makeId("ATT"),
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: state.session.email,
    dataUrl: file.size <= 900000 ? await readFileAsDataUrl(file) : "",
  })));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
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
    if (!canOpenOrders()) return;
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
  if (currentView === "catalog-form") bindCatalogFormEvents();
  if (currentView === "users") bindUsersEvents();
  if (currentView === "user-form") bindUserFormEvents();
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
    updateResponsibleAndStatus(form);
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

function updateResponsibleAndStatus(form) {
  const responsible = form.elements.responsible;
  const status = form.elements.status;
  const order = state.orders.find((item) => item.id === form.dataset.id);
  const nextResponsible = responsibleNameForArea(form.elements.area.value);
  responsible.value = nextResponsible;
  const mayChange = canChangeStatus(order || { area: form.elements.area.value, responsible: nextResponsible });
  status.disabled = !mayChange;
}

function fillSelect(select, options, placeholder, selected = "") {
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${unique([selected, ...options]).filter(Boolean).map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}`;
}

async function saveOrder(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  const existingId = form.dataset.id;
  const previous = state.orders.find((order) => order.id === existingId);
  if (!previous && !canOpenOrders()) {
    alert("Seu perfil não tem permissão para abrir novas OS.");
    return;
  }
  if (previous && !canEditOrder(previous)) {
    alert("Seu perfil não tem permissão para alterar esta OS.");
    return;
  }
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
    responsible: responsibleNameForArea(data.area) || data.responsible,
    driver: data.driver,
    vehicle: data.vehicle,
    vehicleModel: vehicle?.model || "",
    route: data.route,
    status: canChangeStatus(previous || { area: data.area, responsible: responsibleNameForArea(data.area) }) ? data.status : (previous?.status || "Aberta"),
    attachments: [...normalizeAttachments(previous?.attachments), ...(await filesToAttachments(formData.getAll("attachments")))],
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
  if (!order || !canViewOrder(order)) {
    alert("Seu perfil não tem permissão para visualizar esta OS.");
    return;
  }
  const route = state.routes.find((item) => item.name === order.route);
  const canChat = canUseOrderChat(order);
  const canPostMessage = canPostOrderMessage(order);
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
          <h3>Anexos</h3>
          ${attachmentsListHtml(order.attachments)}
        </div>
        <div class="card section">
          <h3>Mensagens internas</h3>
          ${canPostMessage ? `
            <form id="message-form" class="grid">
              <textarea name="message" placeholder="Registrar mensagem na OS"></textarea>
              <button type="submit">Adicionar mensagem</button>
            </form>
          ` : `<p class="muted">${canChat ? "Seu perfil visualiza este chat, mas não pode adicionar mensagens." : "Chat restrito ao solicitante, responsável e administrador."}</p>`}
          <div class="timeline" style="margin-top:14px">
            ${canChat ? (order.messages.map((message) => timelineItem(message.user, message.createdAt, message.text)).join("") || `<p class="muted">Sem mensagens registradas.</p>`) : ""}
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
  drawer.querySelector("#message-form")?.addEventListener("submit", (event) => {
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
  if (!order || !canEditOrder(order)) {
    alert("Seu perfil não tem permissão para alterar esta OS.");
    return;
  }
  currentView = "orders";
  document.querySelector("#view").innerHTML = orderFormHtml(order);
  bindViewEvents();
}

function timelineItem(user, createdAt, text) {
  return `<article><strong>${escapeHtml(user)}</strong><p>${escapeHtml(text)}</p><span class="muted">${formatDate(createdAt)}</span></article>`;
}

function catalogConfigs() {
  return {
    units: { title: "Unidades", data: state.units, fields: [["type", "Tipo"], ["name", "Nome da unidade"], ["address", "Endereço"], ["latlong", "LATLONG"]] },
    logistics: { title: "Logística", data: state.logistics, fields: [["area", "Área"], ["nature", "Natureza"], ["type", "Tipo"], ["description", "Descrição"], ["detail", "Detalhamento"]] },
    routes: { title: "Rotas", data: state.routes, fields: [["routeId", "ID rota"], ["name", "Rota"], ["number", "Nº rota"], ["link", "Link"]] },
    vehicles: { title: "Veículos", data: state.vehicles, fields: [["plate", "Placa/ID"], ["model", "Modelo/tipo"], ["seats", "Passageiros"]] },
    drivers: { title: "Motoristas", data: state.drivers, fields: [["driverId", "ID"], ["name", "Nome do motorista"]] },
  };
}

function crudHtml() {
  const configs = catalogConfigs();
  const config = configs[activeCrud];
  return `
    ${headerHtml(config.title, "Cadastros importados das planilhas do AppSheet, com exclusão lógica por ativo/inativo.", canEditCatalogs() ? `<button data-new-catalog>Novo registro</button>` : "")}
    <section>
      <div class="toolbar"><input class="wide" id="crud-search" placeholder="Buscar no cadastro" /></div>
      <div id="crud-table"></div>
    </section>
  `;
}

function bindCrudEvents() {
  document.querySelector("[data-new-catalog]")?.addEventListener("click", () => {
    editingCatalogId = null;
    currentView = "catalog-form";
    renderShell();
  });
  document.querySelector("#crud-search")?.addEventListener("input", renderCrudTable);
  renderCrudTable();
}

function renderCrudTable() {
  const fields = catalogConfigs()[activeCrud].fields;
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
              <td class="actions">${canEditCatalogs() ? `<button class="secondary" data-edit-catalog="${item.id}">Editar</button><button class="secondary" data-toggle-active="${item.id}">${item.active ? "Inativar" : "Ativar"}</button>` : "Consulta"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  document.querySelectorAll("[data-edit-catalog]").forEach((button) => {
    button.addEventListener("click", () => {
      editingCatalogId = button.dataset.editCatalog;
      currentView = "catalog-form";
      renderShell();
    });
  });
  document.querySelectorAll("[data-toggle-active]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = state[activeCrud].find((entry) => entry.id === button.dataset.toggleActive);
      item.active = !item.active;
      saveState();
      renderCrudTable();
    });
  });
}

function catalogFormHtml() {
  if (!canEditCatalogs()) {
    return `
      ${headerHtml("Cadastro", "Seu perfil não tem permissão para alterar cadastros.")}
      <section class="card section"><p class="muted">Acesso somente para administradores.</p></section>
    `;
  }
  const config = catalogConfigs()[activeCrud];
  const item = state[activeCrud].find((entry) => entry.id === editingCatalogId) || null;
  return `
    ${headerHtml(item ? `Editar ${config.title}` : `Novo registro em ${config.title}`, "Preencha os dados do cadastro em uma página dedicada.")}
    <form class="card section form-grid" id="catalog-form" data-id="${item?.id || ""}">
      ${config.fields.map(([name, label]) => `<label>${label}<input name="${name}" value="${escapeHtml(item?.[name] || "")}" /></label>`).join("")}
      <div class="span-3 actions">
        <button type="submit">${item ? "Salvar alterações" : "Adicionar registro"}</button>
        <button type="button" class="secondary" id="cancel-catalog-form">Cancelar</button>
      </div>
    </form>
  `;
}

function bindCatalogFormEvents() {
  document.querySelector("#catalog-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canEditCatalogs()) return;
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const existing = state[activeCrud].find((entry) => entry.id === event.currentTarget.dataset.id);
    if (existing) {
      Object.assign(existing, values);
    } else {
      state[activeCrud].unshift({ id: makeId("CAD"), active: true, ...values });
    }
    editingCatalogId = null;
    saveState();
    currentView = activeCrud;
    renderShell();
  });
  document.querySelector("#cancel-catalog-form")?.addEventListener("click", () => {
    editingCatalogId = null;
    currentView = activeCrud;
    renderShell();
  });
}

function usersHtml() {
  const areas = unique(state.logistics.map((item) => item.area));
  if (!isAdmin()) {
    return `
      ${headerHtml("Usuários", "Gestão disponível apenas para administradores.")}
      <section class="card section"><p class="muted">Seu perfil não tem permissão para modificar usuários.</p></section>
    `;
  }
  return `
    ${headerHtml("Usuários", "Adicione, exclua e modifique usuários em página própria.", `<button data-new-user>Novo usuário</button>`)}
    <section class="grid two-col">
      <div class="card section">
        <h3>Responsável por área de solicitação</h3>
        <div class="grid">
          ${areas.map((area) => `
            <label>${escapeHtml(area)}
              ${selectField(`area-responsible-${areaKey(area)}`, responsibleOptions(), state.areaResponsibles?.[area] || "", "Selecione o responsável")}
            </label>
          `).join("")}
        </div>
      </div>
      <div class="card section">
        <h3>Perfis de usuário</h3>
        <div class="grid">
          ${roles.map((role) => `
            <article class="attachment-item">
              <strong>${escapeHtml(profileRules[role].label)}</strong>
              <span class="muted">${escapeHtml(profileRules[role].description)}</span>
            </article>
          `).join("")}
        </div>
      </div>
    </section>
    <section class="card section" style="margin-top:16px">
      <h3>Usuários cadastrados</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Foto</th><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Estabelecimento</th><th>Situação</th><th>Ações</th></tr></thead>
            <tbody>
              ${state.users.map((user) => `
                <tr>
                  <td>${avatarHtml(user)}</td>
                  <td>${escapeHtml(user.name)}</td>
                  <td>${escapeHtml(user.email)}</td>
                  <td>${escapeHtml(user.role)}</td>
                  <td>${escapeHtml(user.unit || "Sem estabelecimento")}</td>
                  <td>${user.active !== false ? `<span class="pill">Ativo</span>` : `<span class="pill danger">Inativo</span>`}</td>
                  <td class="actions">
                    <button class="secondary" data-edit-user="${user.id}">Editar</button>
                    <button class="${user.active !== false ? "danger" : "secondary"}" data-toggle-user="${user.id}">${user.active !== false ? "Excluir" : "Reativar"}</button>
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
  document.querySelector("[data-new-user]")?.addEventListener("click", () => {
    editingUserId = null;
    currentView = "user-form";
    renderShell();
  });
  document.querySelectorAll("[data-edit-user]").forEach((button) => {
    button.addEventListener("click", () => {
      editingUserId = button.dataset.editUser;
      currentView = "user-form";
      renderShell();
    });
  });
  document.querySelectorAll("[data-toggle-user]").forEach((button) => {
    button.addEventListener("click", () => {
      const user = state.users.find((item) => item.id === button.dataset.toggleUser);
      if (!user) return;
      if (user.id === state.session.id && user.active !== false) {
        alert("Você não pode excluir o usuário que está logado.");
        return;
      }
      user.active = user.active === false;
      saveState();
      renderView();
    });
  });
  unique(state.logistics.map((item) => item.area)).forEach((area) => {
    document.querySelector(`[name="area-responsible-${areaKey(area)}"]`)?.addEventListener("change", (event) => {
      state.areaResponsibles[area] = event.currentTarget.value;
      saveState();
    });
  });
}

function userFormHtml() {
  if (!isAdmin()) {
    return `
      ${headerHtml("Usuários", "Gestão disponível apenas para administradores.")}
      <section class="card section"><p class="muted">Seu perfil não tem permissão para modificar usuários.</p></section>
    `;
  }
  const editingUser = state.users.find((user) => user.id === editingUserId) || null;
  return `
    ${headerHtml(editingUser ? "Editar usuário" : "Novo usuário", "Preencha nome, e-mail, perfil, estabelecimento e foto de perfil.")}
    <form class="card section form-grid" id="user-form" data-id="${editingUser?.id || ""}">
      <div class="span-3 user-photo-row">
        ${avatarHtml(editingUser, "large")}
        <label>Foto de perfil
          <input name="photo" type="file" accept="image/*" />
        </label>
      </div>
      <label>Nome
        <input name="name" value="${escapeHtml(editingUser?.name || "")}" required />
      </label>
      <label>E-mail
        <input name="email" type="email" value="${escapeHtml(editingUser?.email || "")}" required />
      </label>
      <label>Perfil
        ${selectField("role", roles, editingUser?.role || "Solicitante", "Selecione o perfil")}
      </label>
      <label class="span-2">Estabelecimento
        ${selectField("unit", state.units.filter((item) => item.active).map((item) => item.name), editingUser?.unit || "", "Selecione o estabelecimento")}
      </label>
      <div class="span-3 actions">
        <button type="submit">${editingUser ? "Salvar alterações" : "Adicionar usuário"}</button>
        <button type="button" class="secondary" id="cancel-user-edit">Cancelar</button>
      </div>
      <p class="span-3 muted">Novos usuários recebem a senha inicial <strong>admin123</strong>.</p>
    </form>
  `;
}

function bindUserFormEvents() {
  document.querySelector("#user-form")?.addEventListener("submit", saveUser);
  document.querySelector("#cancel-user-edit")?.addEventListener("click", () => {
    editingUserId = null;
    currentView = "users";
    renderShell();
  });
}

async function saveUser(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const id = form.dataset.id || makeId("USR");
  const existing = state.users.find((user) => user.id === id);
  const email = formData.get("email").toString().trim().toLowerCase();
  const duplicate = state.users.find((user) => user.email.toLowerCase() === email && user.id !== id);
  if (duplicate) {
    alert("Já existe um usuário com esse e-mail.");
    return;
  }

  const previousEmail = existing?.email;
  const photoFile = formData.get("photo");
  const photo = photoFile?.name ? await readFileAsDataUrl(photoFile) : existing?.photo || "";
  const payload = {
    id,
    name: formData.get("name").toString().trim(),
    email,
    role: formData.get("role").toString(),
    unit: formData.get("unit").toString(),
    photo,
    password: existing?.password || "admin123",
    active: existing?.active !== false,
  };

  if (existing) {
    Object.assign(existing, payload);
    if (previousEmail && previousEmail !== email) {
      Object.keys(state.areaResponsibles).forEach((area) => {
        if (state.areaResponsibles[area] === previousEmail) state.areaResponsibles[area] = email;
      });
    }
  } else {
    state.users.unshift(payload);
  }

  if (state.session.id === id) {
    state.session = { id: payload.id, name: payload.name, email: payload.email, role: payload.role, unit: payload.unit, photo: payload.photo };
  }

  editingUserId = null;
  saveState();
  currentView = "users";
  renderShell();
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
