/**
 * TRACE — Characterization Paths G1 through G11
 *
 * Implements HANDOFF §5:
 *  - G1: Happy path (review ticket -> mark comm -> begin -> connect -> workstation -> all tools -> finding -> elevate -> apply DHCP -> re-verify -> finish -> review)
 *  - G2: Blind fix (elevate + apply, no diagnosis) -> Finish
 *  - G3: Apply before elevating (denial banner) -> elevate -> apply -> ping -> Finish
 *  - G4: Wrong finding (DNS) -> Finish
 *  - G5: Wrong finding (ISP) -> Finish
 *  - G6: Wrong finding (Cabling) -> Finish
 *  - G7: Connect -> Workstation -> Finish immediately
 *  - G8: End Session -> click Workstation nav (D-02 check)
 *  - G9: Return to Ticket -> snapshot nav states (D-01 check)
 *  - G10: Open four tool tabs only -> Finish (D-04 check)
 *  - G11: Finish -> Retry -> open Connectivity Tests (reset check)
 */

export const paths = {
  async G1(driver) {
    await driver.load();
    await driver.click("Mark communication as reviewed");
    await driver.click("Begin Investigation");
    await driver.click("Connect to Simulated Session");
    await driver.until(doc => doc.body.textContent.includes("SIMULATED SESSION ACTIVE"));
    await driver.click("Enter Workstation Environment");
    // Run diagnostics
    await driver.click("IP Configuration");
    await driver.click("Run ipconfig /all");
    await driver.click("Connectivity Tests");
    await driver.click("Ping Gateway");
    await driver.click("DNS Lookup");
    await driver.click("Query sip.northstar-voice.test");
    await driver.click("VoIP Service Status");
    await driver.click("Check Softphone Status");
    // Action history & record finding
    await driver.click("Action History");
    await driver.choose("findingSelect", "static");
    await driver.click("Record Finding");
    // Elevate and fix
    await driver.click("Request Elevation");
    await driver.click("Apply DHCP Configuration");
    // Post-fix verification
    await driver.click("Connectivity Tests");
    await driver.click("Ping Gateway");
    await driver.click("DNS Lookup");
    await driver.click("Query voice.example.test");
    await driver.click("Finish Investigation");
    return driver.snap();
  },

  async G2(driver) {
    await driver.load();
    await driver.click("Begin Investigation");
    await driver.click("Connect to Simulated Session");
    await driver.until(doc => doc.body.textContent.includes("SIMULATED SESSION ACTIVE"));
    await driver.click("Enter Workstation Environment");
    await driver.click("Request Elevation");
    await driver.click("Apply DHCP Configuration");
    await driver.click("Finish Investigation");
    return driver.snap();
  },

  async G3(driver) {
    await driver.load();
    await driver.click("Begin Investigation");
    await driver.click("Connect to Simulated Session");
    await driver.until(doc => doc.body.textContent.includes("SIMULATED SESSION ACTIVE"));
    await driver.click("Enter Workstation Environment");
    await driver.click("Apply DHCP Configuration"); // denied attempt
    await driver.click("Request Elevation");
    await driver.click("Apply DHCP Configuration");
    await driver.click("Connectivity Tests");
    await driver.click("Ping Gateway");
    await driver.click("Finish Investigation");
    return driver.snap();
  },

  async G4(driver) {
    await driver.load();
    await driver.click("Begin Investigation");
    await driver.click("Connect to Simulated Session");
    await driver.until(doc => doc.body.textContent.includes("SIMULATED SESSION ACTIVE"));
    await driver.click("Enter Workstation Environment");
    await driver.click("Action History");
    await driver.choose("findingSelect", "dns");
    await driver.click("Record Finding");
    await driver.click("Finish Investigation");
    return driver.snap();
  },

  async G5(driver) {
    await driver.load();
    await driver.click("Begin Investigation");
    await driver.click("Connect to Simulated Session");
    await driver.until(doc => doc.body.textContent.includes("SIMULATED SESSION ACTIVE"));
    await driver.click("Enter Workstation Environment");
    await driver.click("Action History");
    await driver.choose("findingSelect", "isp");
    await driver.click("Record Finding");
    await driver.click("Finish Investigation");
    return driver.snap();
  },

  async G6(driver) {
    await driver.load();
    await driver.click("Begin Investigation");
    await driver.click("Connect to Simulated Session");
    await driver.until(doc => doc.body.textContent.includes("SIMULATED SESSION ACTIVE"));
    await driver.click("Enter Workstation Environment");
    await driver.click("Action History");
    await driver.choose("findingSelect", "cable");
    await driver.click("Record Finding");
    await driver.click("Finish Investigation");
    return driver.snap();
  },

  async G7(driver) {
    await driver.load();
    await driver.click("Begin Investigation");
    await driver.click("Connect to Simulated Session");
    await driver.until(doc => doc.body.textContent.includes("SIMULATED SESSION ACTIVE"));
    await driver.click("Enter Workstation Environment");
    await driver.click("Finish Investigation");
    return driver.snap();
  },

  async G8(driver) {
    await driver.load();
    await driver.click("Begin Investigation");
    await driver.click("Connect to Simulated Session");
    await driver.until(doc => doc.body.textContent.includes("SIMULATED SESSION ACTIVE"));
    await driver.click("End Session");
    return driver.snap();
  },

  async G9(driver) {
    await driver.load();
    await driver.click("Begin Investigation");
    await driver.click("Connect to Simulated Session");
    await driver.until(doc => doc.body.textContent.includes("SIMULATED SESSION ACTIVE"));
    await driver.click("Enter Workstation Environment");
    await driver.click("Return to Ticket");
    return driver.snap();
  },

  async G10(driver) {
    await driver.load();
    await driver.click("Begin Investigation");
    await driver.click("Connect to Simulated Session");
    await driver.until(doc => doc.body.textContent.includes("SIMULATED SESSION ACTIVE"));
    await driver.click("Enter Workstation Environment");
    await driver.click("IP Configuration");
    await driver.click("Connectivity Tests");
    await driver.click("DNS Lookup");
    await driver.click("VoIP Service Status");
    await driver.click("Finish Investigation");
    return driver.snap();
  },

  async G11(driver) {
    await driver.load();
    await driver.click("Begin Investigation");
    await driver.click("Connect to Simulated Session");
    await driver.until(doc => doc.body.textContent.includes("SIMULATED SESSION ACTIVE"));
    await driver.click("Enter Workstation Environment");
    await driver.click("Finish Investigation");
    await driver.click("Retry Exercise");
    await driver.click("Enter Workstation Environment");
    await driver.click("Connectivity Tests");
    return driver.snap();
  }
};
