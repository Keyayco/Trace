/**
 * TRACE — Networking Simulation Module (rev 2)
 *
 * Implements module boundaries per ARCHITECTURE §8 & §9:
 *  - Component types: workstation, router, switch, ip-phone, sip-registrar
 *  - Service types: dhcp, dns, sip-registrar, sip-registration
 *  - Derivation rules: linkUp, reach, resolve, serviceState
 *  - Tool runners: overview, ipconfig, ping, dns, voip
 *  - Action: net.config.set
 */

function parseCidr(ip, mask) {
  const ipParts = ip.split(".").map(Number);
  const maskParts = mask.split(".").map(Number);
  return ipParts.map((p, i) => p & maskParts[i]).join(".");
}

export function linkUp(env, ifaceId) {
  const link = (env.links || []).find(l => l.a === ifaceId || l.b === ifaceId);
  return link ? link.status === "up" : false;
}

export function getInterfaceConfig(env, ifaceId) {
  const [nodeId, ifName] = ifaceId.split(".");
  const node = (env.nodes || []).find(n => n.id === nodeId);
  if (!node) return null;
  const iface = (node.interfaces || []).find(i => i.id === ifaceId || i.id === ifName);
  if (!iface) return null;

  if (iface.config?.mode === "dhcp") {
    // Lookup DHCP service in environment
    const dhcpSrv = (env.services || []).find(s => s.type === "dhcp");
    if (dhcpSrv && dhcpSrv.config?.reservations?.[ifaceId]) {
      const reservedIp = dhcpSrv.config.reservations[ifaceId];
      return {
        mode: "dhcp",
        ip: reservedIp,
        mask: "255.255.255.0",
        gateway: dhcpSrv.config.gateway,
        dns: dhcpSrv.config.dns || ["192.168.1.1"]
      };
    }
    return {
      mode: "dhcp",
      ip: "192.168.1.105",
      mask: "255.255.255.0",
      gateway: "192.168.1.1",
      dns: ["192.168.1.1"]
    };
  }
  return iface.config || null;
}

export function reach(env, fromNodeId, toNodeId) {
  const fromNode = (env.nodes || []).find(n => n.id === fromNodeId);
  const toNode = (env.nodes || []).find(n => n.id === toNodeId);
  if (!fromNode || !toNode) return false;

  const fromIface = fromNode.interfaces?.[0];
  const toIface = toNode.interfaces?.[0];
  if (!fromIface || !toIface) return false;

  const fromCfg = getInterfaceConfig(env, fromIface.id);
  const toCfg = getInterfaceConfig(env, toIface.id);
  if (!fromCfg || !toCfg) return false;

  // Check link layer up
  if (!linkUp(env, fromIface.id) || !linkUp(env, toIface.id)) return false;

  // Same subnet check
  const fromSubnet = parseCidr(fromCfg.ip, fromCfg.mask || "255.255.255.0");
  const toSubnet = parseCidr(toCfg.ip, toCfg.mask || "255.255.255.0");

  if (fromSubnet === toSubnet) {
    return true;
  }

  // If different subnet, check default gateway reachability
  if (fromCfg.gateway) {
    const gwNode = (env.nodes || []).find(n => {
      const ifc = n.interfaces?.[0];
      return ifc && getInterfaceConfig(env, ifc.id)?.ip === fromCfg.gateway;
    });
    if (gwNode) {
      // Gateway exists and is in the same subnet
      const gwCfg = getInterfaceConfig(env, gwNode.interfaces[0].id);
      const gwSubnet = parseCidr(gwCfg.ip, gwCfg.mask || "255.255.255.0");
      if (fromSubnet === gwSubnet) {
        // Can route to destination
        return true;
      }
    }
  }

  return false;
}

export function resolve(env, fromNodeId, name, expectNodeId) {
  const fromNode = (env.nodes || []).find(n => n.id === fromNodeId);
  if (!fromNode) return false;
  const fromIface = fromNode.interfaces?.[0];
  if (!fromIface) return false;
  const fromCfg = getInterfaceConfig(env, fromIface.id);
  if (!fromCfg || !fromCfg.dns || fromCfg.dns.length === 0) return false;

  const primaryDns = fromCfg.dns[0];
  // Find which node hosts this DNS IP
  const dnsNode = (env.nodes || []).find(n => {
    const ifc = n.interfaces?.[0];
    return ifc && getInterfaceConfig(env, ifc.id)?.ip === primaryDns;
  });

  if (!dnsNode) return false; // DNS IP not hosted by any node in topology
  if (!reach(env, fromNodeId, dnsNode.id)) return false;

  // Find DNS service
  const dnsSrv = (env.services || []).find(s => s.type === "dns" && s.host?.node === dnsNode.id);
  if (!dnsSrv || !dnsSrv.config?.records) return false;

  const resolvedIp = dnsSrv.config.records[name];
  if (!resolvedIp) return false;

  if (expectNodeId) {
    const expectNode = (env.nodes || []).find(n => n.id === expectNodeId);
    if (!expectNode) return false;
    const expectCfg = getInterfaceConfig(env, expectNode.interfaces[0].id);
    return expectCfg && expectCfg.ip === resolvedIp;
  }
  return true;
}

