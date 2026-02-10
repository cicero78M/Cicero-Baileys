import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../src/db/index.js', () => ({ query: mockQuery }));

const { absensiRegistrasiDashboardDirektorat } = await import(
  '../src/handler/fetchabsensi/dashboard/absensiRegistrasiDashboardDirektorat.js'
);

beforeEach(() => {
  mockQuery.mockClear();
});

test('uses ORG scope by parent_client_id and excludes unrelated ORG', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('LIMIT 1')) {
      return {
        rows: [
          {
            client_id: 'DITINTELKAM',
            nama: 'Direktorat Intelkam',
            client_type: 'direktorat',
            regional_id: 'JATIM',
            client_level: 2,
            parent_client_id: null,
          },
        ],
      };
    }
    if (sql.includes('COALESCE(NULLIF(client_level')) {
      return {
        rows: [{ client_id: 'ORG_PARENT', nama: 'Org Parent', client_type: 'org' }],
      };
    }
    if (sql.includes('AS dashboard_user')) {
      return {
        rows: [
          { client_id: 'DITINTELKAM', dashboard_user: 2 },
          { client_id: 'ORG_PARENT', dashboard_user: 1 },
        ],
      };
    }
    if (sql.includes('JOIN login_log ll')) {
      return {
        rows: [
          { client_id: 'DITINTELKAM', operator: 1 },
          { client_id: 'ORG_PARENT', operator: 1 },
        ],
      };
    }
    return { rows: [] };
  });

  const msg = await absensiRegistrasiDashboardDirektorat('DITINTELKAM');

  expect(mockQuery).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining('LIMIT 1'),
    ['DITINTELKAM']
  );
  expect(mockQuery).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('COALESCE(NULLIF(client_level'),
    ['DITINTELKAM', 'JATIM', ['org', 'satker']]
  );
  expect(mockQuery).toHaveBeenNthCalledWith(
    3,
    expect.stringContaining('AS dashboard_user'),
    ['ditintelkam', ['DITINTELKAM', 'ORG_PARENT']]
  );
  expect(mockQuery).toHaveBeenNthCalledWith(
    4,
    expect.stringContaining('JOIN login_log ll'),
    ['ditintelkam', ['DITINTELKAM', 'ORG_PARENT'], expect.any(Date)]
  );

  expect(msg).toMatch(/Role filter: DITINTELKAM/);
  expect(msg).toMatch(/DIREKTORAT INTELKAM : 2 Direktorat \(1 absensi web\)/);
  expect(msg).toMatch(/- ORG PARENT : 1 user dashboard \(1 absensi web\)/);
  expect(msg).not.toMatch(/ORG GLOBAL/i);
});

test('falls back to regional scope when no parent_client_id mapping is available', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('LIMIT 1')) {
      return {
        rows: [
          {
            client_id: 'CUSTOM_DIT',
            nama: 'Custom Dit',
            client_type: 'direktorat',
            regional_id: 'JATIM',
            client_level: 2,
            parent_client_id: null,
          },
        ],
      };
    }
    if (sql.includes('COALESCE(NULLIF(client_level')) {
      return {
        rows: [{ client_id: 'ORG_JATIM', nama: 'Org Jatim', client_type: 'org' }],
      };
    }
    if (sql.includes('AS dashboard_user')) {
      return {
        rows: [{ client_id: 'CUSTOM_DIT', dashboard_user: 1 }],
      };
    }
    if (sql.includes('JOIN login_log ll')) {
      return {
        rows: [],
      };
    }
    return { rows: [] };
  });

  await absensiRegistrasiDashboardDirektorat('CUSTOM_DIT');

  expect(mockQuery).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('COALESCE(NULLIF(client_level'),
    ['CUSTOM_DIT', 'JATIM', ['org', 'satker']]
  );
  expect(mockQuery).toHaveBeenNthCalledWith(
    3,
    expect.stringContaining('AS dashboard_user'),
    ['ditbinmas', ['CUSTOM_DIT', 'ORG_JATIM']]
  );
});

test('keeps selected directorate in scope when ORG relation is empty', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('LIMIT 1')) {
      return {
        rows: [
          {
            client_id: 'DITLANTAS',
            nama: 'Direktorat Lantas',
            client_type: 'direktorat',
            regional_id: 'JABAR',
            client_level: 2,
            parent_client_id: null,
          },
        ],
      };
    }
    if (sql.includes('COALESCE(NULLIF(client_level')) {
      return { rows: [] };
    }
    if (sql.includes('AS dashboard_user')) {
      return {
        rows: [{ client_id: 'DITLANTAS', dashboard_user: 3 }],
      };
    }
    if (sql.includes('JOIN login_log ll')) {
      return {
        rows: [{ client_id: 'DITLANTAS', operator: 2 }],
      };
    }
    return { rows: [] };
  });

  const msg = await absensiRegistrasiDashboardDirektorat('DITLANTAS');

  expect(mockQuery).toHaveBeenNthCalledWith(
    3,
    expect.stringContaining('AS dashboard_user'),
    ['ditlantas', ['DITLANTAS']]
  );
  expect(msg).toMatch(/DIREKTORAT LANTAS : 3 Direktorat \(2 absensi web\)/);
  expect(msg).toMatch(/Sudah memiliki user dashboard : 0 client ORG/);
});

test('includes satker client_level in menu 11 directorate scope', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('LIMIT 1')) {
      return {
        rows: [
          {
            client_id: 'DITSAMAPTA',
            nama: 'Direktorat Samapta',
            client_type: 'direktorat',
            regional_id: 'JATIM',
            client_level: 'direktorat',
            parent_client_id: null,
          },
        ],
      };
    }
    if (sql.includes('COALESCE(NULLIF(client_level')) {
      return {
        rows: [
          {
            client_id: 'SATKER_SAMAPTA_1',
            nama: 'Satker Samapta 1',
            client_type: 'ORG',
            client_level: 'Satker',
          },
        ],
      };
    }
    if (sql.includes('AS dashboard_user')) {
      return {
        rows: [
          { client_id: 'DITSAMAPTA', dashboard_user: 2 },
          { client_id: 'SATKER_SAMAPTA_1', dashboard_user: 1 },
        ],
      };
    }
    if (sql.includes('JOIN login_log ll')) {
      return {
        rows: [{ client_id: 'SATKER_SAMAPTA_1', operator: 1 }],
      };
    }
    return { rows: [] };
  });

  const msg = await absensiRegistrasiDashboardDirektorat('DITSAMAPTA');

  expect(mockQuery).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('COALESCE(NULLIF(client_level'),
    ['DITSAMAPTA', 'JATIM', ['org', 'satker']]
  );
  expect(mockQuery).toHaveBeenNthCalledWith(
    3,
    expect.stringContaining('AS dashboard_user'),
    ['ditsamapta', ['DITSAMAPTA', 'SATKER_SAMAPTA_1']]
  );
  expect(msg).toMatch(/- SATKER SAMAPTA 1 : 1 user dashboard \(1 absensi web\)/);
});
