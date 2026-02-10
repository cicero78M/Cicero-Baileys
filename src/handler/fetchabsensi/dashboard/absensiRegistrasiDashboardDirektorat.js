import { query } from "../../../db/index.js";
import { hariIndo } from "../../../utils/constants.js";
import { getGreeting } from "../../../utils/utilsHelper.js";

function normalizeDirectorateId(clientId) {
  return String(clientId || "").trim().toUpperCase() || "DITBINMAS";
}

export async function absensiRegistrasiDashboardDirektorat(clientId = "DITBINMAS") {
  const directorateId = normalizeDirectorateId(clientId);
  const roleName = directorateId.toLowerCase();
  const roleLabel = directorateId.charAt(0).toUpperCase() + directorateId.slice(1).toLowerCase();

  const now = new Date();
  const hari = hariIndo[now.getDay()];
  const tanggal = now.toLocaleDateString("id-ID");
  const jam = now.toLocaleTimeString("id-ID", { hour12: false });
  const salam = getGreeting();

  // Get start of today in local timezone (Jakarta/Asia timezone).
  // This is consistent with how dates are displayed throughout the application.
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // Get clients that have users with the matching role (defines the directorate's scope)
  const { rows: scopeClients } = await query(
    `SELECT DISTINCT UPPER(duc.client_id) AS client_id
     FROM dashboard_user du
     JOIN roles r ON du.role_id = r.role_id
     JOIN dashboard_user_clients duc ON du.dashboard_user_id = duc.dashboard_user_id
     WHERE LOWER(r.role_name) = $1 AND du.status = true`,
    [roleName]
  );

  const scopeClientIdsSet = new Set(scopeClients.map((c) => c.client_id));
  if (!scopeClientIdsSet.has(directorateId)) {
    scopeClientIdsSet.add(directorateId);
  }
  const scopeClientIds = Array.from(scopeClientIdsSet);

  const { rows: clients } = await query(
    `SELECT client_id, nama FROM clients
     WHERE client_status = true AND UPPER(client_id) = ANY($1)
     ORDER BY nama`,
    [scopeClientIds]
  );

  const { rows: registeredRows } = await query(
    `SELECT duc.client_id, COUNT(DISTINCT du.dashboard_user_id) AS operator
     FROM dashboard_user du
     JOIN roles r ON du.role_id = r.role_id
     JOIN dashboard_user_clients duc ON du.dashboard_user_id = duc.dashboard_user_id
     JOIN clients c ON c.client_id = duc.client_id
     JOIN login_log ll ON ll.actor_id = du.dashboard_user_id::TEXT
     WHERE LOWER(r.role_name) = $1 AND du.status = true
       AND UPPER(duc.client_id) = ANY($2)
       AND ll.login_source = 'web'
       AND ll.logged_at >= $3
     GROUP BY duc.client_id`,
    [roleName, scopeClientIds, startOfToday]
  );

  const countMap = new Map(
    registeredRows.map((r) => [r.client_id.toUpperCase(), Number(r.operator)])
  );

  const directorateName =
    clients.find((c) => c.client_id?.toUpperCase() === directorateId)?.nama ||
    directorateId;
  const directorateCount = countMap.get(directorateId) || 0;

  const sudah = [];
  const belum = [];
  clients
    .filter((client) => client.client_id?.toUpperCase() !== directorateId)
    .forEach((client) => {
      const id = client.client_id.toUpperCase();
      const count = countMap.get(id) || 0;
      if (count > 0) {
        sudah.push(`${client.nama.toUpperCase()} : ${count} ${roleLabel}`);
      } else {
        belum.push(client.nama.toUpperCase());
      }
    });

  let msg = `${salam}\n\n`;
  msg += `Mohon Ijin Komandan,\n\n`;
  msg += `📋 Rekap Registrasi User dashboard Cicero ${directorateName.toUpperCase()} :\n`;
  msg += `${hari}, ${tanggal}\n`;
  msg += `Jam: ${jam}\n\n`;
  msg += `Absensi Registrasi User Direktorat dan Polres :\n\n`;
  msg += `${directorateName.toUpperCase()} : ${directorateCount} ${roleLabel}\n\n`;
  msg += `Sudah : ${sudah.length} Polres\n`;
  msg += sudah.length ? sudah.map((n) => `- ${n}`).join("\n") : "-";
  msg += `\nBelum : ${belum.length} Polres\n`;
  msg += belum.length ? belum.map((n) => `- ${n}`).join("\n") : "-";
  return msg.trim();
}

export { absensiRegistrasiDashboardDirektorat as absensiRegistrasiDashboardDitbinmas };