export function serviceState(env, serviceId) {
  const srv = (env.services || []).find(s => s.id === serviceId);
  if (!srv) return "down";

  if (srv.type === "sip-registrar") {
    return "up";
  }

  if (srv.type === "sip-registration") {
    // Evaluate requirements
    for (const req of srv.requires || []) {
      if (req.check === "linkUp" && !linkUp(env, req.interface)) return "unregistered";
      if (req.check === "resolve" && !resolve(env, req.from, req.name, req.expectNode)) return "unregistered";
      if (req.check === "reach" && !reach(env, req.from, req.to)) return "unregistered";
      if (req.check === "serviceState") {
        if (serviceState(env, req.service) !== req.state) return "unregistered";
      }
    }
    return "registered";
  }

  return "up";
}

/**
 * Derives overall environment reachability and checks.
 */
export function deriveEnvironment(env) {
  const checks = {};
  const verifications = env.outcomes?.verification || [];

  for (const v of verifications) {
    if (v.check === "reach") {
      checks[v.id] = reach(env, v.from, v.to);
    } else if (v.check === "resolve") {
      checks[v.id] = resolve(env, v.from, v.name, v.expectNode);
    } else if (v.check === "serviceState") {
      checks[v.id] = serviceState(env, v.service) === v.state;
    }
  }

  const healthy = verifications.length > 0 && verifications.every(v => checks[v.id] === true);

  return {
    healthy,
    checks
  };
}

/**
 * Tool command runners returning { text, data: { probes: [] } }
 */
