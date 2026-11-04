/**
 * TRACE — UI Renderer & Interactive Screens (rev 2)
 *
 * Implements:
 *  - Top bar with real-time session projections.
 *  - Navigation between the 4 screens.
 *  - Screen 1: Remote Support (handshake, simulated connection, customer messages).
 *  - Screen 2: Customer Computer Environment (Workstation):
 *      - Live diagnostic tools (Overview, IP Configuration, Ping, DNS, VoIP, History).
 *      - Access Gate enforcement (Customer Authorization & Technical Privilege).
 *      - Real-time diagnostic state reaction (broken -> fixed).
 *      - Action logging and evidence gathering.
 *  - Screen 3: Exercise Review (rubric scoring, category breakdown, verification, timeline).
 */

import { esc } from "./tickets.js";
import { fnv1a } from "./session.js";
import { assessSession } from "./assess.js";

export function renderTopBar(topbarEl, sessionStore, ticket, currentScreen, onNavigate) {
  const p = sessionStore.projections;
  const wsPrivilege = p.privilege?.ws01 || "standard";
  const isHealthy = p.healthy;

  topbarEl.innerHTML = `
    <div class="logo" role="button" tabindex="0" id="btn-home">
      <div class="logo-mark">TR</div>
      <div>
        <div class="logo-name">TRACE</div>
        <div class="logo-desc">TECHNICAL SUPPORT LAB</div>
      </div>
    </div>
    <div class="topbar-meta">
      <span class="chip">INCIDENT: <b>${esc(ticket.id)}</b></span>
      <span class="chip stage">STAGE: <b>${currentScreen + 1} / 4</b></span>
      <span class="chip ${p.connection.connected ? "cyan" : "warn"}">
        SESSION: <b>${p.connection.connected ? esc(p.connection.connectionId || "ACTIVE") : "NOT CONNECTED"}</b>
      </span>
      <span class="chip ${wsPrivilege === "admin" ? "cyan" : ""}">
        ACCESS: <b>${wsPrivilege === "admin" ? "ELEVATED (ADMIN)" : "STANDARD USER"}</b>
      </span>
      <span class="chip ${isHealthy ? "ok" : "warn"}">
        NETWORK: <b>${isHealthy ? "OPERATIONAL" : "DEGRADED"}</b>
      </span>
    </div>
  `;

  topbarEl.querySelector("#btn-home")?.addEventListener("click", () => onNavigate(0));
}

export function renderNavBar(navEl, currentScreen, sessionStore, onNavigate) {
  const p = sessionStore.projections;
  const screens = [
    { id: 0, label: "1. Ticket Desk", unlocked: true },
    { id: 1, label: "2. Remote Support", unlocked: true },
    { id: 2, label: "3. Workstation", unlocked: p.connection.connected || currentScreen === 2 },
    { id: 3, label: "4. Review", unlocked: p.completion.finishCount > 0 || currentScreen === 3 }
  ];

  navEl.innerHTML = `
    <div class="nav-inner">
      ${screens.map(s => `
        <button class="nav-item ${currentScreen === s.id ? "active" : ""} ${!s.unlocked ? "locked" : ""}" data-screen="${s.id}">
          ${s.label}
        </button>
      `).join("")}
    </div>
  `;

  navEl.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const scr = Number(btn.getAttribute("data-screen"));
      if (btn.classList.contains("locked")) {
        sessionStore.dispatch({
          actor: "learner",
          type: "nav.blocked",
          params: { screen: scr },
          outcome: { status: "noop" }
        });
        return;
      }
      onNavigate(scr);
    });
  });
}

/**
 * Screen 1: Remote Support
 */
