import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../src/db/index.js', () => ({ query: mockQuery }));

const { absensiRegistrasiDashboardDirektorat } = await import(
  '../src/handler/fetchabsensi/dashboard/absensiRegistrasiDashboardDirektorat.js'
);

beforeEach(() => {
  mockQuery.mockClear();
});

test('generates report for selected directorate role and ORG scope', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('FROM clients')) {
      return {
        rows: [
          { client_id: 'DITINTELKAM', nama: 'Direktorat Intelkam', client_type: 'direktorat' },
          { client_id: 'ORG_A', nama: 'Org A', client_type: 'org' },
          { client_id: 'ORG_B', nama: 'Org B', client_type: 'org' },
        ],
      };
    }
    if (sql.includes('AS dashboard_user')) {
      return {
        rows: [
          { client_id: 'DITINTELKAM', dashboard_user: 2 },
          { client_id: 'ORG_A', dashboard_user: 1 },
        ],
      };
    }
    if (sql.includes('JOIN login_log ll')) {
      return {
        rows: [
          { client_id: 'DITINTELKAM', operator: 1 },
          { client_id: 'ORG_A', operator: 1 },
        ],
      };
    }
    return { rows: [] };
  });

  const msg = await absensiRegistrasiDashboardDirektorat('DITINTELKAM');

  expect(mockQuery).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining('FROM clients'),
    ['DITINTELKAM']
  );
  expect(mockQuery).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('AS dashboard_user'),
    ['ditintelkam', ['DITINTELKAM', 'ORG_A', 'ORG_B']]
  );
  expect(mockQuery).toHaveBeenNthCalledWith(
    3,
    expect.stringContaining('JOIN login_log ll'),
    ['ditintelkam', ['DITINTELKAM', 'ORG_A', 'ORG_B'], expect.any(Date)]
  );

  expect(msg).toMatch(/Role filter: DITINTELKAM/);
  expect(msg).toMatch(/DIREKTORAT INTELKAM : 2 Direktorat \(1 absensi web\)/);
  expect(msg).toMatch(/Sudah memiliki user dashboard : 1 client ORG/);
  expect(msg).toMatch(/- ORG A : 1 user dashboard \(1 absensi web\)/);
  expect(msg).toMatch(/Belum memiliki user dashboard : 1 client ORG/);
  expect(msg).toMatch(/- ORG B/);
  expect(msg).toMatch(/Sudah absensi web hari ini : 1 client ORG/);
  expect(msg).toMatch(/Belum absensi web hari ini : 1 client ORG/);
});

test('falls back to ditbinmas role mapping for unknown directorate id', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('FROM clients')) {
      return {
        rows: [
          { client_id: 'CUSTOM_DIT', nama: 'Custom Dit', client_type: 'direktorat' },
          { client_id: 'ORG_X', nama: 'Org X', client_type: 'org' },
        ],
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
    expect.stringContaining('AS dashboard_user'),
    ['ditbinmas', ['CUSTOM_DIT', 'ORG_X']]
  );
});