export const toolRunners = {
  overview(env) {
    const wsCfg = getInterfaceConfig(env, "ws01.eth0");
    const bad = wsCfg.mode === "static" && wsCfg.ip.startsWith("10.");
    const derived = deriveEnvironment(env);

    return {
      text: "Adapter and service overview refreshed.",
      data: {
        bad,
        link: linkUp(env, "ws01.eth0"),
        wsCfg,
        gwReachable: reach(env, "ws01", "gw01"),
        phoneReachable: reach(env, "ws01", "phone01"),
        dnsReachable: resolve(env, "ws01", "sip.northstar-voice.test", "pbx01"),
        sipState: serviceState(env, "sipreg-204"),
        healthy: derived.healthy
      }
    };
  },

  ipconfig(env) {
    const cfg = getInterfaceConfig(env, "ws01.eth0");
    const bad = cfg.mode === "static" && cfg.ip.startsWith("10.");

    if (bad) {
      return {
        text: `C:\\Users\\Reception> ipconfig

Windows IP Configuration

Ethernet adapter Ethernet0:

   Connection-specific DNS Suffix  . :
   IPv4 Address. . . . . . . . . . . : 10.0.0.50
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 10.0.0.1`,
        data: { probes: [{ check: "ipconfig", ip: "10.0.0.50", passed: false }] }
      };
    }

    return {
      text: `C:\\Users\\Reception> ipconfig

Windows IP Configuration

Ethernet adapter Ethernet0:

   Connection-specific DNS Suffix  . : local
   IPv4 Address. . . . . . . . . . . : 192.168.1.105
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 192.168.1.1`,
      data: { probes: [{ check: "ipconfig", ip: "192.168.1.105", passed: true }] }
    };
  },

  "ipconfig-all"(env) {
    const cfg = getInterfaceConfig(env, "ws01.eth0");
    const bad = cfg.mode === "static" && cfg.ip.startsWith("10.");

    if (bad) {
      return {
        text: `C:\\Users\\Reception> ipconfig /all

Windows IP Configuration

   Host Name . . . . . . . . . . . . : MCR-REC-WS01
   Primary Dns Suffix  . . . . . . . :
   Node Type . . . . . . . . . . . . : Hybrid
   IP Routing Enabled. . . . . . . . : No
   WINS Proxy Enabled. . . . . . . . : No

Ethernet adapter Ethernet0:

   Connection-specific DNS Suffix  . :
   Description . . . . . . . . . . . : Intel(R) Ethernet Connection I219-LM
   Physical Address. . . . . . . . . : 8C-16-45-2F-9B-71
   DHCP Enabled. . . . . . . . . . . : No
   Autoconfiguration Enabled . . . . : Yes
   IPv4 Address. . . . . . . . . . . : 10.0.0.50(Preferred)
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 10.0.0.1
   DNS Servers . . . . . . . . . . . : 10.0.0.5
   NetBIOS over Tcpip. . . . . . . . : Enabled`,
        data: { probes: [{ check: "ipconfig-all", mode: "static", passed: false }] }
      };
    }

    return {
      text: `C:\\Users\\Reception> ipconfig /all

Windows IP Configuration

   Host Name . . . . . . . . . . . . : MCR-REC-WS01
   Primary Dns Suffix  . . . . . . . : local
   Node Type . . . . . . . . . . . . : Hybrid
   IP Routing Enabled. . . . . . . . : No
   WINS Proxy Enabled. . . . . . . . : No

Ethernet adapter Ethernet0:

   Connection-specific DNS Suffix  . : local
   Description . . . . . . . . . . . : Intel(R) Ethernet Connection I219-LM
   Physical Address. . . . . . . . . : 8C-16-45-2F-9B-71
   DHCP Enabled. . . . . . . . . . . : Yes
   Autoconfiguration Enabled . . . . : Yes
   IPv4 Address. . . . . . . . . . . : 192.168.1.105(Preferred)
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Lease Obtained. . . . . . . . . . : Monday, October 19, 2026 09:41:00
   Lease Expires . . . . . . . . . . : Tuesday, October 20, 2026 09:41:00
   Default Gateway . . . . . . . . . : 192.168.1.1
   DHCP Server . . . . . . . . . . . : 192.168.1.1
   DNS Servers . . . . . . . . . . . : 192.168.1.1
   NetBIOS over Tcpip. . . . . . . . : Enabled`,
      data: { probes: [{ check: "ipconfig-all", mode: "dhcp", passed: true }] }
    };
  },

  ping(env, target = "192.168.1.1") {
    const wsCfg = getInterfaceConfig(env, "ws01.eth0");
    const bad = wsCfg.mode === "static" && wsCfg.ip.startsWith("10.");

    let targetLabel = target;
    if (target === "192.168.1.1") targetLabel = "192.168.1.1 (Default Gateway)";
    else if (target === "192.168.1.10") targetLabel = "192.168.1.10 (Reception Desk Phone)";
    else if (target === "8.8.8.8") targetLabel = "8.8.8.8 (External DNS / WAN)";

    let isReachable = false;
    if (target === "192.168.1.1") {
      isReachable = reach(env, "ws01", "gw01");
    } else if (target === "192.168.1.10") {
      isReachable = reach(env, "ws01", "phone01");
    } else if (target === "8.8.8.8") {
      isReachable = reach(env, "ws01", "gw01"); // Uplink depends on gateway reachability
    } else if (target === "192.168.1.20") {
      isReachable = reach(env, "ws01", "pbx01");
    }

    if (!isReachable) {
      return {
        text: `C:\\Users\\Reception> ping ${target}

Pinging ${target} with 32 bytes of data:
Destination host unreachable.
Destination host unreachable.
Destination host unreachable.
Destination host unreachable.

Ping statistics for ${target}:
    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)`,
        data: {
          probes: [
            { check: "reach", target, passed: false, key: `ping:${target}` }
          ]
        }
      };
    }

    const latency = target === "8.8.8.8" ? "14ms" : "<1ms";
    return {
      text: `C:\\Users\\Reception> ping ${target}

Pinging ${target} with 32 bytes of data:
Reply from ${target}: bytes=32 time=${latency} TTL=64
Reply from ${target}: bytes=32 time=${latency} TTL=64
Reply from ${target}: bytes=32 time=${latency} TTL=64
Reply from ${target}: bytes=32 time=${latency} TTL=64

Ping statistics for ${target}:
    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),
Approximate round trip times in milli-seconds:
    Minimum = 0ms, Maximum = ${target === "8.8.8.8" ? "15ms" : "1ms"}, Average = ${latency}`,
      data: {
        probes: [
          { check: "reach", target, passed: true, key: `ping:${target}` }
        ]
      }
    };
  },

  nslookup(env, name = "voice.example.test") {
    const wsCfg = getInterfaceConfig(env, "ws01.eth0");
    const bad = wsCfg.mode === "static" && wsCfg.ip.startsWith("10.");

    if (bad) {
      return {
        text: `C:\\Users\\Reception> nslookup ${name}
DNS request timed out.
    timeout was 2 seconds.
*** Can't find server address for 10.0.0.5: Timed out
*** Default servers are not available
Server:  UnKnown
Address:  10.0.0.5

DNS request timed out.
    timeout was 2 seconds.
*** Request to UnKnown timed-out`,
        data: {
          probes: [
            { check: "resolve", name, expectNode: "pbx01", passed: false, key: "dns" }
          ]
        }
      };
    }

    return {
      text: `C:\\Users\\Reception> nslookup ${name}
Server:  gateway.local
Address:  192.168.1.1

Non-authoritative answer:
Name:    ${name}
Address:  192.168.1.20`,
      data: {
        probes: [
          { check: "resolve", name, expectNode: "pbx01", passed: true, key: "dns" }
        ]
      }
    };
  },

  "sip-register-check"(env) {
    const state = serviceState(env, "sipreg-204");
    if (state !== "registered") {
      return {
        text: `[VoIP Diagnostic] Softphone Account 204 Status:
--------------------------------------------------
Status: UNREGISTERED
Account: 204 (Reception Support)
Registrar: sip.northstar-voice.test (192.168.1.20)
Local Interface: 10.0.0.50
Transport: UDP
Last Error: 408 Request Timeout (No response from registrar)`,
        data: {
          probes: [
            { check: "serviceState", service: "sipreg-204", state: "registered", passed: false, key: "voip" }
          ]
        }
      };
    }

    return {
      text: `[VoIP Diagnostic] Softphone Account 204 Status:
--------------------------------------------------
Status: REGISTERED
Account: 204 (Reception Support)
Registrar: sip.northstar-voice.test (192.168.1.20:5060)
Local Interface: 192.168.1.105
Transport: UDP
Registration URI: sip:204@sip.northstar-voice.test
Expiry: 3600 seconds
RTT: 1.2ms`,
      data: {
        probes: [
          { check: "serviceState", service: "sipreg-204", state: "registered", passed: true, key: "voip" }
        ]
      }
    };
  },

  "sip-restart"(env) {
    const state = serviceState(env, "sipreg-204");
    if (state !== "registered") {
      return {
        text: `[VoIP Service] Stopping softphone background agent... OK
[VoIP Service] Starting softphone service for account 204... OK
[VoIP Service] Sending REGISTER sip:204@sip.northstar-voice.test...
[VoIP Service] ERROR: Failed to reach registrar (timed out). Softphone remains UNREGISTERED.`,
        data: {
          probes: [
            { check: "serviceState", service: "sipreg-204", state: "registered", passed: false, key: "voip" }
          ]
        }
      };
    }

    return {
      text: `[VoIP Service] Stopping softphone background agent... OK
[VoIP Service] Starting softphone service for account 204... OK
[VoIP Service] Sending REGISTER sip:204@sip.northstar-voice.test...
[VoIP Service] Received 200 OK from 192.168.1.20:5060.
[VoIP Service] Registration complete. Line account 204 is ONLINE.`,
      data: {
        probes: [
          { check: "serviceState", service: "sipreg-204", state: "registered", passed: true, key: "voip" }
        ]
      }
    };
  }
};

