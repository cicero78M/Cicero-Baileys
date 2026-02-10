import { query } from "../../../db/index.js";
import { hariIndo } from "../../../utils/constants.js";
import { getGreeting } from "../../../utils/utilsHelper.js";

const ROLE_BY_DIREKTORAT_CLIENT = {
  DITBINMAS: "ditbinmas",
  DITLANTAS: "ditlantas",
  BIDHUMAS: "bidhumas",
  DITSAMAPTA: "ditsamapta",
  DITINTELKAM: "ditintelkam",
};

function normalizeDirectorateId(clientId) {
  return String(clientId || "").trim().toUpperCase() || "DITBINMAS";
}

function resolveRoleByDirectorate(clientId) {
  return ROLE_BY_DIREKTORAT_CLIENT[normalizeDirectorateId(clientId)] || "ditbinmas";
}

export async function absensiRegistrasiDashboardDirektorat(clientId = "DITBINMAS") {
  const directorateId = normalizeDirectorateId(clientId);
  const roleName = resolveRoleByDirectorate(directorateId);
  const roleLabel = "Direktorat";

  const now = new Date();
  const hari = hariIndo[now.getDay()];
  const tanggal = now.toLocaleDateString("id-ID");
  const jam = now.toLocaleTimeString("id-ID", { hour12: false });
  const salam = getGreeting();

  // Get start of today in local timezone (Jakarta/Asia timezone).
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // Scope menu 11: selected directorate + ORG clients in the same hierarchy.
  const { rows: directorateRows } = await query(
    `SELECT client_id, nama, client_type, regional_id, client_level, parent_client_id
     FROM clients
     WHERE UPPER(client_id) = $1
     LIMIT 1`,
    [directorateId]
  );
  const directorateMetadata = directorateRows[0] || null;
  const directorateRegionalId =
    directorateMetadata?.regional_id && String(directorateMetadata.regional_id).trim()
      ? String(directorateMetadata.regional_id).trim().toUpperCase()
      : null;

  const { rows: orgClients } = await query(
    `SELECT client_id, nama, client_type
     FROM clients
     WHERE client_status = true
       AND LOWER(client_type) = 'org'
       AND (
         UPPER(COALESCE(parent_client_id, '')) = $1
         OR (
           $2::TEXT IS NOT NULL
           AND UPPER(COALESCE(regional_id, '')) = $2
           AND NOT EXISTS (
             SELECT 1
             FROM clients pc
             WHERE pc.client_status = true
               AND LOWER(pc.client_type) = 'org'
               AND UPPER(COALESCE(pc.parent_client_id, '')) = $1
           )
         )
       )
     ORDER BY nama`,
    [directorateId, directorateRegionalId]
  );

  const clients = [];
  const seenClients = new Set();

  const selectedDirektorat = {
    client_id: directorateId,
    nama: directorateMetadata?.nama || directorateId,
    client_type: directorateMetadata?.client_type || 'direktorat',
  };
  clients.push(selectedDirektorat);
  seenClients.add(directorateId);

  orgClients.forEach((client) => {
    const normalizedClientId = String(client.client_id || '').trim().toUpperCase();
    if (!normalizedClientId || seenClients.has(normalizedClientId)) return;
    clients.push(client);
    seenClients.add(normalizedClientId);
  });

  const scopeClientIds = clients.map((client) => client.client_id.toUpperCase());
  if (!scopeClientIds.length) {
    scopeClientIds.push(directorateId);
  }

  const { rows: dashboardUserRows } = await query(
    `SELECT UPPER(duc.client_id) AS client_id, COUNT(DISTINCT du.dashboard_user_id) AS dashboard_user
     FROM dashboard_user du
     JOIN roles r ON du.role_id = r.role_id
     JOIN dashboard_user_clients duc ON du.dashboard_user_id = duc.dashboard_user_id
     WHERE LOWER(r.role_name) = LOWER($1)
       AND du.status = true
       AND UPPER(duc.client_id) = ANY($2)
     GROUP BY UPPER(duc.client_id)`,
    [roleName, scopeClientIds]
  );

  const { rows: loginRows } = await query(
    `SELECT UPPER(duc.client_id) AS client_id, COUNT(DISTINCT du.dashboard_user_id) AS operator
     FROM dashboard_user du
     JOIN roles r ON du.role_id = r.role_id
     JOIN dashboard_user_clients duc ON du.dashboard_user_id = duc.dashboard_user_id
     JOIN login_log ll ON ll.actor_id = du.dashboard_user_id::TEXT
     WHERE LOWER(r.role_name) = LOWER($1)
       AND du.status = true
       AND UPPER(duc.client_id) = ANY($2)
       AND ll.login_source = 'web'
       AND ll.logged_at >= $3
     GROUP BY UPPER(duc.client_id)`,
    [roleName, scopeClientIds, startOfToday]
  );

  const dashboardCountMap = new Map(
    dashboardUserRows.map((row) => [row.client_id.toUpperCase(), Number(row.dashboard_user)])
  );
  const loginCountMap = new Map(
    loginRows.map((row) => [row.client_id.toUpperCase(), Number(row.operator)])
  );

  const directorateName = selectedDirektorat.nama || directorateId;
  const directorateDashboardCount = dashboardCountMap.get(directorateId) || 0;
  const directorateAttendanceCount = loginCountMap.get(directorateId) || 0;

  const hasDashboardUser = [];
  const noDashboardUser = [];
  const hasAttendance = [];
  const noAttendance = [];

  clients
    .filter((client) => client.client_id?.toUpperCase() !== directorateId)
    .forEach((client) => {
      const id = client.client_id.toUpperCase();
      const dashboardCount = dashboardCountMap.get(id) || 0;
      const attendanceCount = loginCountMap.get(id) || 0;

      if (dashboardCount > 0) {
        hasDashboardUser.push(
          `${client.nama.toUpperCase()} : ${dashboardCount} user dashboard (${attendanceCount} absensi web)`
        );
      } else {
        noDashboardUser.push(client.nama.toUpperCase());
      }

      if (attendanceCount > 0) {
        hasAttendance.push(`${client.nama.toUpperCase()} : ${attendanceCount} user`);
      } else {
        noAttendance.push(client.nama.toUpperCase());
      }
    });

  let msg = `${salam}\n\n`;
  msg += `Mohon Ijin Komandan,\n\n`;
  msg += `📋 Rekap Registrasi User dashboard Cicero ${directorateName.toUpperCase()} :\n`;
  msg += `${hari}, ${tanggal}\n`;
  msg += `Jam: ${jam}\n\n`;
  msg += `Role filter: ${roleName.toUpperCase()}\n\n`;
  msg += `Absensi Registrasi User Direktorat dan Client ORG :\n\n`;
  msg += `${directorateName.toUpperCase()} : ${directorateDashboardCount} ${roleLabel} (${directorateAttendanceCount} absensi web)\n\n`;

  msg += `Sudah memiliki user dashboard : ${hasDashboardUser.length} client ORG\n`;
  msg += hasDashboardUser.length ? hasDashboardUser.map((name) => `- ${name}`).join("\n") : "-";
  msg += `\nBelum memiliki user dashboard : ${noDashboardUser.length} client ORG\n`;
  msg += noDashboardUser.length ? noDashboardUser.map((name) => `- ${name}`).join("\n") : "-";

  msg += `\n\nSudah absensi web hari ini : ${hasAttendance.length} client ORG\n`;
  msg += hasAttendance.length ? hasAttendance.map((name) => `- ${name}`).join("\n") : "-";
  msg += `\nBelum absensi web hari ini : ${noAttendance.length} client ORG\n`;
  msg += noAttendance.length ? noAttendance.map((name) => `- ${name}`).join("\n") : "-";
  return msg.trim();
}

export { absensiRegistrasiDashboardDirektorat as absensiRegistrasiDashboardDitbinmas };
