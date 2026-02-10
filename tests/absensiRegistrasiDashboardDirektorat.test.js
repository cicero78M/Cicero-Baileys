import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../src/db/index.js', () => ({ query: mockQuery }));

const { absensiRegistrasiDashboardDirektorat } = await import(
  '../src/handler/fetchabsensi/dashboard/absensiRegistrasiDashboardDirektorat.js'
);

beforeEach(() => {
  mockQuery.mockClear();
});

test('generates directorate report with sequential operator counts', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('SELECT DISTINCT UPPER(duc.client_id)')) {
      return {
        rows: [
          { client_id: 'DITA' },
          { client_id: 'POLRESA' },
          { client_id: 'POLRESB' },
        ],
      };
    }
    if (sql.includes('FROM clients')) {
      return {
        rows: [
          { client_id: 'DITA', nama: 'Dit A' },
          { client_id: 'POLRESA', nama: 'Polres A' },
          { client_id: 'POLRESB', nama: 'Polres B' },
        ],
      };
    }
    if (sql.includes('GROUP BY duc.client_id')) {
      return {
        rows: [
          { client_id: 'DITA', operator: 3 },
          { client_id: 'POLRESA', operator: 1 },
        ],
      };
    }
    return { rows: [] };
  });

  const msg = await absensiRegistrasiDashboardDirektorat('dita');

  expect(mockQuery).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining('SELECT DISTINCT UPPER(duc.client_id)'),
    [['ditbinmas', 'ditlantas', 'bidhumas', 'ditsamapta', 'ditintelkam']]
  );
  expect(mockQuery).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('client_status = true'),
    [['DITA', 'POLRESA', 'POLRESB']]
  );
  expect(mockQuery).toHaveBeenNthCalledWith(
    3,
    expect.stringContaining('JOIN login_log ll'),
    [['ditbinmas', 'ditlantas', 'bidhumas', 'ditsamapta', 'ditintelkam'], ['DITA', 'POLRESA', 'POLRESB'], expect.any(Date)]
  );
  expect(msg).toMatch(/DIT A : 3 Direktorat/);
  expect(msg).toMatch(/Sudah : 1 Polres\n- POLRES A : 1 Direktorat/);
  expect(msg).toMatch(/Belum : 1 Polres\n- POLRES B/);
});

test('generates report for DITINTELKAM with correct role label', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('SELECT DISTINCT UPPER(duc.client_id)')) {
      return {
        rows: [
          { client_id: 'DITINTELKAM' },
          { client_id: 'POLRES_BOJONEGORO' },
          { client_id: 'POLRES_JOMBANG' },
          { client_id: 'POLRES_KEDIRI' },
        ],
      };
    }
    if (sql.includes('FROM clients')) {
      return {
        rows: [
          { client_id: 'DITINTELKAM', nama: 'Direktorat Intelkam' },
          { client_id: 'POLRES_BOJONEGORO', nama: 'Polres Bojonegoro' },
          { client_id: 'POLRES_JOMBANG', nama: 'Polres Jombang' },
          { client_id: 'POLRES_KEDIRI', nama: 'Polres Kediri' },
        ],
      };
    }
    if (sql.includes('GROUP BY duc.client_id')) {
      return {
        rows: [
          { client_id: 'DITINTELKAM', operator: 1 },
        ],
      };
    }
    return { rows: [] };
  });

  const msg = await absensiRegistrasiDashboardDirektorat('DITINTELKAM');

  expect(mockQuery).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining('SELECT DISTINCT UPPER(duc.client_id)'),
    [['ditbinmas', 'ditlantas', 'bidhumas', 'ditsamapta', 'ditintelkam']]
  );
  expect(mockQuery).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('client_status = true'),
    [['DITINTELKAM', 'POLRES_BOJONEGORO', 'POLRES_JOMBANG', 'POLRES_KEDIRI']]
  );
  expect(mockQuery).toHaveBeenNthCalledWith(
    3,
    expect.stringContaining('JOIN login_log ll'),
    [['ditbinmas', 'ditlantas', 'bidhumas', 'ditsamapta', 'ditintelkam'], ['DITINTELKAM', 'POLRES_BOJONEGORO', 'POLRES_JOMBANG', 'POLRES_KEDIRI'], expect.any(Date)]
  );
  // Should show role label "Direktorat" instead of "Ditintelkam"
  expect(msg).toMatch(/DIREKTORAT INTELKAM : 1 Direktorat/);
  expect(msg).toMatch(/Sudah : 0 Polres/);
  expect(msg).toMatch(/Belum : 3 Polres/);
  expect(msg).toMatch(/POLRES BOJONEGORO/);
  expect(msg).toMatch(/POLRES JOMBANG/);
  expect(msg).toMatch(/POLRES KEDIRI/);
});