export const networkingModule = {
  id: "networking",
  version: "1",
  componentTypes: {
    workstation: {},
    router: {},
    switch: {},
    "ip-phone": {},
    "sip-registrar": {}
  },
  serviceTypes: {
    dhcp: {},
    dns: {},
    "sip-registrar": {},
    "sip-registration": {}
  },
  configSchemas: {
    "net.interface": {
      mode: ["dhcp", "static"]
    }
  },
  actions: {
    "net.config.set": {
      validate(env, params) {
        if (!params.set || !params.set.config || !params.set.config.mode) {
          return { ok: false, code: "E_INVALID", message: "Missing interface config mode" };
        }
        if (!["dhcp", "static"].includes(params.set.config.mode)) {
          return { ok: false, code: "E_INVALID", message: `Invalid config mode: ${params.set.config.mode}` };
        }
        return { ok: true };
      },
      apply(env, params) {
        const target = params.target || "ws01.eth0";
        const oldCfg = getInterfaceConfig(env, target);
        const newCfg = params.set.config;
        return [
          {
            path: `${target}.config`,
            from: oldCfg,
            to: newCfg
          }
        ];
      }
    }
  },
  tools: {
    overview: { commands: { overview: toolRunners.overview } },
    ipconfig: { commands: { ipconfig: toolRunners.ipconfig, "ipconfig-all": toolRunners["ipconfig-all"] } },
    ping: { commands: { ping: toolRunners.ping } },
    dns: { commands: { nslookup: toolRunners.nslookup } },
    voip: { commands: { "sip-register-check": toolRunners["sip-register-check"], "sip-restart": toolRunners["sip-restart"] } }
  },
  derive: deriveEnvironment,
  checks: {
    linkUp,
    reach,
    resolve,
    serviceState
  }
};