export function renderRemoteSupport(container, sessionStore, remoteProvider, onNavigate) {
  const p = sessionStore.projections;
  const isConnected = p.connection.connected;

  container.innerHTML = `
    <div class="stage-eyebrow">STAGE 2 OF 4 · REMOTE SUPPORT ACCESS</div>
    <div class="stage-title">Customer Remote Assistance</div>

    <div class="banner train">
      TRAINING SIMULATION — Connection is managed entirely in-browser. No external network access or real customer device is contacted.
    </div>

    <!-- Handshake & Connection Panel -->
    <div class="panel">
      <div class="panel-head">Session Connection &amp; Handshake</div>
      <div class="panel-body">
        <div class="term" id="remote-term">
          ${isConnected
            ? `<span class="p">trace&gt;</span> session established SIM-${esc(p.connection.connectionId)}<br>` +
              `<span class="p">trace&gt;</span> host: MCR-REC-WS01 (Reception workstation)<br>` +
              `<span class="p">trace&gt;</span> user: "Reception Support" · security tier: standard<br>` +
              `<span class="p">trace&gt;</span> status: <span class="loading-line" style="color:var(--green)">CONNECTED</span>`
            : `<span class="dim"># Remote session handshake awaiting connection.<br>` +
              `# Target device: MCR-REC-WS01 · user: Reception Support</span>`
          }
        </div>
        <div class="btn-row">
          ${isConnected ? `
            <button class="btn danger small" id="btn-end-session">End Remote Session</button>
            <button class="btn primary" id="btn-enter-ws">Enter Customer Workstation →</button>
          ` : `
            <button class="btn primary" id="btn-connect-session">Connect to Simulated Session</button>
          `}
        </div>
      </div>
    </div>

    <!-- Interactive Customer Messaging (when remote provider present) -->
    ${remoteProvider ? `
      <div class="panel">
        <div class="panel-head">Customer Communication Channel</div>
        <div class="panel-body">
          <div class="chat-thread" id="chat-thread">
            ${p.remote.messages.length === 0 ? `
              <div class="chat-msg system">
                <span class="dim">Connected to customer Reception Support. You may ask questions regarding symptoms, restarts, or request permission to change network settings.</span>
              </div>
            ` : p.remote.messages.map(m => `
              <div class="chat-msg ${m.actor === "learner" ? "outgoing" : "incoming"}">
                <div class="chat-sender">${m.actor === "learner" ? "You (Engineer)" : "Reception Support"}</div>
                <div class="chat-bubble">${esc(m.text)}</div>
              </div>
            `).join("")}
          </div>
          <div class="chat-input-bar">
            <input type="text" id="chat-input" class="chat-field" placeholder="Ask customer a question or request permission..." />
            <button class="btn small primary" id="chat-send">Send</button>
          </div>
          <div class="quick-prompts">
            <span class="dim" style="font-size:12px;">Suggested prompts:</span>
            <button class="btn-chip" data-msg="Have you restarted the phone or PC today?">"Did you restart?"</button>
            <button class="btn-chip" data-msg="Is the ethernet network cable plugged in securely?">"Is cable plugged in?"</button>
            <button class="btn-chip" data-msg="Do I have your authorization to change network settings on this workstation?">"Request permission to change settings"</button>
          </div>
        </div>
      </div>
    ` : ""}

    <div class="btn-row" style="margin-top: 16px;">
      <button class="btn" id="btn-back-ticket">← Back to Ticket</button>
      ${isConnected ? `<button class="btn primary" id="btn-go-ws">Proceed to Workstation →</button>` : ""}
    </div>
  `;

  // Bind connection actions
  container.querySelector("#btn-connect-session")?.addEventListener("click", () => {
    const term = container.querySelector("#remote-term");
    if (term) {
      term.innerHTML = `<span class="p">trace&gt;</span> negotiating session key ... OK<br>` +
                       `<span class="p">trace&gt;</span> validating training grant TR-8841 ... <span class="loading-line">CONNECTING...</span>`;
    }
    setTimeout(() => {
      const connId = sessionStore.idGen.next();
      sessionStore.dispatch({
        actor: "learner",
        type: "session.connect",
        params: { connectionId: connId }
      });
      if (remoteProvider) {
        remoteProvider.start().then(res => {
          sessionStore.dispatch({
            actor: "system",
            type: "remote.start",
            params: {}
          });
          if (res.opening) {
            sessionStore.dispatch({
              actor: "customer",
              type: "remote.message",
              params: { text: res.opening }
            });
          }
          renderRemoteSupport(container, sessionStore, remoteProvider, onNavigate);
        });
      } else {
        renderRemoteSupport(container, sessionStore, remoteProvider, onNavigate);
      }
    }, 700);
  });

  container.querySelector("#btn-end-session")?.addEventListener("click", () => {
    sessionStore.dispatch({
      actor: "learner",
      type: "session.end",
      params: {}
    });
    renderRemoteSupport(container, sessionStore, remoteProvider, onNavigate);
  });

  container.querySelector("#btn-enter-ws")?.addEventListener("click", () => onNavigate(2));
  container.querySelector("#btn-go-ws")?.addEventListener("click", () => onNavigate(2));
  container.querySelector("#btn-back-ticket")?.addEventListener("click", () => onNavigate(0));

  // Chat input
  const sendChat = async (text) => {
    if (!text || !remoteProvider) return;
    sessionStore.dispatch({
      actor: "learner",
      type: "remote.message",
      params: { text }
    });
    const resp = await remoteProvider.send(text);
    sessionStore.dispatch({
      actor: "customer",
      type: "remote.message",
      params: {
        text: resp.reply,
        responseId: resp.responseId,
        evidence: resp.evidence
      }
    });
    if (resp.grants && resp.grants.length > 0) {
      for (const gid of resp.grants) {
        sessionStore.dispatch({
          actor: "customer",
          type: "auth.grant",
          params: {
            authorizationId: gid,
            scope: "network-change",
            targets: ["ws01"],
            source: "remote"
          }
        });
      }
    }
    renderRemoteSupport(container, sessionStore, remoteProvider, onNavigate);
  };

  const inputEl = container.querySelector("#chat-input");
  container.querySelector("#chat-send")?.addEventListener("click", () => {
    const val = inputEl?.value.trim();
    if (val) {
      inputEl.value = "";
      sendChat(val);
    }
  });

  inputEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const val = inputEl.value.trim();
      if (val) {
        inputEl.value = "";
        sendChat(val);
      }
    }
  });

  container.querySelectorAll(".btn-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const msg = chip.getAttribute("data-msg");
      sendChat(msg);
    });
  });
}

/**
 * Screen 2: Workstation (Simulated Computer Environment)
 */
export function renderWorkstation(container, sessionStore, environmentEngine, onNavigate, activeToolId = "overview") {
  const p = sessionStore.projections;
  const isHealthy = p.healthy;
  const wsPrivilege = p.privilege?.ws01 || "standard";
  const latestFinding = p.findings?.[p.findings.length - 1];

  const tools = [
    { id: "overview", label: "Network Overview" },
    { id: "ipconfig", label: "IP Configuration" },
    { id: "ping", label: "Connectivity Tests" },
    { id: "dns", label: "DNS Lookup" },
    { id: "voip", label: "VoIP Service Status" },
    { id: "history", label: "Action History" }
  ];

  container.innerHTML = `
    <div class="stage-eyebrow">STAGE 3 OF 4 · DIAGNOSTIC WORKSPACE</div>
    <div class="stage-title">Customer Computer Environment</div>

    <!-- Node status bar -->
    <div class="ws-top">
      <span class="ws-name">MCR-REC-WS01</span>
      <span class="pill grey">User: Reception Support</span>
      <span class="pill ${wsPrivilege === "admin" ? "cyan" : "grey"}">
        ${wsPrivilege === "admin" ? "Elevated (Admin)" : "Standard User"}
      </span>
      <span class="pill cyan">Session: Connected</span>
      <span class="pill ${isHealthy ? "green" : "amber"}">
        Network: ${isHealthy ? "Operational" : "Degraded"}
      </span>
      ${latestFinding ? `
        <span class="pill cyan">Finding Logged: ${esc(latestFinding.hypothesisId)}</span>
      ` : ""}
    </div>

    <!-- Tool selection tabs -->
    <div class="tool-tabs" id="tool-tabs">
      ${tools.map(t => `
        <button class="btn small ${activeToolId === t.id ? "on" : ""}" data-tool="${t.id}">
          ${t.label}
        </button>
      `).join("")}
    </div>

    <!-- Active tool panel -->
    <div id="toolArea"></div>

    <!-- Live Configuration Change & Elevation Gate -->
    <div class="panel" style="margin-top: 16px;">
      <div class="panel-head">Network Configuration Control &amp; Authorization Gate</div>
      <div class="panel-body">
        <div class="config-grid">
          <div class="config-col">
            <label class="config-label">Ethernet Adapter IPv4 Mode:</label>
            <div class="config-select-row">
              <select id="sel-adapter-mode" class="input-select">
                <option value="dhcp" ${p.envState.nodes[0]?.interfaces[0]?.config?.mode === "dhcp" ? "selected" : ""}>DHCP (Obtain automatically - Recommended for site)</option>
                <option value="static" ${p.envState.nodes[0]?.interfaces[0]?.config?.mode === "static" ? "selected" : ""}>Static (Manual configuration - Currently 10.0.0.50)</option>
              </select>
              <button class="btn primary small" id="btn-apply-config">Apply Configuration</button>
            </div>
            <div class="small muted" style="margin-top: 6px;">
              Target: <code>ws01.eth0</code> · Action: <code>net.config.set</code>
            </div>
          </div>
          <div class="config-col">
            <label class="config-label">Security &amp; Elevation:</label>
            <div class="elevation-box">
              <div class="small" style="margin-bottom: 8px;">
                Customer authorization held: <strong>${p.authorizations.some(a => a.scope === "network-change") ? "YES (network-change)" : "NO"}</strong><br>
                Local technical privilege: <strong>${wsPrivilege.toUpperCase()}</strong>
              </div>
              ${wsPrivilege === "admin" ? `
                <span class="chip ok">✓ Technical privilege elevated to Administrator</span>
              ` : `
                <button class="btn small" id="btn-request-elevation">Request Elevation (simulated authorization)</button>
              `}
            </div>
          </div>
        </div>
        <div id="gate-feedback" style="margin-top: 10px;"></div>
      </div>
    </div>

    <!-- Investigation Finding / Hypothesis Selection -->
    <div class="panel">
      <div class="panel-head">Record Diagnostic Finding (Hypothesis)</div>
      <div class="panel-body">
        <div class="finding-row">
          <select id="sel-finding" class="input-select">
            <option value="">-- Select diagnosed root cause --</option>
            <option value="static-ip" ${latestFinding?.hypothesisId === "static-ip" ? "selected" : ""}>Incorrect static IP configuration (off-subnet)</option>
            <option value="dns-failure" ${latestFinding?.hypothesisId === "dns-failure" ? "selected" : ""}>DNS server failure</option>
            <option value="isp-outage" ${latestFinding?.hypothesisId === "isp-outage" ? "selected" : ""}>ISP / WAN outage</option>
            <option value="cabling-nic" ${latestFinding?.hypothesisId === "cabling-nic" ? "selected" : ""}>Physical cabling / NIC fault</option>
          </select>
          <button class="btn small" id="btn-record-finding">Record Finding</button>
        </div>
      </div>
    </div>

    <!-- Workflow navigation buttons -->
    <div class="btn-row" style="margin-top: 20px;">
      <button class="btn" id="btn-return-ticket">← Return to Ticket</button>
      <button class="btn primary" id="btn-finish-investigation">Finish Investigation &amp; Review →</button>
    </div>
  `;

  // Render the selected tool content
  const toolArea = container.querySelector("#toolArea");
  renderToolContent(toolArea, activeToolId, sessionStore, environmentEngine);

  // Tab switching
  container.querySelectorAll("#tool-tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      const tid = btn.getAttribute("data-tool");
      sessionStore.dispatch({
        actor: "learner",
        type: "tool.open",
        params: { tool: tid }
      });
      renderWorkstation(container, sessionStore, environmentEngine, onNavigate, tid);
    });
  });

  // Elevation request
  container.querySelector("#btn-request-elevation")?.addEventListener("click", () => {
    // Dispatch auth.request -> auth.grant -> priv.elevate (A-7 legacy compat)
    sessionStore.dispatch({
      actor: "learner",
      type: "auth.request",
      params: { scope: "network-change", target: "ws01" }
    });
    sessionStore.dispatch({
      actor: "system",
      type: "auth.grant",
      params: {
        authorizationId: "auth-network-change",
        scope: "network-change",
        targets: ["ws01"],
        source: "simulated"
      }
    });
    sessionStore.dispatch({
      actor: "learner",
      type: "priv.elevate",
      params: { target: "ws01", to: "admin" }
    });
    renderWorkstation(container, sessionStore, environmentEngine, onNavigate, activeToolId);
  });

  // Apply configuration
  container.querySelector("#btn-apply-config")?.addEventListener("click", () => {
    const mode = container.querySelector("#sel-adapter-mode").value;
    const feedbackEl = container.querySelector("#gate-feedback");

    const intent = {
      actor: "learner",
      type: "env.config.set",
      params: {
        action: "net.config.set",
        target: "ws01.eth0",
        set: { config: { mode } }
      }
    };

    const gateResult = environmentEngine.evaluateConfigAction(intent, sessionStore.projections);
    sessionStore.dispatch({
      ...intent,
      outcome: gateResult.outcome,
      changes: gateResult.changes
    });

    if (gateResult.outcome.status === "denied") {
      feedbackEl.innerHTML = `
        <div class="callout-error">
          <strong>Access Denied (${esc(gateResult.outcome.code)}):</strong> ${esc(gateResult.outcome.message)}
          <br><span class="small">Elevate privilege and obtain customer authorization before applying system configuration changes.</span>
        </div>
      `;
    } else {
      renderWorkstation(container, sessionStore, environmentEngine, onNavigate, activeToolId);
    }
  });

  // Finding record
  container.querySelector("#btn-record-finding")?.addEventListener("click", () => {
    const sel = container.querySelector("#sel-finding");
    if (!sel.value) return;
    sessionStore.dispatch({
      actor: "learner",
      type: "finding.record",
      params: { hypothesisId: sel.value }
    });
    renderWorkstation(container, sessionStore, environmentEngine, onNavigate, activeToolId);
  });

  // Navigation
  container.querySelector("#btn-return-ticket")?.addEventListener("click", () => onNavigate(0));
  container.querySelector("#btn-finish-investigation")?.addEventListener("click", () => {
    sessionStore.dispatch({
      actor: "learner",
      type: "investigation.finish",
      params: {}
    });
    onNavigate(3); // Screen 3: Review
  });
}

/**
 * Render individual tool panels
 */
function renderToolContent(container, toolId, sessionStore, environmentEngine) {
  const p = sessionStore.projections;
  const envState = p.envState;

  if (toolId === "overview") {
    const res = environmentEngine.runTool("overview", "overview", {}, envState);
    const d = res.data;
    container.innerHTML = `
      <div class="panel">
        <div class="panel-head">Adapter &amp; Service State</div>
        <div class="panel-body">
          <div class="stat-grid">
            <div class="stat">
              <div class="k">Ethernet Adapter</div>
              <div class="v ${d.link ? "good" : "err"}">Intel I219-LM · 1.0 Gbps · ${d.link ? "Link up" : "Link down"}</div>
            </div>
            <div class="stat">
              <div class="k">IPv4 Configuration</div>
              <div class="v ${d.bad ? "bad" : "good"}">${d.bad ? "Static (10.0.0.50) — unexpected for this site network" : "DHCP — 192.168.1.0/24 site network"}</div>
            </div>
            <div class="stat">
              <div class="k">Default Gateway</div>
              <div class="v ${d.gwReachable ? "good" : "err"}">${d.gwReachable ? "192.168.1.1 · reachable" : "Unreachable — no valid route"}</div>
            </div>
            <div class="stat">
              <div class="k">DNS Server</div>
              <div class="v ${d.dnsReachable ? "good" : "err"}">${d.dnsReachable ? "192.168.1.1 · responding" : "Unreachable — 10.0.0.5"}</div>
            </div>
            <div class="stat">
              <div class="k">Reception Desk Phone</div>
              <div class="v ${d.phoneReachable ? "good" : "bad"}">${d.phoneReachable ? "Reachable · 192.168.1.10" : "Unreachable · 192.168.1.10"}</div>
            </div>
            <div class="stat">
              <div class="k">VoIP Softphone Line</div>
              <div class="v ${d.sipState === "registered" ? "good" : "err"}">${d.sipState === "registered" ? "Registered · Line 204 Online" : "Unregistered · Request Timeout"}</div>
            </div>
          </div>
          <div class="small muted" style="margin-top:12px">
            Observed: ${d.bad ? "The adapter physical link is healthy, but the workstation holds an off-subnet static IP configuration that prevents communication with the site gateway, DNS, and PBX voice platform." : "All interface settings and network routes are operational. Softphone registration is active."}
          </div>
        </div>
      </div>
    `;
  } else if (toolId === "ipconfig") {
    container.innerHTML = `
      <div class="panel">
        <div class="panel-head">IP Configuration Command Console</div>
        <div class="panel-body">
          <div class="btn-row" style="margin-bottom: 12px;">
            <button class="btn small" id="btn-run-ipconfig">Run ipconfig</button>
            <button class="btn small" id="btn-run-ipconfig-all">Run ipconfig /all</button>
          </div>
          <div class="term" id="ipconfig-term"><span class="dim">Click 'Run ipconfig' or 'Run ipconfig /all' to inspect adapter settings...</span></div>
        </div>
      </div>
    `;
    const term = container.querySelector("#ipconfig-term");
    container.querySelector("#btn-run-ipconfig")?.addEventListener("click", () => {
      const res = environmentEngine.runTool("ipconfig", "ipconfig", {}, envState);
      sessionStore.dispatch({
        actor: "learner",
        type: "tool.run",
        params: { tool: "ipconfig", command: "ipconfig", probes: res.data?.probes || [] },
        outputDigest: fnv1a(res.text)
      });
      term.textContent = res.text;
    });
    container.querySelector("#btn-run-ipconfig-all")?.addEventListener("click", () => {
      const res = environmentEngine.runTool("ipconfig", "ipconfig-all", {}, envState);
      sessionStore.dispatch({
        actor: "learner",
        type: "tool.run",
        params: { tool: "ipconfig", command: "ipconfig-all", probes: res.data?.probes || [] },
        outputDigest: fnv1a(res.text)
      });
      term.textContent = res.text;
    });
  } else if (toolId === "ping") {
    container.innerHTML = `
      <div class="panel">
        <div class="panel-head">ICMP Connectivity Tests (Ping)</div>
        <div class="panel-body">
          <div class="btn-row" style="margin-bottom: 12px;">
            <button class="btn small" data-target="192.168.1.1">Ping Gateway (192.168.1.1)</button>
            <button class="btn small" data-target="192.168.1.10">Ping Desk Phone (192.168.1.10)</button>
            <button class="btn small" data-target="192.168.1.20">Ping Voice Platform (192.168.1.20)</button>
            <button class="btn small" data-target="8.8.8.8">Ping WAN / Internet (8.8.8.8)</button>
          </div>
          <div class="term" id="ping-term"><span class="dim">Select a target to execute ICMP echo test...</span></div>
        </div>
      </div>
    `;
    const term = container.querySelector("#ping-term");
    container.querySelectorAll("button[data-target]").forEach(b => {
      b.addEventListener("click", () => {
        const target = b.getAttribute("data-target");
        const res = environmentEngine.runTool("ping", "ping", { target }, envState);
        sessionStore.dispatch({
          actor: "learner",
          type: "tool.run",
          params: { tool: "ping", command: "ping", args: { target }, probes: res.data?.probes || [] },
          outputDigest: fnv1a(res.text)
        });
        term.textContent = res.text;
      });
    });
  } else if (toolId === "dns") {
    container.innerHTML = `
      <div class="panel">
        <div class="panel-head">DNS Name Resolution (nslookup)</div>
        <div class="panel-body">
          <div class="btn-row" style="margin-bottom: 12px;">
            <button class="btn small" data-name="sip.northstar-voice.test">Query sip.northstar-voice.test</button>
            <button class="btn small" data-name="voice.example.test">Query voice.example.test</button>
          </div>
          <div class="term" id="dns-term"><span class="dim">Click a domain name to execute nslookup...</span></div>
        </div>
      </div>
    `;
    const term = container.querySelector("#dns-term");
    container.querySelectorAll("button[data-name]").forEach(b => {
      b.addEventListener("click", () => {
        const name = b.getAttribute("data-name");
        const res = environmentEngine.runTool("dns", "nslookup", { name }, envState);
        sessionStore.dispatch({
          actor: "learner",
          type: "tool.run",
          params: { tool: "dns", command: "nslookup", args: { name }, probes: res.data?.probes || [] },
          outputDigest: fnv1a(res.text)
        });
        term.textContent = res.text;
      });
    });
  } else if (toolId === "voip") {
    container.innerHTML = `
      <div class="panel">
        <div class="panel-head">VoIP Softphone Service Diagnostic</div>
        <div class="panel-body">
          <div class="btn-row" style="margin-bottom: 12px;">
            <button class="btn small" id="btn-voip-check">Check Softphone Registration</button>
            <button class="btn small" id="btn-voip-restart">Restart Softphone Service</button>
          </div>
          <div class="term" id="voip-term"><span class="dim">Run VoIP diagnostics to evaluate SIP registration status...</span></div>
        </div>
      </div>
    `;
    const term = container.querySelector("#voip-term");
    container.querySelector("#btn-voip-check")?.addEventListener("click", () => {
      const res = environmentEngine.runTool("voip", "sip-register-check", {}, envState);
      sessionStore.dispatch({
        actor: "learner",
        type: "tool.run",
        params: { tool: "voip", command: "sip-register-check", probes: res.data?.probes || [] },
        outputDigest: fnv1a(res.text)
      });
      term.textContent = res.text;
    });
    container.querySelector("#btn-voip-restart")?.addEventListener("click", () => {
      const res = environmentEngine.runTool("voip", "sip-restart", {}, envState);
      sessionStore.dispatch({
        actor: "learner",
        type: "tool.run",
        params: { tool: "voip", command: "sip-restart", probes: res.data?.probes || [] },
        outputDigest: fnv1a(res.text)
      });
      term.textContent = res.text;
    });
  } else if (toolId === "history") {
    container.innerHTML = `
      <div class="panel">
        <div class="panel-head">Authoritative Append-Only Session Action Log (${sessionStore.actions.length} events)</div>
        <div class="panel-body">
          <div class="timeline-box">
            ${sessionStore.actions.map(a => `
              <div class="action-entry">
                <span class="action-seq">#${a.seq}</span>
                <span class="action-time">${esc(a.at?.split("T")[1]?.slice(0, 8) || "")}</span>
                <span class="action-actor actor-${esc(a.actor)}">${esc(a.actor)}</span>
                <span class="action-type"><code>${esc(a.type)}</code></span>
                <span class="action-status status-${esc(a.outcome?.status)}">${esc(a.outcome?.status)}</span>
                ${a.outcome?.code ? `<span class="action-code">${esc(a.outcome.code)}</span>` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Screen 3: Exercise Review
 */
export function renderReview(container, sessionStore, exerciseManifest, onRetry, onNavigate) {
  const result = assessSession(
    exerciseManifest.assessment,
    sessionStore.projections,
    exerciseManifest,
    sessionStore.actions
  );

  const outcomeTone = result.outcome === "resolved" ? "green" : result.outcome === "incomplete" ? "amber" : "red";

  container.innerHTML = `
    <div class="stage-eyebrow">STAGE 4 OF 4 · PERFORMANCE ASSESSMENT</div>
    <div class="stage-title">Exercise Review &amp; Evidence Evaluation</div>

    <!-- Outcome hero card -->
    <div class="review-hero">
      <div class="review-hero-left">
        <div class="review-status-badge badge--${outcomeTone}">
          ${esc(result.outcome.toUpperCase())}
        </div>
        <h2 class="review-title">
          ${result.outcome === "resolved"
            ? "Incident Successfully Resolved"
            : result.outcome === "incomplete"
            ? "Fix Applied — Verification Incomplete"
            : "Incident Unresolved"}
        </h2>
        <p class="review-summary">
          ${result.outcome === "resolved"
            ? "The off-subnet static IP configuration was diagnosed and DHCP was restored with proper elevation. All verification probes confirmed operational status."
            : "Review the evidence below to identify missing diagnostic steps or unverified services."}
        </p>
      </div>
      <div class="review-score-box">
        <div class="score-number">${result.score.points} / ${result.score.max}</div>
        <div class="score-percent">${result.score.percent}% Score</div>
      </div>
    </div>

    <!-- 6 Assessment Categories Breakdown -->
    <div class="panel">
      <div class="panel-head">Rubric Evaluation (Legacy-1 Standards)</div>
      <div class="panel-body">
        <div class="category-grid">
          ${result.categories.map(c => `
            <div class="cat-card">
              <div class="cat-head">
                <span class="cat-title">${esc(c.id.toUpperCase())}</span>
                <span class="cat-points">${c.points} / ${c.max} pts</span>
              </div>
              <p class="cat-exp">${esc(c.explanation)}</p>
            </div>
          `).join("")}
        </div>
      </div>
    </div>

    <!-- Verification Checklist & Action Classification -->
    <div class="grid2">
      <div class="panel">
        <div class="panel-head">Verification Probes</div>
        <div class="panel-body">
          <ul class="verification-list">
            ${result.verification.map(v => `
              <li class="v-item">
                <span class="v-status ${v.covered && v.passed ? "v-pass" : "v-fail"}">
                  ${v.covered && v.passed ? "PASS" : "MISSING"}
                </span>
                <span class="v-id"><code>${esc(v.checkId)}</code></span>
                <span class="v-desc">${v.covered ? "Observed while healthy" : "Not confirmed post-fix"}</span>
              </li>
            `).join("")}
          </ul>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">Action Classification Breakdown</div>
        <div class="panel-body">
          <div class="classification-chips">
            <span class="pill green">Helpful: ${result.classification.helpful}</span>
            <span class="pill amber">Inconclusive: ${result.classification.inconclusive}</span>
            <span class="pill red">Blocked: ${result.classification.blocked}</span>
            <span class="pill red">Incorrect: ${result.classification.incorrect}</span>
            <span class="pill grey">Unnecessary: ${result.classification.unnecessary}</span>
          </div>
          <div class="small muted" style="margin-top: 12px;">
            Assessment is calculated purely from the append-only action log.
          </div>
        </div>
      </div>
    </div>

    <!-- Actions & Reset -->
    <div class="btn-row" style="margin-top: 24px;">
      <button class="btn" id="btn-export-json">Export Session Log (JSON)</button>
      <button class="btn" id="btn-back-ws">Back to Workspace</button>
      <button class="btn primary" id="btn-retry-exercise">Retry Exercise (Reset Session)</button>
    </div>
  `;

  container.querySelector("#btn-export-json")?.addEventListener("click", () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(sessionStore.exportSession());
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `trace-session-${ticket.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  container.querySelector("#btn-back-ws")?.addEventListener("click", () => onNavigate(2));
  container.querySelector("#btn-retry-exercise")?.addEventListener("click", onRetry);
}
